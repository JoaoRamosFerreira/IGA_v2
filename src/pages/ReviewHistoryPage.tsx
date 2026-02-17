import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface CampaignRow {
  id: string;
  name: string;
  start_date: string;
  due_date: string;
  status: 'active' | 'completed';
}

interface AuditLogRow {
  id: number;
  timestamp: string;
  actor_email: string;
  target_user: string;
  asset_name: string;
  action: string;
  decision: string | null;
}

function toCsv(rows: AuditLogRow[]): string {
  const header = ['id', 'timestamp', 'actor_email', 'target_user', 'asset_name', 'action', 'decision'];
  const escape = (value: string | number | null) => {
    const text = value === null ? '' : String(value);
    return `"${text.split('"').join('""')}"`;
  };

  const lines = [header.join(',')];
  for (const row of rows) {
    lines.push(
      [row.id, row.timestamp, row.actor_email, row.target_user, row.asset_name, row.action, row.decision]
        .map(escape)
        .join(','),
    );
  }
  return lines.join('\n');
}

export default function ReviewHistoryPage() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  async function loadHistory() {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('review_campaigns')
      .select('id,name,start_date,due_date,status')
      .eq('status', 'completed')
      .order('due_date', { ascending: false });

    if (fetchError) {
      setError(`Failed loading campaign history: ${fetchError.message}`);
      setLoading(false);
      return;
    }

    setCampaigns((data ?? []) as CampaignRow[]);
    setLoading(false);
  }

  useEffect(() => {
    void loadHistory();
  }, []);

  async function exportAuditReport() {
    setExporting(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('audit_logs')
      .select('id,timestamp,actor_email,target_user,asset_name,action,decision')
      .order('timestamp', { ascending: false });

    if (fetchError) {
      setError(`Failed exporting audit logs: ${fetchError.message}`);
      setExporting(false);
      return;
    }

    const csv = toCsv((data ?? []) as AuditLogRow[]);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);

    setExporting(false);
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Review History</h1>
          <p className="mt-1 text-sm text-slate-600">Completed campaigns and immutable audit trail exports.</p>
        </div>
        <button
          type="button"
          onClick={() => void exportAuditReport()}
          disabled={exporting}
          className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
        >
          {exporting ? 'Exporting…' : 'Export Audit Report'}
        </button>
      </div>

      {error ? <p className="mb-3 text-sm text-rose-700">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-slate-600">Loading completed campaigns…</p>
      ) : campaigns.length === 0 ? (
        <p className="text-sm text-slate-600">No completed campaigns yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Campaign</th>
                <th className="px-3 py-2">Start Date</th>
                <th className="px-3 py-2">Due Date</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {campaigns.map((campaign) => (
                <tr key={campaign.id}>
                  <td className="px-3 py-2 font-medium text-slate-900">{campaign.name}</td>
                  <td className="px-3 py-2 text-slate-700">{campaign.start_date}</td>
                  <td className="px-3 py-2 text-slate-700">{campaign.due_date}</td>
                  <td className="px-3 py-2 text-slate-700">{campaign.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
