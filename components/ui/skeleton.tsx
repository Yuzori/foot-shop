import { cn } from "@/lib/utils";

/** Shimmer placeholder used while data loads. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-xl", className)} />;
}
