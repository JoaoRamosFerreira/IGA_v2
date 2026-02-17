import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type Scope = 'all_assets' | 'selected_assets';

interface RequestPayload {
  name?: string;
  start_date?: string;
  due_date?: string;
  scope?: Scope;
  asset_ids?: string[];
}

interface AssetRow {
  id: string;
  name: string;
  okta_id: string | null;
  owner_email: string | null;
}

interface OktaGroup {
  id: string;
  profile?: {
    name?: string;
  };
}

interface OktaUser {
  id: string;
  profile?: {
    email?: string;
    login?: string;
  };
}

function hasValidDate(value: string | undefined): value is string {
  if (!value) return false;
  return !Number.isNaN(new Date(value).getTime());
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
    throw new Error(`Okta API failed: ${response.status} ${response.statusText}. ${body}`);
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
    const payload = (await request.json()) as RequestPayload;
    const scope = payload.scope ?? 'all_assets';

    if (!payload.name?.trim()) {
      return Response.json({ success: false, message: 'Campaign name is required.' }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    if (!hasValidDate(payload.start_date) || !hasValidDate(payload.due_date)) {
      return Response.json({ success: false, message: 'Valid start_date and due_date are required.' }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    if (scope === 'selected_assets' && (!payload.asset_ids || payload.asset_ids.length === 0)) {
      return Response.json({ success: false, message: 'Provide at least one asset_id when using selected_assets scope.' }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in edge environment.');
    }

    const supabase = createClient(supabaseUrl, serviceKey);

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

    let assetQuery = supabase.from('assets').select('id,name,okta_id,owner_email').not('okta_id', 'is', null);
    if (scope === 'selected_assets') {
      assetQuery = assetQuery.in('id', payload.asset_ids ?? []);
    }

    const { data: assets, error: assetsError } = await assetQuery;
    if (assetsError) {
      throw new Error(`Failed to load assets for campaign: ${assetsError.message}`);
    }

    const strictAssets = (assets ?? []) as AssetRow[];

    const { data: campaign, error: campaignError } = await supabase
      .from('review_campaigns')
      .insert({
        name: payload.name.trim(),
        start_date: payload.start_date,
        due_date: payload.due_date,
        status: 'active',
      })
      .select('id,name')
      .single();

    if (campaignError || !campaign) {
      throw new Error(`Failed creating campaign: ${campaignError?.message ?? 'unknown error'}`);
    }

    const reviewItems: Array<{
      campaign_id: string;
      asset_id: string;
      employee_email: string;
      reviewer_email: string;
      status: 'pending';
      okta_group: string;
    }> = [];

    for (const asset of strictAssets) {
      if (!asset.okta_id || !asset.owner_email) continue;

      const groups = await oktaGet<OktaGroup[]>(`https://${domain}/api/v1/apps/${asset.okta_id}/groups`, token);

      for (const group of groups) {
        const groupName = group.profile?.name ?? group.id;
        const users = await oktaGet<OktaUser[]>(`https://${domain}/api/v1/groups/${group.id}/users`, token);

        for (const user of users) {
          const email = user.profile?.email ?? user.profile?.login;
          if (!email) continue;
          reviewItems.push({
            campaign_id: campaign.id,
            asset_id: asset.id,
            employee_email: email.toLowerCase(),
            reviewer_email: asset.owner_email,
            status: 'pending',
            okta_group: groupName,
          });
        }
      }
    }

    if (reviewItems.length > 0) {
      const { error: itemsError } = await supabase.from('review_items').insert(reviewItems);
      if (itemsError) {
        throw new Error(`Failed creating review_items: ${itemsError.message}`);
      }
    }

    return Response.json(
      {
        success: true,
        campaign_id: campaign.id,
        processed_assets: strictAssets.length,
        created_review_items: reviewItems.length,
      },
      { headers: { 'Access-Control-Allow-Origin': '*' } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ success: false, message }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
});
