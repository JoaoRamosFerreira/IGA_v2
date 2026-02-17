import { FormEvent, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

interface AssetOption {
  id: string;
  name: string;
  okta_id: string | null;
}

type Scope = 'all_assets' | 'selected_assets';

interface GenerateCampaignResponse {
  success: boolean;
  message?: string;
  campaign_id?: string;
  processed_assets?: number;
  created_review_items?: number;
}

export default function DashboardPage() {
  const [showWizard, setShowWizard] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  const [campaignName, setCampaignName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');

  const [scope, setScope] = useState<Scope>('all_assets');
  const [assetSearch, setAssetSearch] = useState('');
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);

  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!showWizard) return;

    async function loadAssets() {
      setAssetsLoading(true);
      const { data, error: fetchError } = await supabase
        .from('assets')
        .select('id,name,okta_id')
        .not('okta_id', 'is', null)
        .order('name', { ascending: true });

      if (fetchError) {
        setError(`Failed loading assets: ${fetchError.message}`);
        setAssetsLoading(false);
        return;
      }

      setAssets((data ?? []) as AssetOption[]);
      setAssetsLoading(false);
    }

    void loadAssets();
  }, [showWizard]);

  const filteredAssets = useMemo(() => {
    const q = assetSearch.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter((asset) => asset.name.toLowerCase().includes(q));
  }, [assetSearch, assets]);

  function toggleAsset(assetId: string) {
    setSelectedAssetIds((current) =>
      current.includes(assetId) ? current.filter((id) => id !== assetId) : [...current, assetId],
    );
  }

  function closeWizard() {
    setShowWizard(false);
    setStep(1);
    setCampaignName('');
    setStartDate('');
    setDueDate('');
    setScope('all_assets');
    setAssetSearch('');
    setSelectedAssetIds([]);
    setError(null);
  }

  async function handleGenerate(event: FormEvent) {
    event.preventDefault();

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const { data, error: invokeError } = await supabase.functions.invoke<GenerateCampaignResponse>('generate-review-campaign', {
      body: {
        name: campaignName,
        start_date: startDate,
        due_date: dueDate,
        scope,
        asset_ids: scope === 'selected_assets' ? selectedAssetIds : [],
      },
    });

    if (invokeError || !data?.success) {
      setError(data?.message ?? invokeError?.message ?? 'Failed generating campaign.');
      setSubmitting(false);
      return;
    }

    setSuccess(
      `Campaign generated. Processed ${data.processed_assets ?? 0} assets and created ${data.created_review_items ?? 0} review items.`,
    );
    setSubmitting(false);
    closeWizard();
  }

  const stepOneValid = Boolean(campaignName.trim() && startDate && dueDate);
  const stepTwoValid = scope === 'all_assets' || selectedAssetIds.length > 0;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">Generate access review campaigns from Okta app membership.</p>
        </div>
        <button
          type="button"
          className="rounded bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          onClick={() => setShowWizard(true)}
        >
          Create Campaign
        </button>
      </div>

      <p className="text-sm text-slate-600">Use the campaign wizard to define dates and asset scope for strict Okta-synced review generation.</p>

      {success ? <p className="mt-4 text-sm text-emerald-700">{success}</p> : null}
      {error ? <p className="mt-4 text-sm text-rose-700">{error}</p> : null}

      {showWizard ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white p-5 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Create Campaign Wizard</h2>
              <button
                type="button"
                onClick={closeWizard}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="mb-4 flex items-center gap-2 text-xs">
              <span className={`rounded px-2 py-1 ${step === 1 ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                Step 1: Dates
              </span>
              <span className={`rounded px-2 py-1 ${step === 2 ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                Step 2: Scope
              </span>
            </div>

            <form onSubmit={handleGenerate} className="space-y-4">
              {step === 1 ? (
                <div className="space-y-3">
                  <label className="block text-sm">
                    <span className="mb-1 block text-slate-700">Campaign Name</span>
                    <input
                      value={campaignName}
                      onChange={(event) => setCampaignName(event.target.value)}
                      className="w-full rounded border border-slate-300 px-3 py-2"
                      placeholder="Q2 Access Review"
                    />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm">
                      <span className="mb-1 block text-slate-700">Start Date</span>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(event) => setStartDate(event.target.value)}
                        className="w-full rounded border border-slate-300 px-3 py-2"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="mb-1 block text-slate-700">Due Date</span>
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(event) => setDueDate(event.target.value)}
                        className="w-full rounded border border-slate-300 px-3 py-2"
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="scope"
                        checked={scope === 'all_assets'}
                        onChange={() => setScope('all_assets')}
                      />
                      <span>All Assets (with Okta ID)</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="scope"
                        checked={scope === 'selected_assets'}
                        onChange={() => setScope('selected_assets')}
                      />
                      <span>Specific Assets</span>
                    </label>
                  </div>

                  {scope === 'selected_assets' ? (
                    <div className="rounded border border-slate-200 p-3">
                      <input
                        value={assetSearch}
                        onChange={(event) => setAssetSearch(event.target.value)}
                        placeholder="Search assets"
                        className="mb-3 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      />

                      {assetsLoading ? (
                        <p className="text-sm text-slate-600">Loading assets…</p>
                      ) : filteredAssets.length === 0 ? (
                        <p className="text-sm text-slate-600">No matching assets.</p>
                      ) : (
                        <ul className="max-h-56 space-y-1 overflow-y-auto">
                          {filteredAssets.map((asset) => (
                            <li key={asset.id}>
                              <label className="flex items-center gap-2 rounded px-2 py-1 hover:bg-slate-50">
                                <input
                                  type="checkbox"
                                  checked={selectedAssetIds.includes(asset.id)}
                                  onChange={() => toggleAsset(asset.id)}
                                />
                                <span className="text-sm text-slate-800">{asset.name}</span>
                              </label>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : null}
                </div>
              )}

              {error ? <p className="text-sm text-rose-700">{error}</p> : null}

              <div className="flex justify-between gap-2 pt-2">
                {step === 2 ? (
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Back
                  </button>
                ) : (
                  <span />
                )}

                {step === 1 ? (
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    disabled={!stepOneValid}
                    className="rounded bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!stepTwoValid || submitting}
                    className="rounded bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {submitting ? 'Generating…' : 'Generate'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
