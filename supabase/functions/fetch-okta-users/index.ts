import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const { group_id } = await req.json();
    if (!group_id) return Response.json({ success: false, message: 'group_id required' }, { status: 400 });

    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data: settings } = await supabase.from('settings').select('okta_domain,okta_api_token').eq('id', 1).single();

    const domain = (settings?.okta_domain ?? '').replace(/^https?:\/\//, '').replace(/\/$/, '');
    const token = settings?.okta_api_token ?? '';

    const response = await fetch(`https://${domain}/api/v1/groups/${group_id}/users`, {
      headers: { Authorization: `SSWS ${token}`, Accept: 'application/json' },
    });
    const users = response.ok ? await response.json() : [];

    return Response.json({ success: true, users });
  } catch (error) {
    return Response.json({ success: false, message: error instanceof Error ? error.message : 'unknown error' }, { status: 500 });
  }
});
