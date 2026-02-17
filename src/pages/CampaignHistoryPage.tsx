import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface CampaignRow { id: string; name: string; status: string; due_date: string }

export default function CampaignHistoryPage() {
  const [rows, setRows] = useState<CampaignRow[]>([]);
  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('campaigns').select('id,name,status,due_date').in('status', ['Closed', 'Overdue']).order('due_date', { ascending: false });
      setRows((data ?? []) as CampaignRow[]);
    }
    void load();
  }, []);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">Campaign History</h1>
      <ul className="mt-4 space-y-2 text-sm">
        {rows.map((r) => <li key={r.id}><Link to={`/campaigns/${r.id}`} className="text-indigo-700">{r.name}</Link> · {r.status}</li>)}
      </ul>
    </section>
  );
}
