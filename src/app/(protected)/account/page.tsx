import { redirect } from 'next/navigation';
import { getSessionWithRole } from '@/lib/dal';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { AccountSessionsCard } from '@/components/account-sessions-card';
import { AccountPasswordForm } from '@/components/account-password-form';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Account',
};

export const dynamic = 'force-dynamic';

function initialsFromName(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default async function AccountPage() {
  const sessionWithRole = await getSessionWithRole();
  if (!sessionWithRole) redirect('/login');

  const { user, role } = sessionWithRole;
  const displayName = user.name?.trim() || 'Member';
  const initials = initialsFromName(displayName);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 p-4 md:p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Profile, where you are signed in, and password. Sessions and password changes use your
          current sign-in for security.
        </p>
      </header>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border pb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
            <Avatar className="size-14 rounded-xl border border-border shadow-sm">
              <AvatarFallback className="rounded-xl text-base font-medium">
                {initials || '?'}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-lg">{displayName}</CardTitle>
                <Badge
                  variant={role === 'admin' ? 'default' : 'secondary'}
                  className="font-normal capitalize"
                >
                  {role}
                </Badge>
              </div>
              <CardDescription className="text-pretty">
                Dashboard access is tied to this email. Contact an admin if you need a role change.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Email
              </dt>
              <dd className="break-words text-sm font-medium leading-snug">{user.email}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Display name
              </dt>
              <dd className="break-words text-sm font-medium leading-snug">
                {user.name?.trim() || '—'}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <section aria-labelledby="account-security-heading" className="flex flex-col gap-6">
        <div className="space-y-1">
          <h2 id="account-security-heading" className="text-lg font-semibold tracking-tight">
            Security
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage active sessions and your password.
          </p>
        </div>

        <AccountSessionsCard />
        <AccountPasswordForm />
      </section>
    </div>
  );
}
