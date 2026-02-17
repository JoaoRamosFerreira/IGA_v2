export default function ChangelogPage() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">Changelog</h1>
      <ul className="mt-4 list-disc pl-6 text-sm text-slate-700">
        <li>Auth + admin approval workflow scaffolded.</li>
        <li>Campaign/review data model and navigation redesigned per prompt set.</li>
        <li>Integration edge function stubs aligned for Okta, BambooHR, Google Sheets, Slack, and scheduler jobs.</li>
      </ul>
    </section>
  );
}
