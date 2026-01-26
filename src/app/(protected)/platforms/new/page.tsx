import { PlatformForm } from '../platform-form';

export default function NewPlatformPage() {
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">New Platform</h1>
        <p className="text-muted-foreground">Create a new advertising platform</p>
      </div>
      <div className="max-w-2xl">
        <PlatformForm mode="create" />
      </div>
    </div>
  );
}
