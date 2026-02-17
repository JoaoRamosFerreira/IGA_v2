import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

interface ReviewItemRow {
  id: string;
  employee_email: string;
  reviewer_email: string;
  status: 'pending' | 'reviewed';
  decision: 'Approved' | 'Revoked' | null;
  notes: string | null;
  okta_group: string | null;
  asset_id: string;
  assets?: Array<{
    name: string;
    rbac_url: string | null;
  }>;
}

interface EmployeeRow {
  email: string;
  full_name: string;
}

interface SubmitDecisionResponse {
  success: boolean;
  message?: string;
}

interface CsvRow {
  Email: string;
  'Employee Name': string;
  Asset: string;
  Decision: string;
  Notes: string;
}

function toCsv(rows: Array<{ email: string; employeeName: string; asset: string; decision: string; notes: string }>): string {
  const headers = ['Email', 'Employee Name', 'Asset', 'Decision', 'Notes'];
  const esc = (value: string) => `"${value.split('"').join('""')}"`;
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push([row.email, row.employeeName, row.asset, row.decision, row.notes].map(esc).join(','));
  }
  return lines.join('\n');
}

function parseCsv(content: string): CsvRow[] {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const splitCsvLine = (line: string): string[] => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
        continue;
      }

      current += char;
    }

    values.push(current);
    return values.map((value) => value.trim());
  };

  const header = splitCsvLine(lines[0]);
  const required = ['Email', 'Employee Name', 'Asset', 'Decision', 'Notes'];
  const missing = required.find((key) => !header.includes(key));
  if (missing) {
    throw new Error(`CSV is missing required header: ${missing}`);
  }

  const indexByHeader: Record<string, number> = {};
  header.forEach((name, idx) => {
    indexByHeader[name] = idx;
  });

  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    return {
      Email: cols[indexByHeader.Email] ?? '',
      'Employee Name': cols[indexByHeader['Employee Name']] ?? '',
      Asset: cols[indexByHeader.Asset] ?? '',
      Decision: cols[indexByHeader.Decision] ?? '',
      Notes: cols[indexByHeader.Notes] ?? '',
    };
  });
}

