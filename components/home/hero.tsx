import { heroTheme } from "@/config/header-theme";

import { Hero as HeroOriginal } from "@/components/home/_backup/hero.original";
import { HeroPaint } from "@/components/home/hero-paint";

export function Hero() {
  if (heroTheme === "paint") {
    return <HeroPaint />;
  }
  return <HeroOriginal />;
}
