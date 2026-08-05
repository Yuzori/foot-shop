/**
 * Thèmes indépendants — header et hero peuvent diverger.
 *
 * • headerTheme `"original"` → navbar claire, logo noir
 * • heroTheme `"paint"`     → hero avec titre.png, effets peinture
 */
export type HeaderTheme = "original" | "paint";

export const headerTheme: HeaderTheme = "original";
export const heroTheme: HeaderTheme = "paint";
