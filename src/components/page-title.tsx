export function PageTitle({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        {hint && <p className="mt-1 max-w-2xl text-ink-soft">{hint}</p>}
      </div>
      {action}
    </div>
  );
}
