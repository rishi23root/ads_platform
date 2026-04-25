import { notFound, redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { database as db } from '@/db';
import { endUsers, payments } from '@/db/schema';
import { getSessionWithRole } from '@/lib/dal';
import { getEndUserDashboardSnapshot } from '@/lib/end-user-dashboard';
import {
  END_USER_ANALYTICS_RANGE_DAYS,
  getEndUserAnalyticsBundle,
} from '@/lib/end-user-analytics';
import { endUserPublicPayload } from '@/lib/enduser-auth';
import {
  EndUserDetailClient,
  type EndUserDetailInitialUser,
  type EndUserPaymentListItem,
} from '@/components/end-user-detail-client';
import type { AnalyticsPayload } from '@/components/end-user-analytics-section';
import type { Metadata } from 'next';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const session = await getSessionWithRole();
  if (!session) {
    return { title: 'User' };
  }

  const { id } = await params;
  const [user] = await db
    .select({ name: endUsers.name, email: endUsers.email, identifier: endUsers.identifier })
    .from(endUsers)
    .where(eq(endUsers.id, id))
    .limit(1);

  if (!user) return { title: 'User' };

  const label = user.name ?? user.email ?? user.identifier ?? 'User';
  return { title: label };
}

export default async function EndUserDetailPage({
  params,
}: PageProps) {
  const sessionWithRole = await getSessionWithRole();
  if (!sessionWithRole) redirect('/login');
  const isAdmin = sessionWithRole.role === 'admin';

  const { id } = await params;
  const viewer = {
    id: sessionWithRole.user.id,
    role: sessionWithRole.role,
  } as const;

  const [userRows, paymentRows, initialDashboard, analyticsBundle] = await Promise.all([
    db.select().from(endUsers).where(eq(endUsers.id, id)).limit(1),
    isAdmin
      ? db
          .select()
          .from(payments)
          .where(eq(payments.endUserId, id))
          .orderBy(desc(payments.paymentDate), desc(payments.createdAt))
      : Promise.resolve([]),
    getEndUserDashboardSnapshot(id, viewer),
    getEndUserAnalyticsBundle(sessionWithRole.role, sessionWithRole.user.id, id, '7d'),
  ]);

  const [user] = userRows;
  if (!user) notFound();

  const raw = endUserPublicPayload(user);
  const initialUser: EndUserDetailInitialUser = {
    id: String(raw.id),
    email: raw.email,
    identifier: raw.identifier,
    name: raw.name,
    plan: String(raw.plan),
    banned: raw.banned,
    country: raw.country,
    startDate:
      raw.startDate instanceof Date ? raw.startDate.toISOString() : String(raw.startDate),
    endDate: raw.endDate
      ? raw.endDate instanceof Date
        ? raw.endDate.toISOString()
        : String(raw.endDate)
      : null,
    createdAt:
      user.createdAt instanceof Date ? user.createdAt.toISOString() : String(user.createdAt),
    updatedAt:
      user.updatedAt instanceof Date ? user.updatedAt.toISOString() : String(user.updatedAt),
  };

  const initialPayments: EndUserPaymentListItem[] = paymentRows.map((p) => ({
    id: p.id,
    endUserId: p.endUserId,
    amount: p.amount,
    currency: p.currency,
    status: p.status,
    description: p.description,
    paymentDate: p.paymentDate.toISOString(),
    createdAt: p.createdAt.toISOString(),
  }));

  const initialAnalytics: AnalyticsPayload = {
    summary: analyticsBundle.summary,
    series: analyticsBundle.series,
    topDomains: analyticsBundle.topDomains,
    range: analyticsBundle.range,
    start: analyticsBundle.start,
    end: analyticsBundle.end,
    rangeDays: END_USER_ANALYTICS_RANGE_DAYS['7d'],
  };

  return (
    <div className="flex w-full min-w-0 flex-col gap-6 px-4 py-4 md:px-6 md:py-6">
      <Suspense
        fallback={<div className="min-h-[320px] animate-pulse rounded-xl bg-muted/40" aria-hidden />}
      >
        <EndUserDetailClient
          initialUser={initialUser}
          initialPayments={initialPayments}
          initialDashboard={initialDashboard}
          initialAnalytics={initialAnalytics}
          isAdmin={isAdmin}
        />
      </Suspense>
    </div>
  );
}
