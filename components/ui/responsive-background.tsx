import { cn } from "@/lib/utils";

interface ResponsiveBackgroundProps {
  /** Desktop image, e.g. "/bkd.jpg". The mobile variant is derived as
   *  "/bkd-tel.jpg" automatically (override with `mobileSrc`). */
  src: string;
  mobileSrc?: string;
  className?: string;
}

function withTelSuffix(src: string): string {
  return src.replace(/(\.[a-z0-9]+)$/i, "-tel$1");
}

/**
 * Two-layer background that serves a dedicated phone image on small screens so
 * backgrounds are never awkwardly cropped. Drop your files in `public/`:
 *   /bkd.jpg + /bkd-tel.jpg, /bkd2.jpg + /bkd2-tel.jpg, etc.
 * Missing files simply show nothing (the parent's base color remains).
 */
export function ResponsiveBackground({
  src,
  mobileSrc,
  className,
}: ResponsiveBackgroundProps) {
  const phone = mobileSrc ?? withTelSuffix(src);
  return (
    <>
      <div
        className={cn("absolute inset-0 bg-cover bg-center md:hidden", className)}
        style={{ backgroundImage: `url('${phone}')` }}
        aria-hidden
      />
      <div
        className={cn(
          "absolute inset-0 hidden bg-cover bg-center md:block",
          className,
        )}
        style={{ backgroundImage: `url('${src}')` }}
        aria-hidden
      />
    </>
  );
}
