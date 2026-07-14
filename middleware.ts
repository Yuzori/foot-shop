import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { ADMIN_API_CORS_HEADERS } from "@/lib/admin-api-cors";

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/admin/")) {
    if (request.method === "OPTIONS") {
      return new NextResponse(null, { status: 204, headers: ADMIN_API_CORS_HEADERS });
    }

    const response = NextResponse.next();
    for (const [key, value] of Object.entries(ADMIN_API_CORS_HEADERS)) {
      response.headers.set(key, value);
    }
    return response;
  }

  const response = NextResponse.next();

  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  response.headers.set("X-DNS-Prefetch-Control", "off");

  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|.*\\.(?:png|jpg|jpeg|webp|svg|ico)$).*)"],
};
