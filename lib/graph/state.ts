import { Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";

export interface GraphState {
  messages: BaseMessage[];
  selectedProducts: string[];
  productAnswers: Record<string, BaseMessage>;
  [key: string]: unknown;
}

// @ts-expect-error - LangGraph type inference issue with complex state types
export const StateAnnotation = Annotation.Root<GraphState>({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  selectedProducts: Annotation<string[]>({
    reducer: (x, y) => y ?? x,
    default: () => [],
  }),
  productAnswers: Annotation<Record<string, BaseMessage>>({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({}),
  }),
});

