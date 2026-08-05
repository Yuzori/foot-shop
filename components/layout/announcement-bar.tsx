import { headerTheme } from "@/config/header-theme";

import { AnnouncementBar as AnnouncementBarOriginal } from "@/components/layout/_backup/announcement-bar.original";
import { AnnouncementBarPaint } from "@/components/layout/announcement-bar-paint";

/** Thin top bar. Static storefront messaging (not product data). */
export function AnnouncementBar() {
  if (headerTheme === "paint") {
    return <AnnouncementBarPaint />;
  }
  return <AnnouncementBarOriginal />;
}