export default function MyReviewsPage() {
  const [reviewerEmail, setReviewerEmail] = useState<string | null>(null);
  const [rows, setRows] = useState<ReviewItemRow[]>([]);
  const [employeesByEmail, setEmployeesByEmail] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function loadPage() {
    setLoading(true);
    setError(null);

    const { data: authData, error: authError } = await supabase.auth.getUser();
    const email = authData?.user?.email?.toLowerCase() ?? null;

    if (authError || !email) {
      setError('Unable to identify logged-in user.');
      setLoading(false);
      return;
    }

    setReviewerEmail(email);

    const { data: items, error: itemsError } = await supabase
      .from('review_items')
      .select('id,employee_email,reviewer_email,status,decision,notes,okta_group,asset_id,assets(name,rbac_url)')
      .eq('reviewer_email', email)
      .eq('status', 'pending')
      .order('id', { ascending: false });

    if (itemsError) {
      setError(`Failed loading pending reviews: ${itemsError.message}`);
      setLoading(false);
      return;
    }

    const pendingRows = (items ?? []) as unknown as ReviewItemRow[];
    setRows(pendingRows);

    const employeeEmails = Array.from(new Set(pendingRows.map((item) => item.employee_email.toLowerCase())));
    if (employeeEmails.length > 0) {
      const { data: employees, error: employeesError } = await supabase
        .from('employees')
        .select('email,full_name')
        .in('email', employeeEmails);

      if (!employeesError) {
        const map: Record<string, string> = {};
        (employees as EmployeeRow[]).forEach((employee) => {
          map[employee.email.toLowerCase()] = employee.full_name;
        });
        setEmployeesByEmail(map);
      }
    } else {
      setEmployeesByEmail({});
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadPage();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  const displayRows = useMemo(() => {
    return rows.map((item) => ({
      ...item,
      employee_name: employeesByEmail[item.employee_email.toLowerCase()] ?? item.employee_email,
      is_self_review: reviewerEmail === item.employee_email.toLowerCase(),
      asset_name: item.assets?.[0]?.name ?? 'Unknown Asset',
    }));
  }, [rows, employeesByEmail, reviewerEmail]);

  async function submitDecision(row: ReviewItemRow, decision: 'Approved' | 'Revoked') {
    if (!reviewerEmail) return;

    if (decision === 'Approved' && reviewerEmail === row.employee_email.toLowerCase()) {
      return;
    }

    setBusyId(row.id);
    setError(null);

    const { data, error: invokeError } = await supabase.functions.invoke<SubmitDecisionResponse>('submit-review-decision', {
      body: {
        review_item_id: row.id,
        decision,
        actor_email: reviewerEmail,
      },
    });

    if (invokeError || !data?.success) {
      setError(data?.message ?? invokeError?.message ?? 'Failed submitting decision.');
      setBusyId(null);
      return;
    }

    await loadPage();
    setBusyId(null);
  }

  function handleExportCsv() {
    const csv = toCsv(
      displayRows.map((row) => ({
        email: row.employee_email,
        employeeName: row.employee_name,
        asset: row.asset_name,
        decision: row.decision ?? '',
        notes: row.notes ?? '',
      })),
    );

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `my_reviews_pending_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  async function handleImportCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsedRows = parseCsv(text);

      const keyMap = new Map<string, ReviewItemRow[]>();
      rows.forEach((item) => {
        const key = `${item.employee_email.toLowerCase()}||${(item.assets?.[0]?.name ?? '').toLowerCase()}`;
        const list = keyMap.get(key) ?? [];
        list.push(item);
        keyMap.set(key, list);
      });

      let matched = 0;

      for (const row of parsedRows) {
        const key = `${row.Email.toLowerCase()}||${row.Asset.toLowerCase()}`;
        const candidates = keyMap.get(key) ?? [];
        if (candidates.length === 0) continue;

        const decisionValue = row.Decision.trim();
        const nextDecision = decisionValue === 'Approved' || decisionValue === 'Revoked' ? decisionValue : null;
        const nextNotes = row.Notes.trim() || null;

        for (const item of candidates) {
          const { error: updateError } = await supabase
            .from('review_items')
            .update({ decision: nextDecision, notes: nextNotes })
            .eq('id', item.id);

          if (updateError) {
            throw new Error(`Failed updating review item ${item.id}: ${updateError.message}`);
          }

          matched += 1;
        }
      }
      await loadPage();
      setToast(`CSV import complete. Updated ${matched} pending review item(s).`);
      setError(null);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Failed importing CSV.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">My Reviews</h1>
          <p className="mt-1 text-sm text-slate-600">Pending review items assigned to you.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Import CSV
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleImportCsv}
            className="hidden"
          />
        </div>
      </div>

      {toast ? <p className="mb-3 rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{toast}</p> : null}
      {error ? <p className="mb-3 text-sm text-rose-700">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-slate-600">Loading pending reviews…</p>
      ) : displayRows.length === 0 ? (
        <p className="text-sm text-slate-600">No pending review items assigned to you.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Employee Name</th>
                <th className="px-3 py-2">Asset</th>
                <th className="px-3 py-2">Okta Group</th>
                <th className="px-3 py-2">RBAC URL</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {displayRows.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2 text-slate-900">{row.employee_name}</td>
                  <td className="px-3 py-2 text-slate-700">{row.asset_name}</td>
                  <td className="px-3 py-2 text-slate-700">{row.okta_group ?? '—'}</td>
                  <td className="px-3 py-2">
                    {row.assets?.[0]?.rbac_url ? (
                      <a
                        href={row.assets[0].rbac_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex rounded-full bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                      >
                        Open RBAC
                      </a>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        title={row.is_self_review ? 'Compliance Alert: You cannot audit your own access.' : ''}
                        disabled={row.is_self_review || busyId === row.id}
                        onClick={() => void submitDecision(row, 'Approved')}
                        className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={busyId === row.id}
                        onClick={() => void submitDecision(row, 'Revoked')}
                        className="rounded bg-rose-600 px-2 py-1 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                      >
                        Revoke
                      </button>
                    </div>
                    {row.is_self_review ? (
                      <p className="mt-1 text-xs text-amber-700">Compliance Alert: You cannot audit your own access.</p>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
