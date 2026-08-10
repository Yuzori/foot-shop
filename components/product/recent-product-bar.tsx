"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

import { FavoriteButton } from "@/components/product/favorite-button";
import { ProductImage } from "@/components/product/product-image";
import { buttonClasses } from "@/components/ui/button";
import { routes } from "@/config/site";
import { useImageAccentColor } from "@/hooks/use-image-accent-color";
import { formatPrice } from "@/lib/format";
import { brandButtonStyle } from "@/lib/brand-button";
import { accentFromProductCover } from "@/lib/image-accent-client";
import { cn } from "@/lib/utils";
import { useRecentProductStore } from "@/store/recent-product-store";
import { useUIStore } from "@/store/ui-store";

const BOTTOM_THRESHOLD_PX = 96;
const NAME_START_COLOR = "#0a0a0a";

function isCheckoutFlow(pathname: string): boolean {
  return pathname.startsWith("/paiement") || pathname.startsWith("/panier");
}

function isNearPageBottom(): boolean {
  if (typeof window === "undefined") return false;
  const { scrollY, innerHeight } = window;
  const docHeight = document.documentElement.scrollHeight;
  return scrollY + innerHeight >= docHeight - BOTTOM_THRESHOLD_PX;
}

export function RecentProductBar() {
  const pathname = usePathname();
  const menuOpen = useUIStore((s) => s.menuOpen);
  const recent = useRecentProductStore((s) => s.recent);
  const hidden = useRecentProductStore((s) => s.hidden);
  const hide = useRecentProductStore((s) => s.hide);
  const [nearBottom, setNearBottom] = useState(false);
  const [nameColor, setNameColor] = useState(NAME_START_COLOR);

  useEffect(() => {
    const update = () => setNearBottom(isNearPageBottom());
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [pathname]);

  const storedAccent = useMemo(
    () => accentFromProductCover(recent?.accent ?? null),
    [recent?.accent],
  );
  const { accent: imageAccent, ready: imageAccentReady } = useImageAccentColor(
    recent?.image,
    { enabled: Boolean(recent?.image) && !recent?.accent },
  );
  const displayAccent = recent?.accent ? storedAccent : imageAccent;
  const accentReady = Boolean(recent?.accent) || imageAccentReady;

  const onSameProduct = recent && pathname === routes.product(recent.id);
  const visible =
    recent &&
    !hidden &&
    !onSameProduct &&
    !menuOpen &&
    !nearBottom &&
    !isCheckoutFlow(pathname);

  useEffect(() => {
    if (!visible || !accentReady || !recent) {
      setNameColor(NAME_START_COLOR);
      return;
    }

    setNameColor(NAME_START_COLOR);
    const timer = window.setTimeout(() => {
      setNameColor(displayAccent.rgb);
    }, 60);

    return () => window.clearTimeout(timer);
  }, [visible, accentReady, recent?.id, displayAccent.rgb]);

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-0 left-0 right-0 z-40 border-t border-ink/10 bg-paper/95 shadow-lift backdrop-blur-md"
        >
          <div className="mx-auto flex max-w-4xl items-center gap-2 px-3 py-2 sm:gap-3 sm:px-4">
            <Link
              href={routes.product(recent.id)}
              className={cn(
                "relative block shrink-0 overflow-hidden rounded-lg",
                "h-12 w-12 sm:h-14 sm:w-14",
              )}
              style={{ boxShadow: `0 0 0 1.5px ${displayAccent.rgb}` }}
              aria-label={recent.name}
            >
              <ProductImage
                src={recent.image}
                alt={recent.name}
                sizes="56px"
                className="!object-contain !p-0.5"
              />
            </Link>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[10px] font-bold uppercase tracking-wide text-ink/45 sm:text-xs">
                Dernier article vu
              </p>
              <Link
                href={routes.product(recent.id)}
                className="group inline-block max-w-full truncate text-xs font-semibold transition-opacity duration-300 hover:opacity-80 sm:text-sm"
              >
                <span
                  key={recent.id}
                  className="block truncate transition-[color] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
                  style={{ color: nameColor }}
                >
                  {recent.name}
                </span>
              </Link>
              <p className="hidden text-xs tabular-nums text-ink/55 sm:block">
                {formatPrice(recent.price, recent.currency)}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <FavoriteButton
                productId={recent.id}
                accentColor={displayAccent.rgb}
                className="!h-8 !w-8 !min-h-8 !min-w-8 border border-ink/10 bg-paper/95 sm:!h-9 sm:!w-9"
              />

              <Link
                href={routes.product(recent.id)}
                className={buttonClasses(
                  "primary",
                  "sm",
                  "whitespace-nowrap px-3 sm:px-4",
                )}
                style={brandButtonStyle(displayAccent)}
              >
                Voir
              </Link>

              <button
                type="button"
                onClick={hide}
                className="shrink-0 rounded-full px-1.5 text-xs text-ink/40 transition-all hover:scale-105 hover:text-ink active:scale-[0.96]"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
