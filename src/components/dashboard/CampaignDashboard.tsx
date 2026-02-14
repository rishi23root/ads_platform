'use client';

import * as React from 'react';
import { CampaignHeader } from './CampaignHeader';
import { KpiCard } from './KpiCard';
import { LinkedContentCard } from './LinkedContentCard';
import { ActivitySection } from './ActivitySection';
import { TopDomainsChart } from './TopDomainsChart';
import { CountryTable } from './CountryTable';
import { CampaignLogsTable } from './CampaignLogsTable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Campaign } from '@/db/schema';

type LinkedContent =
  | { type: 'ad'; id: string; name: string; description: string | null; imageUrl: string | null; targetUrl: string | null }
  | { type: 'notification'; id: string; title: string; message: string; ctaLink: string | null };

interface DashboardData {
  kpis: {
    impressions: number;
    uniqueUsers: number;
    impressionsChange: number | null;
    usersChange: number | null;
  };
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
}

export function CampaignDashboard({ campaign, isAdmin }: CampaignDashboardProps) {
  const [range, setRange] = React.useState('14d');
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/campaigns/${campaign.id}/dashboard?range=${range}`)
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
  }, [campaign.id, range]);

  if (error) {
    return (
      <div className="flex flex-col gap-4 p-4 md:p-6">
        <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          {error}
        </div>
      </div>
    );
  }

  const meta = data?.meta ?? {
    platformDomains: [],
    countryCodes: [],
    linkedContent: null,
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <CampaignHeader
        campaign={campaign}
        platformDomains={meta.platformDomains}
        countryCodes={meta.countryCodes}
        linkedContent={meta.linkedContent}
        isAdmin={isAdmin}
      />

      {!data && loading ? (
        <div className="h-24 w-full max-w-2xl rounded-lg bg-muted animate-pulse" />
      ) : data ? (
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <KpiCard
                label="Impressions"
                value={data.kpis.impressions}
                change={data.kpis.impressionsChange}
              />
              <KpiCard
                label="Unique Users"
                value={data.kpis.uniqueUsers}
                change={data.kpis.usersChange}
              />
              <LinkedContentCard linkedContent={meta.linkedContent} isAdmin={isAdmin} />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2 py-4 gap-3 [&_[data-slot=card-header]]:px-4 [&_[data-slot=card-content]]:px-4">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base">Activity</CardTitle>
                  <ActivitySection
                    chartData={data.chartData}
                    range={range}
                    onRangeChange={setRange}
                    loading={loading}
                    showRangeOnly
                  />
                </CardHeader>
                <CardContent className="p-0 pt-2">
                  <ActivitySection
                    chartData={data.chartData}
                    range={range}
                    onRangeChange={setRange}
                    loading={loading}
                    showChartOnly
                  />
                </CardContent>
              </Card>
              <Card className="py-4 gap-3 [&_[data-slot=card-header]]:px-4 [&_[data-slot=card-content]]:px-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Top Domains</CardTitle>
                </CardHeader>
                <CardContent className="pt-2">
                  <TopDomainsChart data={data.topDomains} />
                </CardContent>
              </Card>
            </div>

            <section className="space-y-2">
              <h2 className="text-sm font-medium">By Country</h2>
              <CountryTable data={data.countryDistribution} />
            </section>
          </TabsContent>

          <TabsContent value="logs" className="mt-0">
            <CampaignLogsTable campaignId={campaign.id} />
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  );
}
