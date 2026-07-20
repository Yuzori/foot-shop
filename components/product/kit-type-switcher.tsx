"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";

import { ProductImage } from "@/components/product/product-image";
import { routes } from "@/config/site";
import { useImageAccentColor } from "@/hooks/use-image-accent-color";
import { KIT_TYPE_ORDER, type KitType } from "@/lib/kit-type";
import { cn } from "@/lib/utils";

export type KitSwitcherOption = {
  id: string;
  kitType: KitType;
  label: string;
  imageUrl: string | null;
};

interface KitTypeSwitcherProps {
  currentProductId: string;
  options: KitSwitcherOption[];
}

/** Carré actif — emplacement fixe pour éviter les sauts. */
const ACTIVE_SIZE = "h-[4.75rem] w-[4.75rem]";
const INACTIVE_SIZE = "h-[4rem] w-[4rem]";
const SLOT_CLASS = "w-[4.75rem]";

function accentRing(
  accent: ReturnType<typeof useImageAccentColor>,
  strength: "active" | "hover" | "none",
): CSSProperties {
  if (strength === "active") {
    return {
      boxShadow: `0 0 0 2px ${accent.rgb}, 0 0 0 4px ${accent.alpha(0.14)}`,
    };
  }
  if (strength === "hover") {
    return {
      boxShadow: `0 0 0 1.5px ${accent.rgb}, 0 0 0 3px ${accent.alpha(0.1)}`,
    };
  }
  return { boxShadow: "0 0 0 1px rgba(0,0,0,0.07)" };
}

function KitTypeTile({
  option,
  isActive,
}: {
  option: KitSwitcherOption;
  isActive: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const accent = useImageAccentColor(option.imageUrl);

  const ringStrength = isActive ? "active" : hovered ? "hover" : "none";
  const enlarged = isActive || hovered;

  const frame = (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-xl bg-white transition-all duration-300 ease-out",
        enlarged ? ACTIVE_SIZE : INACTIVE_SIZE,
        enlarged ? "grayscale-0 opacity-100" : "grayscale opacity-40",
      )}
      style={accentRing(accent, ringStrength)}
    >
      <ProductImage
        src={option.imageUrl}
        alt={option.label}
        sizes="76px"
        className="!object-contain object-center p-1.5"
      />
    </div>
  );

  const label = (
    <span
      className={cn(
        "mt-2 block text-center text-[10px] font-bold uppercase tracking-[0.14em] transition-colors duration-200",
        isActive ? "text-ink" : "text-ink/35",
        hovered && !isActive && "text-ink/65",
      )}
      style={isActive ? { color: accent.muted } : undefined}
    >
      {option.label}
    </span>
  );

  const body = (
    <div
      className="flex flex-col items-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {frame}
      {label}
    </div>
  );

  if (isActive) {
    return (
      <div className={SLOT_CLASS} aria-current="page">
        {body}
      </div>
    );
  }

  return (
    <Link href={routes.product(option.id)} className={cn(SLOT_CLASS, "block")}>
      {body}
    </Link>
  );
}

/** Domicile / extérieur / third — carrés blancs, ordre fixe, contour couleur maillot. */
export function KitTypeSwitcher({
  currentProductId,
  options,
}: KitTypeSwitcherProps) {
  if (options.length < 2) return null;

  const byType = new Map(options.map((o) => [o.kitType, o]));
  const ordered = KIT_TYPE_ORDER.map((type) => byType.get(type)).filter(
    (o): o is KitSwitcherOption => Boolean(o),
  );

  if (ordered.length < 2) return null;

  return (
    <div>
      <p className="mb-3 text-sm font-bold uppercase tracking-wide">Version</p>
      <div className="flex flex-wrap items-end gap-6 sm:gap-8">
        {ordered.map((option) => (
          <KitTypeTile
            key={option.kitType}
            option={option}
            isActive={option.id === currentProductId}
          />
        ))}
      </div>
    </div>
  );
}
