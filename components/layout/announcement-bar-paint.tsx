import { announcementMessages } from "@/config/promotions";

const paintMessages = announcementMessages.filter(
  (message) => !/express/i.test(message),
);

/** Bandeau supérieur paint — défilement marquee comme l’original. */
export function AnnouncementBarPaint() {
  const messages = paintMessages;

  return (
    <div className="relative border-b border-white/[0.06] bg-black text-paper">
      <div className="h-px w-full bg-gradient-to-r from-transparent via-accent/60 to-transparent" />
      <div className="flex h-10 items-center overflow-hidden">
        <div className="flex shrink-0 animate-marquee items-center whitespace-nowrap">
          {[...messages, ...messages].map((message, i) => (
            <span
              key={i}
              className="mx-8 text-[10px] font-semibold uppercase tracking-[0.22em] text-paper/88 sm:text-[11px] sm:tracking-[0.24em]"
            >
              {message}
              <span className="mx-8 text-paper/30" aria-hidden>
                ·
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
