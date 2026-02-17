import { Link } from 'react-router-dom';

const metrics = [
  {
    label: 'Manual Process',
    value: '~4,000 Hours/Year',
    tone: 'from-rose-50 to-rose-100 text-rose-800',
  },
  {
    label: 'SaaS Cost (e.g. Lumos)',
    value: '$115,200/Year',
    tone: 'from-amber-50 to-amber-100 text-amber-800',
  },
  {
    label: 'This Platform',
    value: '< 500 Hours/Year & $0 License Cost',
    tone: 'from-emerald-50 to-emerald-100 text-emerald-800',
  },
];

const features = [
  'ISO 27001 Compliant Audit Logs',
  'Automated SoD Enforcement',
  'Direct BambooHR/Okta Sync',
];

export default function PocOverviewPage() {
  return (
    <section className="mx-auto max-w-5xl rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
      <header className="border-b border-slate-200 pb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">Executive Summary</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Automated IGA Platform - Build vs. Buy POC</h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-600">
          This proof-of-concept demonstrates how a focused internal IGA platform can reduce review workload,
          remove licensing dependency, and maintain compliance-ready governance controls.
        </p>
      </header>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {metrics.map((metric) => (
          <article
            key={metric.label}
            className={`rounded-lg border border-slate-200 bg-gradient-to-br p-4 ${metric.tone}`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide">{metric.label}</p>
            <p className="mt-2 text-xl font-bold">{metric.value}</p>
          </article>
        ))}
      </div>

      <section className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-5">
        <h2 className="text-lg font-semibold text-slate-900">Core Capabilities Included in this POC</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
          {features.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
      </section>

      <div className="mt-8 flex justify-end">
        <Link
          to="/dashboard"
          className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-indigo-700"
        >
          Start a Campaign
        </Link>
      </div>
    </section>
  );
}
