import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async () => {
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data: settings } = await supabase.from('settings').select('bamboohr_subdomain,bamboohr_api_key').eq('id', 1).single();
    const subdomain = settings?.bamboohr_subdomain ?? '';
    const apiKey = settings?.bamboohr_api_key ?? '';

    const response = await fetch(`https://api.bamboohr.com/api/gateway.php/${subdomain}/v1/meta/fields`, {
      headers: { Authorization: `Basic ${btoa(`${apiKey}:x`)}`, Accept: 'application/json' },
    });
    return Response.json({ success: response.ok, status: response.status });
  } catch (error) {
    return Response.json({ success: false, message: error instanceof Error ? error.message : 'unknown error' }, { status: 500 });
  }
});
