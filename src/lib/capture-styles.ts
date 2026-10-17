// Class strings the Capture page kit and its pages share, so a change to the
// link focus ring or list style reaches every platform page at once.

import type { Row } from "@lib/capture-estimate";

// /capture/'s inline link, with the kit's keyboard focus ring.
export const inlineLink =
  "rounded-sm font-semibold text-primary-strong underline underline-offset-2 hover:decoration-2 focus-visible:ring-2 focus-visible:ring-primary-strong focus-visible:ring-offset-2 focus-visible:outline-none";

// An H3 inside a `CaptureSection`.
export const subheading = "text-2xl font-semibold text-primary-strong";

export const bulletList = "list-disc space-y-2 pl-6 marker:text-primary-medium";

// The pricing calculator's grid squares, shared by its server render and its
// script so both draw the same square for each tier.
export const calculatorSquare =
  "aspect-square rounded border-2 motion-safe:transition-colors motion-safe:duration-200 max-md:rounded-[3px] max-md:border-[1.5px]";
export const calculatorSquareTier: Record<Row, string> = {
  none: "border-default-soft bg-white",
  small: "border-primary bg-primary/40",
  medium: "border-primary bg-primary",
  large: "border-primary-strong bg-primary-strong",
};
// Hides the saving block when nothing is saved: gone on a desktop, but holding
// its space on a phone so the pinned summary keeps its height.
export const calculatorSavingHidden = "md:hidden max-md:invisible";
// Pads a phone grid to full size; never shown, and not drawn above a phone.
export const calculatorPlaceholder = "invisible aspect-square md:hidden";
