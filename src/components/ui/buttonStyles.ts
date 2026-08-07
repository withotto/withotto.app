/**
 * Single source of truth for button styling.
 *
 * Both `ui/button.astro` (a real <button>) and `ui/link.astro` (an <a> that
 * looks like a button) build their classes from here, so a link CTA and a form
 * submit with the same variant and size are visually identical.
 *
 * Cursor is deliberately absent: `src/styles/global.css` gives every enabled
 * <button> `cursor: pointer` so it matches the <a> default, and the disabled
 * state below overrides it.
 */

export type ButtonVariant = "primary" | "outline" | "inverted" | "subtle";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg text-center font-semibold transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60";

const sizes: Record<ButtonSize, string> = {
  sm: "px-4 py-2 text-sm",
  md: "px-6 py-3 text-base",
  lg: "px-8 py-4 text-base",
};

const variants: Record<ButtonVariant, string> = {
  /** The default call to action: solid brand green. */
  primary:
    "border border-transparent bg-primary text-white shadow-sm hover:bg-primary-strong focus-visible:ring-primary-strong",
  /** Lower emphasis, sits next to a primary without competing with it. */
  outline:
    "border border-primary bg-transparent text-primary-strong hover:bg-primary-soft focus-visible:ring-primary-strong",
  /** For use on the brand-coloured bands, where a solid green button would vanish. */
  inverted:
    "border border-transparent bg-white text-primary-strong shadow-sm hover:bg-primary hover:text-white focus-visible:ring-primary-strong",
  /** Neutral, for navigation rather than conversion (pagination, dialog dismiss). */
  subtle:
    "border border-muted-strong bg-muted-soft text-default shadow-sm hover:bg-muted-strong focus-visible:ring-primary-strong",
};

export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
): string {
  return `${base} ${sizes[size]} ${variants[variant]}`;
}
