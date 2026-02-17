import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const { review_item_id, employee_email, group_id } = await req.json();
    if (!review_item_id) return Response.json({ success: false, message: 'review_item_id required' }, { status: 400 });

    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data: settings } = await supabase.from('settings').select('okta_domain,okta_api_token,okta_auto_revocation_enabled').eq('id', 1).single();

    if (!settings?.okta_auto_revocation_enabled) {
      return Response.json({ success: true, skipped: true, message: 'Auto-revocation disabled in settings.' });
    }

    const domain = (settings.okta_domain ?? '').replace(/^https?:\/\//, '').replace(/\/$/, '');
    const token = settings.okta_api_token ?? '';

    if (group_id && employee_email) {
      const usersResponse = await fetch(`https://${domain}/api/v1/groups/${group_id}/users`, {
        headers: { Authorization: `SSWS ${token}`, Accept: 'application/json' },
      });
      const users = usersResponse.ok ? await usersResponse.json() : [];
      const user = (users as Array<{ id: string; profile?: { email?: string; login?: string }> }).find(
        (u) => (u.profile?.email ?? u.profile?.login ?? '').toLowerCase() === String(employee_email).toLowerCase(),
      );
      if (user) {
        await fetch(`https://${domain}/api/v1/groups/${group_id}/users/${user.id}`, {
          method: 'DELETE',
          headers: { Authorization: `SSWS ${token}` },
        });
      }
    }

    await supabase.from('audit_logs').insert({
      actor_email: 'system@iga',
      action: 'okta_revoke_access',
      target_user: employee_email ?? null,
      metadata: { review_item_id, group_id },
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ success: false, message: error instanceof Error ? error.message : 'unknown error' }, { status: 500 });
  }
});
