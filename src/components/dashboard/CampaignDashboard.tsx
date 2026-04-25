'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { CampaignHeader } from './CampaignHeader';
import { CampaignConfigCard } from './CampaignConfigCard';
import { KpiCard } from './KpiCard';
import { LinkedContentCard } from './LinkedContentCard';
import { CountryTable } from './CountryTable';
import { CampaignLogsTable } from './CampaignLogsTable';
import { CampaignUsersTable } from './CampaignUsersTable';
import { DataTableSurface } from '@/components/ui/data-table-surface';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Campaign } from '@/db/schema';

const ActivitySection = dynamic(
  () => import('./ActivitySection').then((m) => m.ActivitySection),
  {
    loading: () => <div className="h-8 w-full max-w-xs animate-pulse rounded-md bg-muted" />,
  }
);

const TopDomainsChart = dynamic(
  () => import('./TopDomainsChart').then((m) => m.TopDomainsChart),
  {
    loading: () => <div className="min-h-[200px] w-full flex-1 animate-pulse rounded-md bg-muted" />,
  }
);

type LinkedContent =
  | { type: 'ad'; id: string; name: string; description: string | null; imageUrl: string | null; targetUrl: string | null }
  | { type: 'notification'; id: string; title: string; message: string; ctaLink: string | null }
  | {
      type: 'redirect';
      id: string;
      name: string;
      sourceDomain: string;
      includeSubdomains: boolean;
      destinationUrl: string;
    };

interface DashboardData {
  kpis: {
    impressions: number;
    uniqueUsers: number;
  };
  analyticsPeriod: { from: string; to: string };
  chartData: { date: string; impressions: number; users: number }[];
  topDomains: { domain: string; count: number }[];
  countryDistribution: { country: string | null; count: number }[];
  meta: {
    platformDomains: string[];
    countryCodes: string[];
    linkedContent: LinkedContent | null;
  };
}

interface CampaignDashboardProps {
  campaign: Campaign;
  isAdmin: boolean;
  /** Resolved from DB when `campaign.targetListId` is set. */
  targetListSummary: { id: string; name: string } | null;
}

export function CampaignDashboard({ campaign, isAdmin, targetListSummary }: CampaignDashboardProps) {
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/campaigns/${campaign.id}/dashboard`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg = body?.details ?? body?.error ?? 'Failed to fetch dashboard';
          throw new Error(typeof msg === 'string' ? msg : 'Failed to fetch dashboard');
        }
        return body as DashboardData;
      })
      .then((d: DashboardData) => {
        if (!cancelled) setData(d);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load dashboard');
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [campaign.id]);

  const meta = data?.meta ?? {
    platformDomains: [],
    countryCodes: [],
    linkedContent: null,
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <CampaignHeader campaign={campaign} isAdmin={isAdmin} />

      <CampaignConfigCard campaign={campaign} targetList={targetListSummary} />

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-0">
          {error ? (
            <div
              className="flex min-h-[160px] items-center justify-center rounded-lg border border-dashed px-4 text-center text-sm text-muted-foreground"
              role="alert"
            >
              {error}
            </div>
          ) : !data && loading ? (
            <div className="h-24 w-full max-w-2xl rounded-lg bg-muted animate-pulse" />
          ) : data ? (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <KpiCard label="Impressions" value={data.kpis.impressions} />
                <KpiCard label="Unique Users" value={data.kpis.uniqueUsers} />
                <LinkedContentCard linkedContent={meta.linkedContent} isAdmin={isAdmin} campaignType={campaign.campaignType} />
              </div>

              <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-3">
                <section className="flex min-h-0 min-w-0 flex-col lg:col-span-2">
                  {/*
                    Mobile: grid rows are `auto` height — fillHeight charts need a minimum block
                    height or ResponsiveContainer collapses to 0. lg+ restores natural stretch.
                  */}
                  <DataTableSurface
                    variant="embedded"
                    className="flex min-h-[min(52vh,420px)] flex-1 flex-col overflow-hidden lg:min-h-0"
                  >
                    <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-4">
                      <ActivitySection
                        chartData={data.chartData}
                        analyticsPeriod={data.analyticsPeriod}
                        loading={loading}
                        showTitle
                      />
                    </div>
                  </DataTableSurface>
                </section>
                <section className="flex min-h-0 min-w-0 flex-col">
                  <DataTableSurface
                    variant="embedded"
                    className="flex min-h-[280px] flex-1 flex-col overflow-hidden lg:min-h-0"
                  >
                    <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-4">
                      <section className="flex min-h-0 flex-1 flex-col gap-3">
                        <div className="shrink-0 space-y-1.5">
                          <h2 className="text-sm font-medium text-muted-foreground">
                            Top domains
                          </h2>
                          <p className="text-sm leading-relaxed text-muted-foreground">
                            Share of impressions by site for the campaign window (same range as
                            Activity above).
                          </p>
                        </div>
                        <div className="flex min-h-0 flex-1 flex-col">
                          <TopDomainsChart data={data.topDomains} />
                        </div>
                      </section>
                    </div>
                  </DataTableSurface>
                </section>
              </div>

              <section className="space-y-3">
                <h2 className="text-sm font-medium text-muted-foreground">By country</h2>
                <DataTableSurface>
                  <CountryTable data={data.countryDistribution} embedded />
                </DataTableSurface>
              </section>
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="logs" className="mt-0">
          <CampaignLogsTable campaignId={campaign.id} />
        </TabsContent>

        <TabsContent value="users" className="mt-0">
          <CampaignUsersTable campaignId={campaign.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
