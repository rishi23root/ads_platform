import { notFound, redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { database as db } from '@/db';
import { endUsers, payments } from '@/db/schema';
import { getSessionWithRole } from '@/lib/dal';
import { getEndUserDashboardSnapshot } from '@/lib/end-user-dashboard';
import { endUserPublicPayload } from '@/lib/enduser-auth';
import {
  EndUserDetailClient,
  type EndUserDetailInitialUser,
  type EndUserPaymentListItem,
} from '@/components/end-user-detail-client';
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

  const [user] = await db.select().from(endUsers).where(eq(endUsers.id, id)).limit(1);
  if (!user) notFound();

  const [paymentRows, initialDashboard] = await Promise.all([
    db
      .select()
      .from(payments)
      .where(eq(payments.endUserId, id))
      .orderBy(desc(payments.paymentDate), desc(payments.createdAt)),
    getEndUserDashboardSnapshot(id),
  ]);

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
      raw.createdAt instanceof Date ? raw.createdAt.toISOString() : String(raw.createdAt),
    updatedAt:
      raw.updatedAt instanceof Date ? raw.updatedAt.toISOString() : String(raw.updatedAt),
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

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 p-4 md:p-6">
      <Suspense
        fallback={<div className="min-h-[320px] animate-pulse rounded-xl bg-muted/40" aria-hidden />}
      >
        <EndUserDetailClient
          initialUser={initialUser}
          initialPayments={initialPayments}
          initialDashboard={initialDashboard}
          isAdmin={isAdmin}
        />
      </Suspense>
    </div>
  );
}
