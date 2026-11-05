

// Views swap at once and only fade in. Waiting for the old view to animate
// out first put a quarter-second of nothing between every tab tap.
export const MOTION = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.14, ease: [0.22, 1, 0.36, 1] },
}
