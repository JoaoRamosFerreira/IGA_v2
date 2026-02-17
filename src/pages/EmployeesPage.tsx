import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type DirectoryTab = 'Employee' | 'Contractor';

interface EmployeeRow {
  id: string;
  email: string;
  full_name: string;
  role: string | null;
  department: string | null;
  manager: string | null;
  status: string | null;
  worker_type: 'Employee' | 'Contractor';
  slack_id: string | null;
  hire_date: string | null;
  end_date: string | null;
}

interface SyncResponse {
  success: boolean;
  message?: string;
  updatedEmployees?: number;
}

export default function EmployeesPage() {
  const [activeTab, setActiveTab] = useState<DirectoryTab>('Employee');
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slackSyncState, setSlackSyncState] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [slackSyncMessage, setSlackSyncMessage] = useState('');

  async function loadEmployees() {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('employees')
      .select('*')
      .order('full_name', { ascending: true });

    if (fetchError) {
      setError(`Failed to load employee directory: ${fetchError.message}`);
      setLoading(false);
      return;
    }

    setRows((data ?? []) as EmployeeRow[]);
    setLoading(false);
  }

  useEffect(() => {
    void loadEmployees();
  }, []);

  const filteredRows = useMemo(
    () => rows.filter((row) => row.worker_type === activeTab),
    [rows, activeTab],
  );

  async function handleSyncSlackIds() {
    setSlackSyncState('running');
    setSlackSyncMessage('Syncing Slack IDs…');

    const { data, error: invokeError } = await supabase.functions.invoke<SyncResponse>('fetch-slack-ids', {
      body: {},
    });

    if (invokeError || !data?.success) {
      setSlackSyncState('error');
      setSlackSyncMessage(data?.message ?? invokeError?.message ?? 'Slack sync failed.');
      return;
    }

    await loadEmployees();

    setSlackSyncState('success');
    setSlackSyncMessage(`Slack ID sync complete. Updated ${data.updatedEmployees ?? 0} records.`);
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Employees</h1>
          <p className="mt-1 text-sm text-slate-600">Directory mirrored from BambooHR and enriched with Slack user IDs.</p>
        </div>
        <button
          type="button"
          onClick={() => void handleSyncSlackIds()}
          disabled={slackSyncState === 'running'}
          className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-70"
        >
          {slackSyncState === 'running' ? 'Syncing…' : 'Sync Slack IDs'}
        </button>
      </div>

      {slackSyncState !== 'idle' ? (
        <p
          className={`mb-4 text-sm ${
            slackSyncState === 'success'
              ? 'text-emerald-700'
              : slackSyncState === 'error'
                ? 'text-rose-700'
                : 'text-indigo-700'
          }`}
        >
          {slackSyncMessage}
        </p>
      ) : null}

      <div className="mb-4 flex gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          className={`rounded-md px-4 py-2 text-sm font-medium ${
            activeTab === 'Employee' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
          }`}
          onClick={() => setActiveTab('Employee')}
        >
          Employees
        </button>
        <button
          type="button"
          className={`rounded-md px-4 py-2 text-sm font-medium ${
            activeTab === 'Contractor' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
          }`}
          onClick={() => setActiveTab('Contractor')}
        >
          Contractors
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-600">Loading directory…</p>
      ) : error ? (
        <p className="text-sm text-rose-700">{error}</p>
      ) : filteredRows.length === 0 ? (
        <p className="text-sm text-slate-600">No records found for this worker type.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Department</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Manager</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Slack ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredRows.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2 font-medium text-slate-900">{row.full_name}</td>
                  <td className="px-3 py-2 text-slate-700">{row.email}</td>
                  <td className="px-3 py-2 text-slate-700">{row.department || '—'}</td>
                  <td className="px-3 py-2 text-slate-700">{row.role || '—'}</td>
                  <td className="px-3 py-2 text-slate-700">{row.manager || '—'}</td>
                  <td className="px-3 py-2 text-slate-700">{row.status || '—'}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-700">{row.slack_id || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
