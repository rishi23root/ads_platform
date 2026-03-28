/** Shared shape for create vs edit campaign form (client-safe). */
export type CampaignFormInitial = {
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
  countryCodes: string[];
  adId: string | null;
  notificationId: string | null;
  redirectId: string | null;
};

export type CampaignFormOptionLists = {
  platforms: { id: string; name: string; domain: string }[];
  adsList: {
    id: string;
    name: string;
    linkedCampaignCount: number;
    imageUrl: string | null;
    description: string | null;
    targetUrl: string | null;
  }[];
  notificationsList: {
    id: string;
    title: string;
    linkedCampaignCount: number;
    message: string;
    ctaLink: string | null;
  }[];
  redirectsList: {
    id: string;
    name: string;
    linkedCampaignCount: number;
    sourceDomain: string;
    destinationUrl: string;
  }[];
};
