import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface RequestPayload {
  okta_id?: string;
}

interface OktaGroup {
  id: string;
  profile?: {
    name?: string;
    description?: string;
  };
}

interface OktaUser {
  id: string;
  profile?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    login?: string;
  };
}

async function oktaGet<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `SSWS ${token}`,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Okta request failed: ${response.status} ${response.statusText}. ${body}`);
  }

  return (await response.json()) as T;
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
    const { okta_id }: RequestPayload = await request.json();
    if (!okta_id) {
      return Response.json(
        { success: false, message: 'Missing okta_id.' },
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
      .select('id,okta_domain,okta_api_token')
      .eq('id', 1)
      .single();

    if (settingsError || !settings?.okta_domain || !settings?.okta_api_token) {
      throw new Error(`Okta settings are incomplete: ${settingsError?.message ?? 'missing domain/token'}`);
    }

    const domain = settings.okta_domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const token = settings.okta_api_token;

    const groups = await oktaGet<OktaGroup[]>(
      `https://${domain}/api/v1/apps/${okta_id}/groups`,
      token,
    );

    const groupTree = [] as Array<{
      id: string;
      name: string;
      description: string;
      users: Array<{ id: string; full_name: string; email: string }>;
    }>;

    for (const group of groups) {
      const users = await oktaGet<OktaUser[]>(
        `https://${domain}/api/v1/groups/${group.id}/users`,
        token,
      );

      groupTree.push({
        id: group.id,
        name: group.profile?.name ?? group.id,
        description: group.profile?.description ?? '',
        users: users.map((user) => {
          const first = user.profile?.firstName ?? '';
          const last = user.profile?.lastName ?? '';
          const email = user.profile?.email ?? user.profile?.login ?? '';
          return {
            id: user.id,
            full_name: `${first} ${last}`.trim() || email || user.id,
            email,
          };
        }),
      });
    }

    return Response.json(
      {
        success: true,
        okta_id,
        groups: groupTree,
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
