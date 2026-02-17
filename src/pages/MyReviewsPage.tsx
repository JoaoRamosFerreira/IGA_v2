import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

interface ReviewItem {
  id: string;
  asset_id: string;
  employee_email: string;
  reviewer_email: string;
  decision: 'Keep' | 'Revoke' | null;
  status: 'Pending' | 'Reviewed';
  notes: string | null;
  item_type: 'Human' | 'NHI';
}

interface AssetRow { id: string; name: string; login_type: 'SSO' | 'SWA' | 'Empty'; rbac_url: string | null }

export default function MyReviewsPage() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [assets, setAssets] = useState<Record<string, AssetRow>>({});
  const [reviewerEmail, setReviewerEmail] = useState('');
  const [delegateEmail, setDelegateEmail] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  async function load() {
    setError(null);
    const { data: auth } = await supabase.auth.getUser();
    const email = auth.user?.email?.toLowerCase() ?? '';
    setReviewerEmail(email);
    if (!email) return;

    const { data: reviewRows, error: reviewError } = await supabase
      .from('review_items')
      .select('id,asset_id,employee_email,reviewer_email,decision,status,notes,item_type')
      .eq('reviewer_email', email)
      .eq('status', 'Pending');

    if (reviewError) {
      setError(reviewError.message);
      return;
    }

    const pending = (reviewRows ?? []) as ReviewItem[];
    setItems(pending);

    const ids = Array.from(new Set(pending.map((i) => i.asset_id)));
    if (ids.length === 0) {
      setAssets({});
      return;
    }

    const { data: assetRows } = await supabase
      .from('assets')
      .select('id,name,login_type,rbac_url')
      .in('id', ids);

    const map: Record<string, AssetRow> = {};
    (assetRows ?? []).forEach((row) => {
      const r = row as AssetRow;
      map[r.id] = r;
    });
    setAssets(map);
  }

  async function decide(item: ReviewItem, decision: 'Keep' | 'Revoke') {
    const asset = assets[item.asset_id];
    const requiresEvidence = asset?.login_type === 'Empty' || (decision === 'Revoke' && (asset?.login_type === 'SSO' || asset?.login_type === 'SWA') === false);
    if (requiresEvidence && !item.notes?.trim()) {
      setError('Evidence notes are required for direct login app actions.');
      return;
    }

    if (decision === 'Revoke' && (asset?.login_type === 'SSO' || asset?.login_type === 'SWA')) {
      await supabase.functions.invoke('revoke-okta-access', {
        body: { review_item_id: item.id, asset_id: item.asset_id, employee_email: item.employee_email },
      });
    }

    const { error: updateError } = await supabase
      .from('review_items')
      .update({ decision, status: 'Reviewed' })
      .eq('id', item.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    await supabase.from('audit_logs').insert({
      actor_email: reviewerEmail,
      action: 'review_item_decision',
      asset_name: asset?.name ?? 'Unknown',
      target_user: item.employee_email,
      decision,
      metadata: { item_id: item.id },
    });

    await load();
    setToast('Decision saved.');
  }

  async function delegateAll() {
    if (!delegateEmail.trim()) return;
    const { error: delegationError } = await supabase
      .from('review_items')
      .update({ reviewer_email: delegateEmail.toLowerCase() })
      .eq('reviewer_email', reviewerEmail)
      .eq('status', 'Pending');

    if (delegationError) {
      setError(delegationError.message);
      return;
    }

    await supabase.from('audit_logs').insert({
      actor_email: reviewerEmail,
      action: 'review_delegation',
      asset_name: 'N/A',
      target_user: delegateEmail.toLowerCase(),
      decision: null,
    });

    setToast('Reviews delegated successfully.');
    setDelegateEmail('');
    await load();
  }

  const completed = useMemo(() => items.length === 0, [items.length]);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">My Reviews</h1>
      <p className="mt-1 text-sm text-slate-600">Review assigned access items and mark Keep or Revoke.</p>

      <div className="mt-4 flex gap-2">
        <input
          value={delegateEmail}
          onChange={(e) => setDelegateEmail(e.target.value)}
          placeholder="Delegate to reviewer email"
          className="rounded border px-3 py-2 text-sm"
        />
        <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white" onClick={() => void delegateAll()}>
          Delegate Pending
        </button>
      </div>

      {toast ? <p className="mt-3 text-sm text-emerald-700">{toast}</p> : null}
      {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
      {completed ? <p className="mt-4 text-2xl">🎉 All assigned reviews are complete.</p> : null}

      <div className="mt-4 overflow-x-auto rounded border">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Asset</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">RBAC</th>
              <th className="px-3 py-2">Evidence Notes</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const asset = assets[item.asset_id];
              return (
                <tr key={item.id} className="border-t">
                  <td className="px-3 py-2">{item.employee_email}</td>
                  <td className="px-3 py-2">{asset?.name ?? 'Unknown'}</td>
                  <td className="px-3 py-2">{item.item_type}</td>
                  <td className="px-3 py-2">
                    {asset?.rbac_url ? <a className="rounded bg-indigo-50 px-2 py-1 text-xs text-indigo-700" href={asset.rbac_url} target="_blank" rel="noreferrer">RBAC URL</a> : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={item.notes ?? ''}
                      onChange={(e) => setItems((curr) => curr.map((c) => (c.id === item.id ? { ...c, notes: e.target.value } : c)))}
                      className="w-52 rounded border px-2 py-1"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button className="rounded bg-emerald-600 px-2 py-1 text-xs text-white" onClick={() => void decide(item, 'Keep')}>Keep</button>
                      <button className="rounded bg-rose-600 px-2 py-1 text-xs text-white" onClick={() => void decide(item, 'Revoke')}>Revoke</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
