// Types for the core FAQ data structure
export interface FaqItem {
  question: string;
  answer: string;
}

// Types for the FAQ list component props
export interface FaqListProps {
  items: FaqItem[];
  questionClass?: string;
  answerClass?: string;
}
