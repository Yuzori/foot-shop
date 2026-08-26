import { NextResponse } from "next/server";

import { isValidUnisportCollectToken } from "@/lib/unisport-collect-token";

export const runtime = "nodejs";

/** Script externe injecté par le bookmarklet variante script. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim() ?? "";

  if (!(await isValidUnisportCollectToken(token))) {
    return new NextResponse("// Token invalide", {
      status: 401,
      headers: { "Content-Type": "application/javascript; charset=utf-8" },
    });
  }

  const toolUrl = `${url.origin}/outil/unisport`;
  const js = `(function(){
  try {
    var pageUrl = location.href.split("#")[0];
    if (!/unisportstore/i.test(pageUrl)) {
      alert("Ouvrez une page produit sur unisportstore.fr");
      return;
    }
    var title = (document.querySelector('meta[property="og:title"]') || {}).content || document.title;
    var imgs = [], seen = {}, re = /thumblr\\.uniid\\.it\\/product\\/\\d+\\/[a-f0-9]+\\.jpg/gi, m, html = document.documentElement.outerHTML;
    while ((m = re.exec(html))) {
      var x = "https://" + m[0].split("?")[0];
      if (!seen[x]) { seen[x] = 1; imgs.push(x); }
    }
    if (!imgs.length) {
      alert("Aucune image trouvee sur cette page");
      return;
    }
    var q = "t=" + encodeURIComponent(${JSON.stringify(token)})
      + "&url=" + encodeURIComponent(pageUrl)
      + "&title=" + encodeURIComponent(title)
      + "&imgs=" + encodeURIComponent(imgs.slice(0, 12).join("|"));
    location.href = ${JSON.stringify(toolUrl)} + "?" + q;
  } catch (e) {
    alert("Erreur Foot-Shop : " + (e && e.message ? e.message : e));
  }
})();`;

  return new NextResponse(js, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
