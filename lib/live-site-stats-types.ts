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

export type LiveCartProduct = {
  name: string;
  quantity: number;
  optionsLabel?: string;
};

export type LiveActiveCart = {
  sessionId: string;
  displayName: string;
  pathname: string;
  products: LiveCartProduct[];
  updatedAt: string;
};

export type LiveSiteStats = {
  activeVisitors: number;
  cartsWithItems: number;
  totalCartLines: number;
  totalCartItems: number;
  activeCarts: LiveActiveCart[];
  updatedAt: string;
};

export type LiveStatsResponse = {
  live: LiveSiteStats;
  recap: SiteStatsRecap;
};
