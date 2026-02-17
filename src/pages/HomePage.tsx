import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">Home</h1>
      <p className="mt-2 text-slate-600">Welcome to the automated IGA platform proof-of-concept workspace.</p>
      <Link to="/campaigns" className="mt-4 inline-block rounded bg-indigo-600 px-4 py-2 text-sm text-white">
        Start a Campaign
      </Link>
    </section>
  );
}
