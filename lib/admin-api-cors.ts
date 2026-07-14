/** CORS headers for Figma plugin UI fetch (iframe → foot-shop.fr). */
export const ADMIN_API_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, x-admin-secret",
  "Access-Control-Max-Age": "86400",
};

export function applyAdminApiCors(headers: Headers): void {
  for (const [key, value] of Object.entries(ADMIN_API_CORS_HEADERS)) {
    headers.set(key, value);
  }
}
