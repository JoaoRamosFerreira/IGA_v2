import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

interface ReviewItemRow {
  id: string;
  employee_email: string;
  reviewer_email: string;
  status: 'pending' | 'reviewed';
  okta_group: string | null;
  asset_id: string;
  assets?: Array<{
    name: string;
    rbac_url: string | null;
  }>;
}

interface EmployeeRow {
  email: string;
  full_name: string;
}

interface SubmitDecisionResponse {
  success: boolean;
  message?: string;
}

export default function MyReviewsPage() {
  const [reviewerEmail, setReviewerEmail] = useState<string | null>(null);
  const [rows, setRows] = useState<ReviewItemRow[]>([]);
  const [employeesByEmail, setEmployeesByEmail] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadPage() {
    setLoading(true);
    setError(null);

    const { data: authData, error: authError } = await supabase.auth.getUser();
    const email = authData?.user?.email?.toLowerCase() ?? null;

    if (authError || !email) {
      setError('Unable to identify logged-in user.');
      setLoading(false);
      return;
    }

    setReviewerEmail(email);

    const { data: items, error: itemsError } = await supabase
      .from('review_items')
      .select('id,employee_email,reviewer_email,status,okta_group,asset_id,assets(name,rbac_url)')
      .eq('reviewer_email', email)
      .eq('status', 'pending')
      .order('id', { ascending: false });

    if (itemsError) {
      setError(`Failed loading pending reviews: ${itemsError.message}`);
      setLoading(false);
      return;
    }

    const pendingRows = (items ?? []) as unknown as ReviewItemRow[];
    setRows(pendingRows);

    const employeeEmails = Array.from(new Set(pendingRows.map((item) => item.employee_email.toLowerCase())));
    if (employeeEmails.length > 0) {
      const { data: employees, error: employeesError } = await supabase
        .from('employees')
        .select('email,full_name')
        .in('email', employeeEmails);

      if (!employeesError) {
        const map: Record<string, string> = {};
        (employees as EmployeeRow[]).forEach((employee) => {
          map[employee.email.toLowerCase()] = employee.full_name;
        });
        setEmployeesByEmail(map);
      }
    } else {
      setEmployeesByEmail({});
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadPage();
  }, []);

  const displayRows = useMemo(() => {
    return rows.map((item) => ({
      ...item,
      employee_name: employeesByEmail[item.employee_email.toLowerCase()] ?? item.employee_email,
      is_self_review: reviewerEmail === item.employee_email.toLowerCase(),
    }));
  }, [rows, employeesByEmail, reviewerEmail]);

  async function submitDecision(row: ReviewItemRow, decision: 'Approved' | 'Revoked') {
    if (!reviewerEmail) return;

    if (decision === 'Approved' && reviewerEmail === row.employee_email.toLowerCase()) {
      return;
    }

    setBusyId(row.id);
    setError(null);

    const { data, error: invokeError } = await supabase.functions.invoke<SubmitDecisionResponse>('submit-review-decision', {
      body: {
        review_item_id: row.id,
        decision,
        actor_email: reviewerEmail,
      },
    });

    if (invokeError || !data?.success) {
      setError(data?.message ?? invokeError?.message ?? 'Failed submitting decision.');
      setBusyId(null);
      return;
    }

    await loadPage();
    setBusyId(null);
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-slate-900">My Reviews</h1>
        <p className="mt-1 text-sm text-slate-600">Pending review items assigned to you.</p>
      </div>

      {error ? <p className="mb-3 text-sm text-rose-700">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-slate-600">Loading pending reviews…</p>
      ) : displayRows.length === 0 ? (
        <p className="text-sm text-slate-600">No pending review items assigned to you.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Employee Name</th>
                <th className="px-3 py-2">Asset</th>
                <th className="px-3 py-2">Okta Group</th>
                <th className="px-3 py-2">RBAC URL</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {displayRows.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2 text-slate-900">{row.employee_name}</td>
                  <td className="px-3 py-2 text-slate-700">{row.assets?.[0]?.name ?? 'Unknown Asset'}</td>
                  <td className="px-3 py-2 text-slate-700">{row.okta_group ?? '—'}</td>
                  <td className="px-3 py-2">
                    {row.assets?.[0]?.rbac_url ? (
                      <a
                        href={row.assets[0].rbac_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex rounded-full bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                      >
                        Open RBAC
                      </a>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        title={row.is_self_review ? 'Compliance Alert: You cannot audit your own access.' : ''}
                        disabled={row.is_self_review || busyId === row.id}
                        onClick={() => void submitDecision(row, 'Approved')}
                        className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={busyId === row.id}
                        onClick={() => void submitDecision(row, 'Revoked')}
                        className="rounded bg-rose-600 px-2 py-1 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                      >
                        Revoke
                      </button>
                    </div>
                    {row.is_self_review ? (
                      <p className="mt-1 text-xs text-amber-700">Compliance Alert: You cannot audit your own access.</p>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
