import { FormEvent, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type Tab = 'integrations' | 'general';

interface SystemSettingsRow {
  id: 1;
  bamboohr_emp_subdomain: string | null;
  bamboohr_emp_api_key: string | null;
  bamboohr_emp_report_id: string | null;
  bamboohr_cont_subdomain: string | null;
  bamboohr_cont_api_key: string | null;
  bamboohr_cont_report_id: string | null;
  okta_domain: string | null;
  okta_api_token: string | null;
  slack_bot_token: string | null;
  nhi_types: string[] | null;
}

interface SettingsFormState {
  bamboohr_emp_subdomain: string;
  bamboohr_emp_report_id: string;
  bamboohr_cont_subdomain: string;
  bamboohr_cont_report_id: string;
  okta_domain: string;
  bamboohr_emp_api_key: string;
  bamboohr_cont_api_key: string;
  okta_api_token: string;
  slack_bot_token: string;
  nhi_types: string[];
}

type TestState = {
  status: 'idle' | 'running' | 'success' | 'error';
  message: string;
};

const initialForm: SettingsFormState = {
  bamboohr_emp_subdomain: '',
  bamboohr_emp_report_id: '',
  bamboohr_cont_subdomain: '',
  bamboohr_cont_report_id: '',
  okta_domain: '',
  bamboohr_emp_api_key: '',
  bamboohr_cont_api_key: '',
  okta_api_token: '',
  slack_bot_token: '',
  nhi_types: [],
};

function tokenHint(value: string | null | undefined): string {
  if (!value) return 'Not configured';
  const suffix = value.slice(-3);
  const mask = '•'.repeat(Math.max(value.length - 3, 6));
  return `${mask}${suffix}`;
}

function StatusMessage({ state }: { state: TestState }) {
  if (state.status === 'idle') return null;
  const color = state.status === 'success' ? 'text-emerald-700' : state.status === 'error' ? 'text-rose-700' : 'text-indigo-700';
  return <p className={`mt-2 text-xs ${color}`}>{state.message}</p>;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('integrations');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<SettingsFormState>(initialForm);
  const [newNhiType, setNewNhiType] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [storedSecrets, setStoredSecrets] = useState({
    bamboohr_emp_api_key: '' as string | null,
    bamboohr_cont_api_key: '' as string | null,
    okta_api_token: '' as string | null,
    slack_bot_token: '' as string | null,
  });

  const [bambooEmpTest, setBambooEmpTest] = useState<TestState>({ status: 'idle', message: '' });
  const [bambooContTest, setBambooContTest] = useState<TestState>({ status: 'idle', message: '' });
  const [oktaTest, setOktaTest] = useState<TestState>({ status: 'idle', message: '' });

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('system_settings')
        .select('*')
        .eq('id', 1)
        .single<SystemSettingsRow>();

      if (fetchError) {
        setError(`Unable to load settings: ${fetchError.message}`);
        setLoading(false);
        return;
      }

      setStoredSecrets({
        bamboohr_emp_api_key: data.bamboohr_emp_api_key,
        bamboohr_cont_api_key: data.bamboohr_cont_api_key,
        okta_api_token: data.okta_api_token,
        slack_bot_token: data.slack_bot_token,
      });

      setForm({
        bamboohr_emp_subdomain: data.bamboohr_emp_subdomain ?? '',
        bamboohr_emp_report_id: data.bamboohr_emp_report_id ?? '',
        bamboohr_cont_subdomain: data.bamboohr_cont_subdomain ?? '',
        bamboohr_cont_report_id: data.bamboohr_cont_report_id ?? '',
        okta_domain: data.okta_domain ?? '',
        bamboohr_emp_api_key: '',
        bamboohr_cont_api_key: '',
        okta_api_token: '',
        slack_bot_token: '',
        nhi_types: data.nhi_types ?? [],
      });

      setLoading(false);
    }

    void load();
  }, []);

  const hasUnsavedTokenChanges = useMemo(() => {
    return Boolean(
      form.bamboohr_emp_api_key || form.bamboohr_cont_api_key || form.okta_api_token || form.slack_bot_token,
    );
  }, [form]);

  function setField<K extends keyof SettingsFormState>(key: K, value: SettingsFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload = {
      id: 1,
      bamboohr_emp_subdomain: form.bamboohr_emp_subdomain.trim() || null,
      bamboohr_emp_report_id: form.bamboohr_emp_report_id.trim() || null,
      bamboohr_cont_subdomain: form.bamboohr_cont_subdomain.trim() || null,
      bamboohr_cont_report_id: form.bamboohr_cont_report_id.trim() || null,
      okta_domain: form.okta_domain.trim() || null,
      bamboohr_emp_api_key: form.bamboohr_emp_api_key.trim() || storedSecrets.bamboohr_emp_api_key || null,
      bamboohr_cont_api_key: form.bamboohr_cont_api_key.trim() || storedSecrets.bamboohr_cont_api_key || null,
      okta_api_token: form.okta_api_token.trim() || storedSecrets.okta_api_token || null,
      slack_bot_token: form.slack_bot_token.trim() || storedSecrets.slack_bot_token || null,
      nhi_types: form.nhi_types,
    };

    const { data, error: updateError } = await supabase
      .from('system_settings')
      .upsert(payload, { onConflict: 'id' })
      .select('*')
      .single<SystemSettingsRow>();

    if (updateError) {
      setError(`Unable to save settings: ${updateError.message}`);
      setSaving(false);
      return;
    }

    setStoredSecrets({
      bamboohr_emp_api_key: data.bamboohr_emp_api_key,
      bamboohr_cont_api_key: data.bamboohr_cont_api_key,
      okta_api_token: data.okta_api_token,
      slack_bot_token: data.slack_bot_token,
    });

    setForm((current) => ({
      ...current,
      bamboohr_emp_api_key: '',
      bamboohr_cont_api_key: '',
      okta_api_token: '',
      slack_bot_token: '',
      nhi_types: data.nhi_types ?? current.nhi_types,
    }));

    setSuccess('Settings saved successfully.');
    setSaving(false);
  }

  async function testBambooConnection(scope: 'employees' | 'contractors') {
    const setState = scope === 'employees' ? setBambooEmpTest : setBambooContTest;
    const subdomain = scope === 'employees' ? form.bamboohr_emp_subdomain.trim() : form.bamboohr_cont_subdomain.trim();
    const reportId = scope === 'employees' ? form.bamboohr_emp_report_id.trim() : form.bamboohr_cont_report_id.trim();
    const apiKeyInput = scope === 'employees' ? form.bamboohr_emp_api_key.trim() : form.bamboohr_cont_api_key.trim();
    const fallbackApiKey = scope === 'employees' ? storedSecrets.bamboohr_emp_api_key : storedSecrets.bamboohr_cont_api_key;
    const apiKey = apiKeyInput || fallbackApiKey || '';

    if (!subdomain || !reportId || !apiKey) {
      setState({
        status: 'error',
        message: `Provide ${scope} subdomain, report ID, and API key before testing.`,
      });
      return;
    }

    setState({ status: 'running', message: 'Testing BambooHR connection…' });

    const { data, error: invokeError } = await supabase.functions.invoke('test-bamboohr-connection', {
      body: { subdomain, apiKey, reportId, scope },
    });

    if (invokeError || !data?.success) {
      setState({
        status: 'error',
        message: data?.message ?? invokeError?.message ?? 'Connection test failed.',
      });
      return;
    }

    setState({ status: 'success', message: data.message ?? 'Connection successful.' });
  }

  async function testOktaConnection() {
    const domain = form.okta_domain.trim();
    const apiToken = form.okta_api_token.trim() || storedSecrets.okta_api_token || '';

    if (!domain || !apiToken) {
      setOktaTest({ status: 'error', message: 'Provide Okta domain and API token before testing.' });
      return;
    }

    setOktaTest({ status: 'running', message: 'Testing Okta connection…' });

    const { data, error: invokeError } = await supabase.functions.invoke('test-okta-connection', {
      body: { domain, apiToken },
    });

    if (invokeError || !data?.success) {
      setOktaTest({
        status: 'error',
        message: data?.message ?? invokeError?.message ?? 'Connection test failed.',
      });
      return;
    }

    setOktaTest({ status: 'success', message: data.message ?? 'Connection successful.' });
  }

  function addNhiType() {
    const next = newNhiType.trim();
    if (!next) return;
    if (form.nhi_types.includes(next)) {
      setNewNhiType('');
      return;
    }
    setForm((current) => ({ ...current, nhi_types: [...current.nhi_types, next] }));
    setNewNhiType('');
  }

  function removeNhiType(item: string) {
    setForm((current) => ({ ...current, nhi_types: current.nhi_types.filter((entry) => entry !== item) }));
  }

  if (loading) {
    return <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">Loading settings…</section>;
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-600">Manage system integrations and general governance settings.</p>
      </div>

      <div className="mb-6 flex gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          className={`rounded-md px-4 py-2 text-sm font-medium ${
            activeTab === 'integrations' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
          }`}
          onClick={() => setActiveTab('integrations')}
        >
          Integrations
        </button>
        <button
          type="button"
          className={`rounded-md px-4 py-2 text-sm font-medium ${
            activeTab === 'general' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
          }`}
          onClick={() => setActiveTab('general')}
        >
          General
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {activeTab === 'integrations' ? (
          <div className="space-y-6">
            <article className="rounded-md border border-slate-200 p-4">
              <h2 className="text-lg font-semibold">BambooHR</h2>
              <div className="mt-4 grid gap-6 md:grid-cols-2">
                <div className="space-y-3 rounded-md border border-slate-200 p-3">
                  <h3 className="font-medium">Employees</h3>
                  <label className="block text-sm">
                    <span className="mb-1 block text-slate-700">Subdomain</span>
                    <input
                      className="w-full rounded border border-slate-300 px-3 py-2"
                      value={form.bamboohr_emp_subdomain}
                      onChange={(event) => setField('bamboohr_emp_subdomain', event.target.value)}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block text-slate-700">API Key</span>
                    <input
                      type="password"
                      className="w-full rounded border border-slate-300 px-3 py-2"
                      value={form.bamboohr_emp_api_key}
                      onChange={(event) => setField('bamboohr_emp_api_key', event.target.value)}
                      placeholder="Enter new key to rotate"
                    />
                    <span className="mt-1 block text-xs text-slate-500">Current: {tokenHint(storedSecrets.bamboohr_emp_api_key)}</span>
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block text-slate-700">Report ID</span>
                    <input
                      className="w-full rounded border border-slate-300 px-3 py-2"
                      value={form.bamboohr_emp_report_id}
                      onChange={(event) => setField('bamboohr_emp_report_id', event.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className="rounded bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-700"
                    onClick={() => void testBambooConnection('employees')}
                    disabled={bambooEmpTest.status === 'running'}
                  >
                    Test Connection
                  </button>
                  <StatusMessage state={bambooEmpTest} />
                </div>

                <div className="space-y-3 rounded-md border border-slate-200 p-3">
                  <h3 className="font-medium">Contractors</h3>
                  <label className="block text-sm">
                    <span className="mb-1 block text-slate-700">Subdomain</span>
                    <input
                      className="w-full rounded border border-slate-300 px-3 py-2"
                      value={form.bamboohr_cont_subdomain}
                      onChange={(event) => setField('bamboohr_cont_subdomain', event.target.value)}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block text-slate-700">API Key</span>
                    <input
                      type="password"
                      className="w-full rounded border border-slate-300 px-3 py-2"
                      value={form.bamboohr_cont_api_key}
                      onChange={(event) => setField('bamboohr_cont_api_key', event.target.value)}
                      placeholder="Enter new key to rotate"
                    />
                    <span className="mt-1 block text-xs text-slate-500">Current: {tokenHint(storedSecrets.bamboohr_cont_api_key)}</span>
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block text-slate-700">Report ID</span>
                    <input
                      className="w-full rounded border border-slate-300 px-3 py-2"
                      value={form.bamboohr_cont_report_id}
                      onChange={(event) => setField('bamboohr_cont_report_id', event.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className="rounded bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-700"
                    onClick={() => void testBambooConnection('contractors')}
                    disabled={bambooContTest.status === 'running'}
                  >
                    Test Connection
                  </button>
                  <StatusMessage state={bambooContTest} />
                </div>
              </div>
            </article>

            <article className="rounded-md border border-slate-200 p-4">
              <h2 className="text-lg font-semibold">Okta</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1 block text-slate-700">Domain</span>
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2"
                    value={form.okta_domain}
                    onChange={(event) => setField('okta_domain', event.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-slate-700">API Token</span>
                  <input
                    type="password"
                    className="w-full rounded border border-slate-300 px-3 py-2"
                    value={form.okta_api_token}
                    onChange={(event) => setField('okta_api_token', event.target.value)}
                    placeholder="Enter new token to rotate"
                  />
                  <span className="mt-1 block text-xs text-slate-500">Current: {tokenHint(storedSecrets.okta_api_token)}</span>
                </label>
              </div>
              <button
                type="button"
                className="mt-3 rounded bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-700"
                onClick={() => void testOktaConnection()}
                disabled={oktaTest.status === 'running'}
              >
                Test Connection
              </button>
              <StatusMessage state={oktaTest} />
            </article>

            <article className="rounded-md border border-slate-200 p-4">
              <h2 className="text-lg font-semibold">Slack</h2>
              <label className="mt-4 block text-sm">
                <span className="mb-1 block text-slate-700">Bot Token</span>
                <input
                  type="password"
                  className="w-full rounded border border-slate-300 px-3 py-2"
                  value={form.slack_bot_token}
                  onChange={(event) => setField('slack_bot_token', event.target.value)}
                  placeholder="Enter new token to rotate"
                />
                <span className="mt-1 block text-xs text-slate-500">Current: {tokenHint(storedSecrets.slack_bot_token)}</span>
              </label>
            </article>
          </div>
        ) : (
          <article className="rounded-md border border-slate-200 p-4">
            <h2 className="text-lg font-semibold">General</h2>
            <p className="mt-1 text-sm text-slate-600">Manage NHI types used during governance reviews.</p>

            <div className="mt-4 flex gap-2">
              <input
                className="w-full rounded border border-slate-300 px-3 py-2"
                value={newNhiType}
                onChange={(event) => setNewNhiType(event.target.value)}
                placeholder="e.g., SOC2"
              />
              <button
                type="button"
                className="rounded bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-700"
                onClick={addNhiType}
              >
                Add
              </button>
            </div>

            <ul className="mt-4 space-y-2">
              {form.nhi_types.map((item) => (
                <li key={item} className="flex items-center justify-between rounded border border-slate-200 px-3 py-2 text-sm">
                  <span>{item}</span>
                  <button
                    type="button"
                    className="rounded bg-rose-50 px-2 py-1 text-xs text-rose-700 hover:bg-rose-100"
                    onClick={() => removeNhiType(item)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </article>
        )}

        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        {success ? <p className="text-sm text-emerald-700">{success}</p> : null}
        {hasUnsavedTokenChanges ? (
          <p className="text-xs text-slate-500">Sensitive credentials entered above will replace currently stored values when saved.</p>
        ) : null}

        <button
          type="submit"
          className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-70"
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </form>
    </section>
  );
}
