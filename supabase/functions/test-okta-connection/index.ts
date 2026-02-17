interface OktaPayload {
  domain?: string;
  apiToken?: string;
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
    const { domain, apiToken }: OktaPayload = await request.json();

    if (!domain || !apiToken) {
      return Response.json(
        { success: false, message: 'Missing domain or apiToken.' },
        { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } },
      );
    }

    const normalizedDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const endpoint = `https://${normalizedDomain}/api/v1/users?limit=1`;

    const oktaResponse = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `SSWS ${apiToken}`,
      },
    });

    if (!oktaResponse.ok) {
      const body = await oktaResponse.text();
      return Response.json(
        {
          success: false,
          message: `Okta test failed: ${oktaResponse.status} ${oktaResponse.statusText}. ${body}`,
        },
        { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } },
      );
    }

    return Response.json(
      { success: true, message: 'Okta credentials are valid.' },
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
