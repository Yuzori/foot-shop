const slugs = [
  ["japon-maillot-domicile-coupe-du-monde-2026", 430300, 430400],
  ["japon-maillot-domicile-202627", 430300, 430400],
  ["coree-du-sud-maillot-exterieur-coupe-du-monde-2026", 430300, 430400],
  ["coree-du-sud-maillot-domicile-coupe-du-monde-2026", 430300, 430400],
  ["chili-maillot-exterieur-202627", 431900, 431980],
  ["usa-maillot-exterieur-coupe-du-monde-2026", 438020, 438040],
  ["bresil-maillot-de-gardien-coupe-du-monde-2026", 462500, 462530],
  ["bresil-maillot-de-gardien-hollywood-goalkeepers-noirblancjaune-fluo", 427220, 427240],
  ["maroc-maillot-exterieur-coupe-du-monde-2026", 434200, 434280],
  ["frmf-away-jersey-replica-puma-white-victory-gold", 434200, 434280],
  ["frmf-away-jersey-replica-white-victory-gold", 434200, 434280],
];

for (const [slug, start, end] of slugs) {
  let hit = null;
  for (let id = start; id <= end; id++) {
    const base = slug.startsWith("frmf") || slug.startsWith("fpf")
      ? "t-shirts"
      : "maillots-de-football";
    const url = `https://www.unisportstore.fr/${base}/${slug}/${id}/`;
    const r = await fetch(url, { method: "HEAD", headers: { "User-Agent": "Mozilla/5.0" } });
    if (r.status === 200) {
      hit = url;
      break;
    }
  }
  console.log(slug, "=>", hit ?? "NOT FOUND");
}
