'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { IconLoader2, IconX, IconInfoCircle, IconPlus } from '@tabler/icons-react';
import { toast } from 'sonner';
import { COUNTRIES } from '@/lib/countries';
import { PlatformAddDrawer } from '@/components/platform-add-drawer';

type CampaignType = 'ads' | 'popup' | 'notification';
type FrequencyType = 'full_day' | 'time_based' | 'only_once' | 'always' | 'specific_count';
type TargetAudience = 'new_users' | 'all_users';

type CampaignStatus = 'active' | 'inactive' | 'scheduled' | 'expired';

interface CampaignFormProps {
  campaign?: {
    id: string;
    name: string;
    targetAudience: string;
    campaignType: string;
    frequencyType: string;
    frequencyCount: number | null;
    timeStart: string | null;
    timeEnd: string | null;
    status: string;
    startDate: string | null;
    endDate: string | null;
    platformIds: string[];
    countryCodes?: string[];
    adId: string | null;
    notificationId: string | null;
  };
  platforms: { id: string; name: string; domain: string }[];
  adsList: { id: string; name: string }[];
  notificationsList: { id: string; title: string }[];
  mode: 'create' | 'edit';
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-medium text-foreground tracking-tight">
      {children}
    </h3>
  );
}

function InfoHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 rounded-md border border-l-4 border-l-primary/50 bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
      <IconInfoCircle className="h-4 w-4 shrink-0 opacity-70" />
      <span>{children}</span>
    </div>
  );
}

function MultiSelectContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-2 rounded-lg border border-input/80 bg-muted/20 p-3 min-h-12">
      {children}
    </div>
  );
}

