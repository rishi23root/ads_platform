import { unauthorized } from 'next/navigation';
import { getSessionWithRole } from '@/lib/dal';
import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { KBarProviderWrapper } from '@/components/kbar-provider';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessionWithRole = await getSessionWithRole();

  if (!sessionWithRole) {
    unauthorized();
  }

  const { user, role } = sessionWithRole;

  return (
    <KBarProviderWrapper role={role}>
      <SidebarProvider
        style={
          {
            '--sidebar-width': 'calc(var(--spacing) * 72)',
            '--header-height': 'calc(var(--spacing) * 12)',
          } as React.CSSProperties
        }
      >
        <AppSidebar variant="inset" user={{ name: user.name ?? 'User', email: user.email, avatar: user.image ?? undefined }} role={role} />
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-1 flex-col min-h-0">
            <div className="@container/main scrollbar-thin flex flex-1 flex-col gap-2 min-h-0 overflow-y-auto">
              {children}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </KBarProviderWrapper>
  );
}
