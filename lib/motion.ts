/** Courbe fluide — démarrage doux, fin progressive (drawers / overlays). */
export const SMOOTH_EASE = [0.32, 0.72, 0, 1] as const;

export const overlayMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.28, ease: SMOOTH_EASE },
} as const;

export const drawerPanelMotion = {
  initial: { x: "100%" },
  animate: { x: 0 },
  exit: { x: "100%" },
  transition: { type: "tween" as const, duration: 0.38, ease: SMOOTH_EASE },
};

export const searchPanelMotion = {
  initial: { y: -16, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  exit: { y: -12, opacity: 0 },
  transition: { type: "tween" as const, duration: 0.34, ease: SMOOTH_EASE },
};
