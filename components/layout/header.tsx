import { headerTheme } from "@/config/header-theme";

import { Header as HeaderOriginal } from "@/components/layout/_backup/header.original";
import { HeaderPaint } from "@/components/layout/header-paint";

export function Header() {
  if (headerTheme === "paint") {
    return <HeaderPaint />;
  }
  return <HeaderOriginal />;
}
