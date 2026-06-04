export type TrafficKeyword = {
  Name: string;
  Volume: number;
  Cpc: number | null;
  EstimatedValue: number;
};

export type TrafficCountryShare = {
  Country: number;
  CountryCode: string;
  Value: number;
};

export type TrafficCountryRank = {
  Country: number;
  CountryCode: string;
  Rank: number;
};

export type TrafficCountry = {
  UrlCode: string;
  Code: string;
  Name: string;
};

export type TrafficEngagements = {
  BounceRate: string;
  Month: string;
  Year: string;
  Visits: string;
  TimeOnSite: string;
  PagePerVisit: string;
};

export type TrafficEstimatedMonthlyVisits = Record<string, number>;

export type TrafficGlobalRank = {
  Rank: number;
};

export type TrafficSources = {
  Social: number;
  Mail: number;
  Referrals: number;
  Search: number;
  "Paid Referrals": number;
  Direct: number;
};

export type TrafficCategoryRank = {
  Category: string;
  Rank: string;
};

export type TrafficCompetitors = {
  TopSimilarityCompetitors: unknown[];
};

export type TrafficDateData = {
  registration: string;
  expiration: string;
};

export type TrafficApiResponse = {
  Policy: number;
  Description: string;
  Category: string;
  TopKeywords: TrafficKeyword[];
  SiteName: string;
  TopCountryShares: TrafficCountryShare[];
  CountryRank: TrafficCountryRank;
  Countries: TrafficCountry[];
  Title: string;
  Engagments: TrafficEngagements;
  SnapshotDate: string;
  EstimatedMonthlyVisits: TrafficEstimatedMonthlyVisits;
  GlobalRank: TrafficGlobalRank;
  Notification: Record<string, unknown>;
  Version: number;
  IsSmall: boolean;
  TrafficSources: TrafficSources;
  CategoryRank: TrafficCategoryRank;
  LargeScreenshot: string;
  Competitors: TrafficCompetitors;
  IsDataFromGa: boolean;
  DateData: TrafficDateData;
  fromCache: boolean;
};
