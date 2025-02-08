import type { FaqItem, FaqListProps } from "../../types/components/faq";

// Additional types specific to the component implementation
export interface FaqAnswerProps {
  content: FaqItem["answer"];
  className?: string;
}

// Re-export the main types for convenience
export type { FaqItem, FaqListProps };
