#!/usr/bin/env node
/**
 * Ping /api/health pour éviter le spin-down Render (plan gratuit).
 * Variables : CRON_TARGET_URL (ex. https://foot-shop.onrender.com)
 */
const base = process.env.CRON_TARGET_URL?.replace(/\/$/, "");

if (!base) {
  console.error("CRON_TARGET_URL requis.");
  process.exit(1);
}

fetch(`${base}/api/health`)
  .then(async (res) => {
    const body = await res.text();
    console.log(res.status, body.slice(0, 120));
    if (!res.ok) process.exit(1);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
