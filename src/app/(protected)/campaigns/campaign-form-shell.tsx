export function CampaignFormShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>
      </header>
      {children}
    </div>
  );
}
