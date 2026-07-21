/** Extrait le payload base64 d'une data URL ou renvoie la chaîne telle quelle. */
export function dataUrlToBase64(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const commaIndex = trimmed.indexOf(",");
  if (trimmed.startsWith("data:") && commaIndex >= 0) {
    return trimmed.slice(commaIndex + 1).trim();
  }

  return trimmed;
}
