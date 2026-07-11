export function StubPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex-1 overflow-auto p-8">
      <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{title}</h1>
      <p className="mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
    </div>
  );
}
