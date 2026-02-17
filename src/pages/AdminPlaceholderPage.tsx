interface Props { title: string; description: string }

export default function AdminPlaceholderPage({ title, description }: Props) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-slate-600">{description}</p>
    </section>
  );
}
