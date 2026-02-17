import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type Decision = 'Approved' | 'Revoked';

interface RequestPayload {
  review_item_id?: string;
  decision?: Decision;
  actor_email?: string;
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

    if (!payload.review_item_id || !payload.actor_email || !payload.decision) {
      return Response.json(
        { success: false, message: 'review_item_id, actor_email and decision are required.' },
        { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } },
      );
    }

    if (!['Approved', 'Revoked'].includes(payload.decision)) {
      return Response.json(
        { success: false, message: 'decision must be Approved or Revoked.' },
        { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in edge environment.');
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: item, error: itemError } = await supabase
      .from('review_items')
      .select('id,status,employee_email,asset_id')
      .eq('id', payload.review_item_id)
      .single();

    if (itemError || !item) {
      throw new Error(`Review item not found: ${itemError?.message ?? 'unknown error'}`);
    }

    if (item.status !== 'pending') {
      return Response.json(
        { success: false, message: 'Review item is no longer pending.' },
        { status: 409, headers: { 'Access-Control-Allow-Origin': '*' } },
      );
    }

    const { data: asset, error: assetError } = await supabase
      .from('assets')
      .select('name')
      .eq('id', item.asset_id)
      .single();

    if (assetError || !asset) {
      throw new Error(`Asset not found for review item: ${assetError?.message ?? 'unknown error'}`);
    }

    const { error: updateError } = await supabase
      .from('review_items')
      .update({ status: 'reviewed', decision: payload.decision })
      .eq('id', payload.review_item_id);

    if (updateError) {
      throw new Error(`Failed updating review item: ${updateError.message}`);
    }

    const { error: auditError } = await supabase.from('audit_logs').insert({
      actor_email: payload.actor_email.toLowerCase(),
      target_user: item.employee_email.toLowerCase(),
      asset_name: asset.name,
      action: 'review_item_decision',
      decision: payload.decision,
    });

    if (auditError) {
      throw new Error(`Failed inserting audit log: ${auditError.message}`);
    }

    return Response.json(
      { success: true },
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
