import { FormEvent, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type AssetType = 'SSO' | 'Local';

interface AssetRow {
  id: string;
  name: string;
  okta_id: string | null;
  owner_email: string | null;
  login_type: AssetType;
  is_nhi_review: boolean;
  rbac_url: string | null;
  privileged_group_ids: string[] | null;
}

interface CreateAssetForm {
  name: string;
  owner_email: string;
  login_type: AssetType;
  rbac_url: string;
  okta_id: string;
}

interface OktaGroupTreeResponse {
  success: boolean;
  message?: string;
  groups?: Array<{
    id: string;
    name: string;
    description: string;
    users: Array<{
      id: string;
      full_name: string;
      email: string;
    }>;
  }>;
}

const initialForm: CreateAssetForm = {
  name: '',
  owner_email: '',
  login_type: 'SSO',
  rbac_url: '',
  okta_id: '',
};

export default function AssetsPage() {
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<CreateAssetForm>(initialForm);
  const [creating, setCreating] = useState(false);

  const [selectedAsset, setSelectedAsset] = useState<AssetRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [groupTree, setGroupTree] = useState<NonNullable<OktaGroupTreeResponse['groups']>>([]);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  async function loadAssets() {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('assets')
      .select('*')
      .order('name', { ascending: true });

    if (fetchError) {
      setError(`Failed to load assets: ${fetchError.message}`);
      setLoading(false);
      return;
    }

    const normalized = (data ?? []).map((row) => ({
      ...(row as AssetRow),
      privileged_group_ids: Array.isArray((row as AssetRow).privileged_group_ids)
        ? ((row as AssetRow).privileged_group_ids as string[])
        : [],
    }));

    setAssets(normalized);
    setLoading(false);
  }

  useEffect(() => {
    void loadAssets();
  }, []);

  const selectedPrivilegedIds = useMemo(() => {
    return new Set(selectedAsset?.privileged_group_ids ?? []);
  }, [selectedAsset]);

  function closeCreateModal() {
    setShowCreateModal(false);
    setCreateForm(initialForm);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setSelectedAsset(null);
    setGroupTree([]);
    setGroupsError(null);
    setOpenGroups({});
  }

  function updateCreateField<K extends keyof CreateAssetForm>(key: K, value: CreateAssetForm[K]) {
    setCreateForm((current) => ({ ...current, [key]: value }));
  }

  async function handleCreateAsset(event: FormEvent) {
    event.preventDefault();
    setCreating(true);

    const payload = {
      name: createForm.name.trim(),
      owner_email: createForm.owner_email.trim() || null,
      login_type: createForm.login_type,
      rbac_url: createForm.rbac_url.trim() || null,
      okta_id: createForm.okta_id.trim() || null,
      is_nhi_review: false,
      privileged_group_ids: [] as string[],
    };

    const { error: createError } = await supabase.from('assets').insert(payload);

    if (createError) {
      setError(`Failed to create asset: ${createError.message}`);
      setCreating(false);
      return;
    }

    await loadAssets();
    setCreating(false);
    closeCreateModal();
  }

  async function openDeepDive(asset: AssetRow) {
    setSelectedAsset(asset);
    setDrawerOpen(true);
    setGroupsError(null);
    setGroupTree([]);
    setOpenGroups({});

    if (!asset.okta_id) {
      return;
    }

    setGroupsLoading(true);

    const { data, error: invokeError } = await supabase.functions.invoke<OktaGroupTreeResponse>('fetch-okta-groups', {
      body: { okta_id: asset.okta_id },
    });

    if (invokeError || !data?.success) {
      setGroupsError(data?.message ?? invokeError?.message ?? 'Failed to load Okta groups.');
      setGroupsLoading(false);
      return;
    }

    setGroupTree(data.groups ?? []);
    setGroupsLoading(false);
  }

  async function togglePrivilegedGroup(groupId: string, enabled: boolean) {
    if (!selectedAsset) return;

    const current = new Set(selectedAsset.privileged_group_ids ?? []);
    if (enabled) {
      current.add(groupId);
    } else {
      current.delete(groupId);
    }

    const next = Array.from(current);

    const { error: updateError } = await supabase
      .from('assets')
      .update({ privileged_group_ids: next })
      .eq('id', selectedAsset.id);

    if (updateError) {
      setGroupsError(`Failed to update privileged groups: ${updateError.message}`);
      return;
    }

    setSelectedAsset((currentAsset) =>
      currentAsset
        ? {
            ...currentAsset,
            privileged_group_ids: next,
          }
        : currentAsset,
    );

    setAssets((currentAssets) =>
      currentAssets.map((asset) =>
        asset.id === selectedAsset.id
          ? {
              ...asset,
              privileged_group_ids: next,
            }
          : asset,
      ),
    );
  }

  function toggleAccordion(groupId: string) {
    setOpenGroups((current) => ({ ...current, [groupId]: !current[groupId] }));
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Assets</h1>
          <p className="mt-1 text-sm text-slate-600">Manage connected applications and privileged access mappings.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="rounded bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          + Create Asset
        </button>
      </div>

      {error ? <p className="mb-4 text-sm text-rose-700">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-slate-600">Loading assets…</p>
      ) : assets.length === 0 ? (
        <p className="text-sm text-slate-600">No assets yet. Create one to get started.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Owner Email</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">RBAC URL</th>
                <th className="px-3 py-2">Okta ID</th>
                <th className="px-3 py-2">Privileged Groups</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {assets.map((asset) => (
                <tr key={asset.id} className="cursor-pointer hover:bg-slate-50" onClick={() => void openDeepDive(asset)}>
                  <td className="px-3 py-2 font-medium text-slate-900">{asset.name}</td>
                  <td className="px-3 py-2 text-slate-700">{asset.owner_email || '—'}</td>
                  <td className="px-3 py-2 text-slate-700">{asset.login_type}</td>
                  <td className="px-3 py-2 text-slate-700">{asset.rbac_url || '—'}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-700">{asset.okta_id || '—'}</td>
                  <td className="px-3 py-2 text-slate-700">{asset.privileged_group_ids?.length ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreateModal ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-lg">
            <h2 className="text-lg font-semibold text-slate-900">Create Asset</h2>
            <form className="mt-4 space-y-3" onSubmit={handleCreateAsset}>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-700">Name</span>
                <input
                  required
                  value={createForm.name}
                  onChange={(event) => updateCreateField('name', event.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-700">Owner Email</span>
                <input
                  type="email"
                  value={createForm.owner_email}
                  onChange={(event) => updateCreateField('owner_email', event.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-700">Type</span>
                <select
                  value={createForm.login_type}
                  onChange={(event) => updateCreateField('login_type', event.target.value as AssetType)}
                  className="w-full rounded border border-slate-300 px-3 py-2"
                >
                  <option value="SSO">SSO</option>
                  <option value="Local">Local</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-700">RBAC URL</span>
                <input
                  value={createForm.rbac_url}
                  onChange={(event) => updateCreateField('rbac_url', event.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-700">Okta ID</span>
                <input
                  value={createForm.okta_id}
                  onChange={(event) => updateCreateField('okta_id', event.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2"
                />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-70"
                >
                  {creating ? 'Creating…' : 'Create Asset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {drawerOpen && selectedAsset ? (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-xl">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">{selectedAsset.name} Deep Dive</h2>
              <p className="mt-1 text-sm text-slate-600">Okta app groups and memberships.</p>
            </div>
            <button
              type="button"
              onClick={closeDrawer}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
          </div>

          {!selectedAsset.okta_id ? (
            <p className="text-sm text-slate-600">This asset has no Okta ID configured.</p>
          ) : groupsLoading ? (
            <p className="text-sm text-slate-600">Loading Okta groups…</p>
          ) : groupsError ? (
            <p className="text-sm text-rose-700">{groupsError}</p>
          ) : groupTree.length === 0 ? (
            <p className="text-sm text-slate-600">No groups found for this Okta app.</p>
          ) : (
            <div className="space-y-3">
              {groupTree.map((group) => {
                const isOpen = Boolean(openGroups[group.id]);
                const isPrivileged = selectedPrivilegedIds.has(group.id);
                return (
                  <div key={group.id} className="rounded-md border border-slate-200">
                    <div className="flex items-center justify-between gap-2 p-3">
                      <button
                        type="button"
                        onClick={() => toggleAccordion(group.id)}
                        className="text-left"
                      >
                        <p className="text-sm font-semibold text-slate-900">{group.name}</p>
                        <p className="text-xs text-slate-500">{group.id}</p>
                      </button>

                      <label className="flex items-center gap-2 text-xs text-slate-700">
                        <span>Privileged Access</span>
                        <input
                          type="checkbox"
                          checked={isPrivileged}
                          onChange={(event) => void togglePrivilegedGroup(group.id, event.target.checked)}
                        />
                      </label>
                    </div>

                    {isOpen ? (
                      <div className="border-t border-slate-200 p-3">
                        {group.users.length === 0 ? (
                          <p className="text-sm text-slate-600">No users in this group.</p>
                        ) : (
                          <ul className="space-y-2">
                            {group.users.map((user) => {
                              const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&size=64&background=e2e8f0&color=334155`;
                              return (
                                <li key={user.id} className="flex items-center gap-3 rounded border border-slate-200 px-3 py-2">
                                  <img src={avatar} alt={user.full_name} className="h-8 w-8 rounded-full" />
                                  <div>
                                    <p className="text-sm font-medium text-slate-900">{user.full_name}</p>
                                    <p className="text-xs text-slate-600">{user.email || user.id}</p>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
