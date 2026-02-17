import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type SyncTarget = 'employees' | 'contractors' | 'all';

type BambooRecord = Record<string, string | null | undefined>;

interface SyncPayload {
  target?: SyncTarget;
}

interface SourceConfig {
  workerType: 'Employee' | 'Contractor';
  subdomain: string;
  apiKey: string;
  reportId: string;
}

function normalizeEmail(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function parseDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function pick(record: BambooRecord, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function toEmployeeRow(record: BambooRecord, workerType: 'Employee' | 'Contractor') {
  const email = normalizeEmail(pick(record, ['workEmail', 'email', 'Email', 'Work Email']));
  return {
    email,
    full_name: pick(record, ['displayName', 'fullName', 'name', 'employeeName', 'Employee', 'firstName']) || email,
    role: pick(record, ['jobTitle', 'title', 'role']),
    department: pick(record, ['customTribeName', 'department', 'Department']),
    manager: pick(record, ['91', 'manager', 'managerName', 'Manager']),
    status: pick(record, ['status', 'employmentStatus', 'Employment Status']),
    worker_type: workerType,
    hire_date: parseDate(pick(record, ['hireDate', 'dateOfHire', 'Hire Date'])),
    end_date: parseDate(pick(record, ['terminationDate', 'endDate', 'End Date'])),
  };
}

async function fetchBambooReport(config: SourceConfig): Promise<BambooRecord[]> {
  const url = `https://${config.subdomain}.bamboohr.com/api/gateway.php/${config.subdomain}/v1/reports/${config.reportId}?format=json&fd=yes&onlyCurrent=1`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Basic ${btoa(`${config.apiKey}:x`)}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`BambooHR fetch failed for ${config.workerType}: ${response.status} ${response.statusText} ${body}`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload?.employees)) {
    throw new Error(`Unexpected BambooHR payload for ${config.workerType}.`);
  }

  return payload.employees as BambooRecord[];
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const { target = 'all' }: SyncPayload = await request.json();
    if (!['employees', 'contractors', 'all'].includes(target)) {
      return Response.json(
        { success: false, message: 'target must be employees, contractors, or all.' },
        { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in edge environment.');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: settings, error: settingsError } = await supabase
      .from('system_settings')
      .select('id,bamboohr_emp_subdomain,bamboohr_emp_api_key,bamboohr_emp_report_id,bamboohr_cont_subdomain,bamboohr_cont_api_key,bamboohr_cont_report_id')
      .eq('id', 1)
      .single();

    if (settingsError || !settings) {
      throw new Error(`Unable to load system settings: ${settingsError?.message ?? 'not found'}`);
    }

    const configs: SourceConfig[] = [];
    if (target === 'employees' || target === 'all') {
      if (!settings.bamboohr_emp_subdomain || !settings.bamboohr_emp_api_key || !settings.bamboohr_emp_report_id) {
        throw new Error('Missing BambooHR employee settings.');
      }
      configs.push({
        workerType: 'Employee',
        subdomain: settings.bamboohr_emp_subdomain,
        apiKey: settings.bamboohr_emp_api_key,
        reportId: settings.bamboohr_emp_report_id,
      });
    }

    if (target === 'contractors' || target === 'all') {
      if (!settings.bamboohr_cont_subdomain || !settings.bamboohr_cont_api_key || !settings.bamboohr_cont_report_id) {
        throw new Error('Missing BambooHR contractor settings.');
      }
      configs.push({
        workerType: 'Contractor',
        subdomain: settings.bamboohr_cont_subdomain,
        apiKey: settings.bamboohr_cont_api_key,
        reportId: settings.bamboohr_cont_report_id,
      });
    }

    const allRows: Array<ReturnType<typeof toEmployeeRow>> = [];
    for (const config of configs) {
      const records = await fetchBambooReport(config);
      const mapped = records
        .map((record) => toEmployeeRow(record, config.workerType))
        .filter((row) => row.email.length > 0);
      allRows.push(...mapped);
    }

    const emailsToKeep = new Set(allRows.map((row) => row.email));
    const workerTypesToMirror = configs.map((config) => config.workerType);

    if (allRows.length > 0) {
      const { error: upsertError } = await supabase
        .from('employees')
        .upsert(allRows, { onConflict: 'email' });

      if (upsertError) {
        throw new Error(`Upsert failed: ${upsertError.message}`);
      }
    }

    let deleteCount = 0;
    if (workerTypesToMirror.length > 0) {
      const { data: existingRows, error: existingError } = await supabase
        .from('employees')
        .select('id,email,worker_type')
        .in('worker_type', workerTypesToMirror);

      if (existingError) {
        throw new Error(`Failed loading existing rows for mirror sync: ${existingError.message}`);
      }

      const rowsToDelete = (existingRows ?? []).filter((row) => !emailsToKeep.has(normalizeEmail(row.email)));
      if (rowsToDelete.length > 0) {
        const ids = rowsToDelete.map((row) => row.id);
        const { error: deleteError } = await supabase.from('employees').delete().in('id', ids);
        if (deleteError) {
          throw new Error(`Mirror delete failed: ${deleteError.message}`);
        }
        deleteCount = rowsToDelete.length;
      }
    }

    return Response.json(
      {
        success: true,
        target,
        fetched: allRows.length,
        mirroredWorkerTypes: workerTypesToMirror,
        deleted: deleteCount,
      },
      { headers: { 'Access-Control-Allow-Origin': '*' } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return Response.json(
      { success: false, message },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } },
    );
  }
});
