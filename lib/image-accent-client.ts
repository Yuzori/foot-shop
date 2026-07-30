import {
  accentAlpha,
  buildImageAccent,
  DEFAULT_IMAGE_ACCENT,
  type AccentRgb,
  type ImageAccentData,
} from "@/lib/image-accent-core";

export type ImageAccent = ImageAccentData & {
  alpha: (opacity: number) => string;
};

export function toImageAccent(data: ImageAccentData = DEFAULT_IMAGE_ACCENT): ImageAccent {
  return {
    ...data,
    alpha: (opacity: number) => accentAlpha(data, opacity),
  };
}

function isFullAccentData(
  value: ImageAccentData | AccentRgb,
): value is ImageAccentData {
  return "rgb" in value && typeof value.rgb === "string";
}

export function accentFromProductCover(
  coverAccent?: ImageAccentData | AccentRgb | null,
): ImageAccent {
  if (!coverAccent) return toImageAccent(DEFAULT_IMAGE_ACCENT);
  if (isFullAccentData(coverAccent)) return toImageAccent(coverAccent);
  return toImageAccent(buildImageAccent(coverAccent));
}
