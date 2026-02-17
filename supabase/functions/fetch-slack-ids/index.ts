import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface SlackUser {
  id: string;
  deleted?: boolean;
  is_bot?: boolean;
  profile?: {
    email?: string;
  };
}

interface SlackUsersListResponse {
  ok: boolean;
  error?: string;
  members?: SlackUser[];
  response_metadata?: {
    next_cursor?: string;
  };
}

function normalizeEmail(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in edge environment.');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: settings, error: settingsError } = await supabase
      .from('system_settings')
      .select('id,slack_bot_token')
      .eq('id', 1)
      .single();

    if (settingsError || !settings?.slack_bot_token) {
      throw new Error(`Unable to load Slack token from settings: ${settingsError?.message ?? 'missing token'}`);
    }

    const token = settings.slack_bot_token;
    const emailToSlackId = new Map<string, string>();
    let cursor = '';

    while (true) {
      const endpoint = new URL('https://slack.com/api/users.list');
      endpoint.searchParams.set('limit', '200');
      if (cursor) endpoint.searchParams.set('cursor', cursor);

      const response = await fetch(endpoint.toString(), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Slack users.list failed: ${response.status} ${response.statusText} ${body}`);
      }

      const payload = (await response.json()) as SlackUsersListResponse;
      if (!payload.ok) {
        throw new Error(`Slack users.list returned error: ${payload.error ?? 'unknown_error'}`);
      }

      for (const user of payload.members ?? []) {
        if (!user.id || user.deleted || user.is_bot) continue;
        const email = normalizeEmail(user.profile?.email);
        if (!email) continue;
        emailToSlackId.set(email, user.id);
      }

      cursor = payload.response_metadata?.next_cursor ?? '';
      if (!cursor) break;
    }

    const { data: employees, error: employeeError } = await supabase.from('employees').select('id,email,slack_id');
    if (employeeError) {
      throw new Error(`Unable to load employees: ${employeeError.message}`);
    }

    const updates = (employees ?? [])
      .map((employee) => {
        const normalizedEmail = normalizeEmail(employee.email);
        const nextSlackId = emailToSlackId.get(normalizedEmail) ?? null;
        if ((employee.slack_id ?? null) === nextSlackId) return null;
        return { id: employee.id, slack_id: nextSlackId };
      })
      .filter((entry): entry is { id: string; slack_id: string | null } => entry !== null);

    if (updates.length > 0) {
      const { error: updateError } = await supabase.from('employees').upsert(updates, { onConflict: 'id' });
      if (updateError) {
        throw new Error(`Failed updating employee slack IDs: ${updateError.message}`);
      }
    }

    return Response.json(
      {
        success: true,
        totalSlackUsersByEmail: emailToSlackId.size,
        updatedEmployees: updates.length,
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
