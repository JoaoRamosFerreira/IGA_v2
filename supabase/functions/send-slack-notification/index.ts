import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const { channel, text } = await req.json();
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data: settings } = await supabase.from('settings').select('slack_bot_token').eq('id', 1).single();
    const token = settings?.slack_bot_token ?? '';

    const result = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, text }),
    });

    return Response.json({ success: result.ok });
  } catch (error) {
    return Response.json({ success: false, message: error instanceof Error ? error.message : 'unknown error' }, { status: 500 });
  }
});
