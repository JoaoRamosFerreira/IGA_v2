import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const { okta_id } = await req.json();
    if (!okta_id) return Response.json({ success: false, message: 'okta_id required' }, { status: 400 });

    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data: settings } = await supabase.from('settings').select('okta_domain,okta_api_token').eq('id', 1).single();
    const domain = (settings?.okta_domain ?? '').replace(/^https?:\/\//, '').replace(/\/$/, '');
    const token = settings?.okta_api_token ?? '';

    const groupRes = await fetch(`https://${domain}/api/v1/apps/${okta_id}/groups`, {
      headers: { Authorization: `SSWS ${token}`, Accept: 'application/json' },
    });
    const groups = groupRes.ok ? await groupRes.json() : [];

    const mapped = [] as Array<{ id: string; name: string; users: Array<{ id: string; email: string }> }>;
    for (const group of groups as Array<{ id: string; profile?: { name?: string } }>) {
      const userRes = await fetch(`https://${domain}/api/v1/groups/${group.id}/users`, {
        headers: { Authorization: `SSWS ${token}`, Accept: 'application/json' },
      });
      const users = userRes.ok ? await userRes.json() : [];
      mapped.push({
        id: group.id,
        name: group.profile?.name ?? group.id,
        users: (users as Array<{ id: string; profile?: { email?: string; login?: string } }>).map((u) => ({
          id: u.id,
          email: u.profile?.email ?? u.profile?.login ?? '',
        })),
      });
    }

    return Response.json({ success: true, groups: mapped });
  } catch (error) {
    return Response.json({ success: false, message: error instanceof Error ? error.message : 'unknown error' }, { status: 500 });
  }
});