export function CampaignForm({
  campaign,
  platforms,
  adsList,
  notificationsList,
  mode,
}: CampaignFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState(campaign?.name ?? '');
  const [targetAudience, setTargetAudience] = useState<TargetAudience>((campaign?.targetAudience as TargetAudience) ?? 'all_users');
  const [campaignType, setCampaignType] = useState<CampaignType>((campaign?.campaignType as CampaignType) ?? 'ads');
  const handleCampaignTypeChange = (v: CampaignType) => {
    setCampaignType(v);
    if (v === 'notification') setPlatformIds([]);
  };
  const [frequencyType, setFrequencyType] = useState<FrequencyType>((campaign?.frequencyType as FrequencyType) ?? 'always');
  const [frequencyCount, setFrequencyCount] = useState(campaign?.frequencyCount?.toString() ?? '');
  const [timeStart, setTimeStart] = useState(campaign?.timeStart ?? '');
  const [timeEnd, setTimeEnd] = useState(campaign?.timeEnd ?? '');
  const [platformIds, setPlatformIds] = useState<string[]>(campaign?.platformIds ?? []);
  const [countryCodes, setCountryCodes] = useState<string[]>(campaign?.countryCodes ?? []);
  const [adId, setAdId] = useState<string>(campaign?.adId ?? '');
  const [notificationId, setNotificationId] = useState<string>(campaign?.notificationId ?? '');
  const [status, setStatus] = useState<CampaignStatus>((campaign?.status as CampaignStatus) ?? 'inactive');
  const [startDate, setStartDate] = useState(
    campaign?.startDate ? new Date(campaign.startDate).toISOString().slice(0, 16) : ''
  );
  const [endDate, setEndDate] = useState(
    campaign?.endDate ? new Date(campaign.endDate).toISOString().slice(0, 16) : ''
  );
  const [addPlatformDrawerOpen, setAddPlatformDrawerOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation: at least one domain (platform) - not required for notifications

    if (campaignType !== 'notification' && !platformIds.length) {
      toast.error('Select at least one domain (platform)');
      return;
    }

    // Validation: at least one content item based on campaign type
    if (campaignType === 'ads' || campaignType === 'popup') {
      if (!adId?.trim()) {
        toast.error(`Select an ${campaignType === 'popup' ? 'pop up' : 'ad'}`);
        return;
      }
    } else if (campaignType === 'notification') {
      if (!notificationId?.trim()) {
        toast.error('Select a notification');
        return;
      }
    }

    setIsLoading(true);
    try {
      const url = mode === 'create' ? '/api/campaigns' : `/api/campaigns/${campaign?.id}`;
      const method = mode === 'create' ? 'POST' : 'PUT';
      const body = {
        name,
        targetAudience,
        campaignType,
        frequencyType,
        frequencyCount: frequencyCount ? parseInt(frequencyCount, 10) : null,
        timeStart: timeStart || null,
        timeEnd: timeEnd || null,
        status,
        startDate: startDate || null,
        endDate: endDate || null,
        platformIds: campaignType === 'notification' ? [] : platformIds,
        countryCodes,
        adId: (campaignType === 'ads' || campaignType === 'popup') ? adId || null : null,
        notificationId: campaignType === 'notification' ? notificationId || null : null,
      };
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to save campaign');
      toast.success(mode === 'create' ? 'Campaign created' : 'Campaign updated');
      const targetId = mode === 'create' ? data.id : campaign?.id;
      router.push(targetId ? `/campaigns/${targetId}` : '/campaigns');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewPlatformCreated = (newPlatform: { id: string; name: string; domain: string }) => {
    setPlatformIds((prev) => [...prev, newPlatform.id]);
    router.refresh();
  };

  return (
    <>
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <SectionTitle>Basic Info</SectionTitle>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required disabled={isLoading} />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Target audience</Label>
                    <Select value={targetAudience} onValueChange={(v) => setTargetAudience(v as TargetAudience)}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all_users">All users</SelectItem>
                        <SelectItem value="new_users">New users (within 7 days)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Campaign type</Label>
                    <Select value={campaignType} onValueChange={(v) => handleCampaignTypeChange(v as CampaignType)}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ads">Ads</SelectItem>
                        <SelectItem value="popup">Popup</SelectItem>
                        <SelectItem value="notification">Notification</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={status} onValueChange={(v) => setStatus(v as CampaignStatus)}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Schedule & Frequency */}
            <div className="space-y-4">
              <SectionTitle>Schedule & Frequency</SectionTitle>
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Frequency</Label>
                    <Select value={frequencyType} onValueChange={(v) => setFrequencyType(v as FrequencyType)}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="always">Always</SelectItem>
                        <SelectItem value="full_day">Full day</SelectItem>
                        <SelectItem value="time_based">Time based</SelectItem>
                        <SelectItem value="only_once">Only once</SelectItem>
                        <SelectItem value="specific_count">Specific count</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {frequencyType === 'specific_count' && (
                  <div className="space-y-2 max-w-xs">
                    <Label htmlFor="frequencyCount">Max views per visitor</Label>
                    <Input
                      id="frequencyCount"
                      type="number"
                      min={1}
                      value={frequencyCount}
                      onChange={(e) => setFrequencyCount(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                )}

                {frequencyType === 'time_based' && (
                  <div className="grid grid-cols-2 gap-4 max-w-md">
                    <div className="space-y-2">
                      <Label htmlFor="timeStart">Start time</Label>
                      <Input
                        id="timeStart"
                        type="time"
                        value={timeStart}
                        onChange={(e) => setTimeStart(e.target.value)}
                        disabled={isLoading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="timeEnd">End time</Label>
                      <Input
                        id="timeEnd"
                        type="time"
                        value={timeEnd}
                        onChange={(e) => setTimeEnd(e.target.value)}
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start date & time</Label>
                    <Input
                      id="startDate"
                      type="datetime-local"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">End date & time</Label>
                    <Input
                      id="endDate"
                      type="datetime-local"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Targeting */}
            <div className="space-y-4">
              <SectionTitle>Targeting</SectionTitle>
              <div className="space-y-4">
                {campaignType !== 'notification' && (
                <div className="space-y-2">
                  <Label>Targeted websites (platforms) *</Label>
                  <MultiSelectContainer>
                    {platformIds.map((id) => {
                      const p = platforms.find((x) => x.id === id);
                      return (
                        <Badge key={id} variant="secondary" className="gap-1 pr-1 py-1.5">
                          {p?.name ?? id}
                          <button type="button" onClick={() => setPlatformIds((prev) => prev.filter((x) => x !== id))} className="rounded-full p-0.5 hover:bg-muted transition-colors" aria-label="Remove">
                            <IconX className="h-3 w-3" />
                          </button>
                        </Badge>
                      );
                    })}
                    <Select
                      value=""
                      onValueChange={(v) => {
                        if (!v) return;
                        if (v === '__add_new__') {
                          setAddPlatformDrawerOpen(true);
                          return;
                        }
                        if (!platformIds.includes(v)) setPlatformIds((prev) => [...prev, v]);
                      }}
                    >
                      <SelectTrigger className="w-[180px] h-8 border-dashed"><SelectValue placeholder="Add platform" /></SelectTrigger>
                      <SelectContent>
                        {platforms.filter((p) => !platformIds.includes(p.id)).map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                        <SelectItem value="__add_new__" className="text-primary font-medium">
                          <span className="flex items-center gap-2">
                            <IconPlus className="h-4 w-4" />
                            Add new
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </MultiSelectContainer>
                </div>
                )}
                {campaignType === 'notification' && (
                  <InfoHint>Notifications are served everywhere — no domain restriction.</InfoHint>
                )}
                <div className="space-y-2">
                  <Label>Countries to serve</Label>
                  <InfoHint>Leave empty to serve in all countries</InfoHint>
                  <MultiSelectContainer>
                    {countryCodes.map((code) => {
                      const country = COUNTRIES.find((c) => c.code === code);
                      return (
                        <Badge key={code} variant="secondary" className="gap-1 pr-1 py-1.5">
                          {country ? `${country.name} (${code})` : code}
                          <button type="button" onClick={() => setCountryCodes((prev) => prev.filter((c) => c !== code))} className="rounded-full p-0.5 hover:bg-muted transition-colors" aria-label="Remove">
                            <IconX className="h-3 w-3" />
                          </button>
                        </Badge>
                      );
                    })}
                    <Select
                      value=""
                      onValueChange={(v) => { if (v && !countryCodes.includes(v)) setCountryCodes((prev) => [...prev, v]); }}
                    >
                      <SelectTrigger className="w-[200px] h-8 border-dashed"><SelectValue placeholder="Add country" /></SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.filter((c) => !countryCodes.includes(c.code)).map((c) => (
                          <SelectItem key={c.code} value={c.code}>{c.name} ({c.code})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </MultiSelectContainer>
                </div>
              </div>
            </div>

            {(campaignType === 'ads' || campaignType === 'popup' || campaignType === 'notification') && (
              <>
                <Separator />
                {/* Content */}
                <div className="space-y-4">
                  <SectionTitle>Content</SectionTitle>
                  {(campaignType === 'ads' || campaignType === 'popup') && (
                    <div className="space-y-2">
                      <Label>{campaignType === 'popup' ? 'Pop up' : 'Ad'} *</Label>
                      <Select value={adId} onValueChange={setAdId}>
                        <SelectTrigger className="w-full max-w-md"><SelectValue placeholder="Select ad" /></SelectTrigger>
                        <SelectContent>
                          {adsList.map((a) => (
                            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {campaignType === 'notification' && (
                    <div className="space-y-2">
                      <Label>Notification *</Label>
                      <Select value={notificationId} onValueChange={setNotificationId}>
                        <SelectTrigger className="w-full max-w-md"><SelectValue placeholder="Select notification" /></SelectTrigger>
                        <SelectContent>
                          {notificationsList.map((n) => (
                            <SelectItem key={n.id} value={n.id}>{n.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </>
            )}

            <Separator />

            {/* Actions */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
                {isLoading && <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === 'create' ? 'Create' : 'Update'}
              </Button>
              <Link
                href="/campaigns"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors text-center"
              >
                Cancel
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
      <PlatformAddDrawer
        open={addPlatformDrawerOpen}
        onOpenChange={setAddPlatformDrawerOpen}
        onSuccess={handleNewPlatformCreated}
      />
    </>
  );
}
