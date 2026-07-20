const checks = [
  ["espagne-maillot-exterieur-coupe-du-monde-2026", 430386],
  ["argentine-maillot-domicile-202526-messi-10", 431637],
  ["norvege-3eme-maillot-coupe-du-monde-2026", 461749],
  ["japon-maillot-domicile-coupe-du-monde-2026", 430361],
  ["japon-maillot-domicile-coupe-du-monde-2026", 430362],
  ["japon-maillot-domicile-202627", 430360],
  ["chili-maillot-exterieur-202627", 431936],
  ["chili-maillot-exterieur-202627", 431934],
  ["usa-maillot-exterieur-coupe-du-monde-2026", 438028],
  ["usa-maillot-exterieur-coupe-du-monde-2026", 438027],
  ["usa-maillot-de-gardien-coupe-du-monde-2026", 427225],
  ["usa-maillot-de-gardien-hollywood-goalkeepers-rougenoir", 427228],
  ["bresil-maillot-de-gardien-coupe-du-monde-2026", 462522],
  ["bresil-maillot-de-gardien-coupe-du-monde-2026", 427231],
  ["coree-du-sud-maillot-exterieur-coupe-du-monde-2026", 430364],
  ["coree-du-sud-maillot-domicile-coupe-du-monde-2026", 430361],
  ["maroc-maillot-exterieur-coupe-du-monde-2026", 434236],
  ["frmf-away-jersey-replica-puma-white-victory-gold", 434236],
  ["frmf-away-jersey-replica-puma-white-victory-gold", 434237],
  ["portugal-maillot-domicile-coupe-du-monde-2026", 434175],
];

for (const [slug, id] of checks) {
  const base =
    slug.startsWith("frmf") || slug.includes("fpf")
      ? "t-shirts"
      : "maillots-de-football";
  const url = `https://www.unisportstore.fr/${base}/${slug}/${id}/`;
  const r = await fetch(url, {
    method: "GET",
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  const ok = r.status === 200;
  const title = ok
    ? (await r.text()).match(/<title>([^<]+)/)?.[1]?.trim()
    : "";
  console.log(
    ok ? "OK" : r.status,
    slug,
    id,
    ok ? title.slice(0, 60) : ""
  );
}
