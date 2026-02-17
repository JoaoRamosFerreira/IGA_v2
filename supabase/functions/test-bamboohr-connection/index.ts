interface BambooPayload {
  subdomain?: string;
  apiKey?: string;
  reportId?: string;
  scope?: 'employees' | 'contractors';
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
    const { subdomain, apiKey, reportId, scope }: BambooPayload = await request.json();

    if (!subdomain || !apiKey || !reportId) {
      return Response.json(
        { success: false, message: 'Missing subdomain, apiKey, or reportId.' },
        { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } },
      );
    }

    const endpoint = `https://api.bamboohr.com/api/gateway.php/${subdomain}/v1/reports/${reportId}`;
    const auth = btoa(`${apiKey}:x`);

    const bambooResponse = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${auth}`,
      },
    });

    if (!bambooResponse.ok) {
      const body = await bambooResponse.text();
      return Response.json(
        {
          success: false,
          message: `BambooHR test failed (${scope ?? 'unknown'}): ${bambooResponse.status} ${bambooResponse.statusText}. ${body}`,
        },
        { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } },
      );
    }

    return Response.json(
      { success: true, message: `BambooHR ${scope ?? ''} credentials are valid.`.trim() },
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
