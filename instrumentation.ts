export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerLiveAnalyticsShutdown } = await import(
      "@/lib/live-site-analytics"
    );
    registerLiveAnalyticsShutdown();
  }
}
