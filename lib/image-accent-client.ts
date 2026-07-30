import {
  accentAlpha,
  DEFAULT_IMAGE_ACCENT,
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

export function accentFromProductCover(
  coverAccent?: ImageAccentData | null,
): ImageAccent {
  if (coverAccent) return toImageAccent(coverAccent);
  return toImageAccent(DEFAULT_IMAGE_ACCENT);
}
