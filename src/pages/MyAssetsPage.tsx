import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface AssetRow { id: string; name: string; owner_email: string | null; login_type: string; cached_user_count: number | null }

export default function MyAssetsPage() {
  const [rows, setRows] = useState<AssetRow[]>([]);

  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      const email = auth.user?.email?.toLowerCase();
      if (!email) return;
      const { data } = await supabase.from('assets').select('id,name,owner_email,login_type,cached_user_count').eq('owner_email', email);
      setRows((data ?? []) as AssetRow[]);
    }
    void load();
  }, []);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">My Assets</h1>
      <ul className="mt-4 space-y-2 text-sm">{rows.map((r) => <li key={r.id}>{r.name} · {r.login_type} · Users: {r.cached_user_count ?? 0}</li>)}</ul>
    </section>
  );
}
