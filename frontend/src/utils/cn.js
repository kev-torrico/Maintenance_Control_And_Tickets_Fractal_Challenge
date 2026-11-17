import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind class merge helper */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
