/* Oviya Studio motion language. Spring stiffness ~350 / damping ~18, hover scale <= 1.04,
 * tap 0.97, entrance ~400ms, ease cubic-bezier(0.16,1,0.3,1). Transform + opacity only.
 * Components honor prefers-reduced-motion via useReducedMotion() from framer-motion. */
import type { Transition, Variants } from "framer-motion";

export const spring: Transition = { type: "spring", stiffness: 350, damping: 18 };
export const easeOut: Transition = { duration: 0.4, ease: [0.16, 1, 0.3, 1] };

export const press = { whileHover: { scale: 1.04 }, whileTap: { scale: 0.97 }, transition: spring };

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: easeOut },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: easeOut },
};

export const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};
