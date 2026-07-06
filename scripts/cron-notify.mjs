#!/usr/bin/env node
/**
 * Appelé par le Cron Job Render (render.yaml).
 * Variables : CRON_TARGET_URL (ex. https://foot-shop.fr), CRON_SECRET
 */
const base = process.env.CRON_TARGET_URL?.replace(/\/$/, "");
const secret = process.env.CRON_SECRET ?? process.env.ADMIN_SECRET;

if (!base || !secret) {
  console.error("CRON_TARGET_URL et CRON_SECRET requis.");
  process.exit(1);
}

const url = `${base}/api/cron/notify`;

fetch(url, {
  headers: { Authorization: `Bearer ${secret}` },
})
  .then(async (res) => {
    const body = await res.text();
    console.log(res.status, body);
    if (!res.ok) process.exit(1);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
