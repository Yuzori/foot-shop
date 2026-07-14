import { announcementMessages } from "@/config/promotions";

/** Thin top bar. Static storefront messaging (not product data). */
export function AnnouncementBar() {
  const messages = announcementMessages;

  return (
    <div className="relative bg-ink text-paper">
      <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-accent to-transparent animate-pulse-accent" />
      <div className="flex h-10 items-center overflow-hidden">
        <div className="flex shrink-0 animate-marquee items-center whitespace-nowrap">
          {[...messages, ...messages].map((message, i) => (
            <span
              key={i}
              className="mx-8 text-[11px] font-bold uppercase tracking-[0.22em] text-paper/85"
            >
              {message}
              <span className="mx-8 text-accent" aria-hidden>
                ·
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
