export type RecapPeriod = "day" | "week" | "month" | "year" | "all";

export type SiteStatsRecap = {
  period: RecapPeriod;
  label: string;
  from: string;
  to: string;
  uniqueVisitors: number;
  visitorsWithCart: number;
  totalCartItems: number;
  totalCartLines: number;
};

export type LiveSiteStats = {
  activeVisitors: number;
  cartsWithItems: number;
  totalCartLines: number;
  totalCartItems: number;
  updatedAt: string;
};

export type LiveStatsResponse = {
  live: LiveSiteStats;
  recap: SiteStatsRecap;
};
