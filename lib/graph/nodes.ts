import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { GraphState, StateAnnotation } from "./state";
import { retrieveForProduct } from "../rag/product-retriever";
import type { ProductId } from "../rag/init-rag";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import {
  SUPERVISOR_LLM_CONFIG,
  PRODUCT_AGENT_LLM_CONFIG,
  SYNTHESIZE_LLM_CONFIG,
  getLLMConfig,
} from "../llm/config";
import { withRateLimit } from "../llm/rate-limit";

// Create LLM instances with specific configurations
const supervisorLLM = new ChatOpenAI({
  modelName: getLLMConfig(SUPERVISOR_LLM_CONFIG).modelName,
  temperature: getLLMConfig(SUPERVISOR_LLM_CONFIG).temperature,
  maxTokens: getLLMConfig(SUPERVISOR_LLM_CONFIG).maxTokens,
  topP: getLLMConfig(SUPERVISOR_LLM_CONFIG).topP,
  frequencyPenalty: getLLMConfig(SUPERVISOR_LLM_CONFIG).frequencyPenalty,
  presencePenalty: getLLMConfig(SUPERVISOR_LLM_CONFIG).presencePenalty,
  timeout: getLLMConfig(SUPERVISOR_LLM_CONFIG).timeout,
});

const productAgentLLM = new ChatOpenAI({
  modelName: getLLMConfig(PRODUCT_AGENT_LLM_CONFIG).modelName,
  temperature: getLLMConfig(PRODUCT_AGENT_LLM_CONFIG).temperature,
  maxTokens: getLLMConfig(PRODUCT_AGENT_LLM_CONFIG).maxTokens,
  topP: getLLMConfig(PRODUCT_AGENT_LLM_CONFIG).topP,
  frequencyPenalty: getLLMConfig(PRODUCT_AGENT_LLM_CONFIG).frequencyPenalty,
  presencePenalty: getLLMConfig(PRODUCT_AGENT_LLM_CONFIG).presencePenalty,
  timeout: getLLMConfig(PRODUCT_AGENT_LLM_CONFIG).timeout,
});

const synthesizeLLM = new ChatOpenAI({
  modelName: getLLMConfig(SYNTHESIZE_LLM_CONFIG).modelName,
  temperature: getLLMConfig(SYNTHESIZE_LLM_CONFIG).temperature,
  maxTokens: getLLMConfig(SYNTHESIZE_LLM_CONFIG).maxTokens,
  topP: getLLMConfig(SYNTHESIZE_LLM_CONFIG).topP,
  frequencyPenalty: getLLMConfig(SYNTHESIZE_LLM_CONFIG).frequencyPenalty,
  presencePenalty: getLLMConfig(SYNTHESIZE_LLM_CONFIG).presencePenalty,
  timeout: getLLMConfig(SYNTHESIZE_LLM_CONFIG).timeout,
});

interface NodeContext {
  retrievers: Record<string, MemoryVectorStore>;
}

/**
 * Supervisor node that routes questions to relevant product(s).
 * Uses an LLM to classify which product(s) the question touches.
 */
export async function supervisorNode(
  state: GraphState,
  context: NodeContext
): Promise<Partial<GraphState>> {
  const lastMessage = state.messages[state.messages.length - 1];
  const userQuestion = lastMessage.content as string;

  // Optimized prompt: shorter and more direct for faster processing
  const systemPrompt = `Route user questions to Marcura products. Return ONLY a JSON array of product IDs.

Products: da-desk (port costs), martrust (payments), shipserv (procurement).

Examples:
- "port costs" -> ["da-desk"]
- "pay crew" -> ["martrust"]  
- "suppliers" -> ["shipserv"]
- "port costs and payments" -> ["da-desk", "martrust"]

Return JSON array only.`;

  // Optimized: shorter user message for faster processing
  const response = await withRateLimit(
    () =>
      supervisorLLM.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(`Q: ${userQuestion}\nJSON:`),
      ]),
    "supervisor"
  );

  let selectedProducts: string[] = [];
  try {
    const content = response.content as string;
    // Try to parse JSON array from the response
    const jsonMatch = content.match(/\[.*?\]/);
    if (jsonMatch) {
      selectedProducts = JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error("Error parsing supervisor response:", error);
  }

  return {
    selectedProducts,
  };
}

/**
 * Product agent node that generates product-specific answers using RAG.
 * Each product agent only sees its own documentation.
 */
export function createProductAgentNode(productId: ProductId) {
  return async (state: GraphState, context: NodeContext): Promise<Partial<GraphState>> => {
    const lastMessage = state.messages[state.messages.length - 1];
    const userQuestion = lastMessage.content as string;

    const vectorStore = context.retrievers[productId];
    if (!vectorStore) {
      return {
        productAnswers: {
          [productId]: new AIMessage(
            `I apologize, but I don't have access to ${productId} documentation at the moment.`
          ),
        },
      };
    }

    // Retrieve relevant context for this product
    const contextText = await retrieveForProduct(productId, userQuestion, vectorStore);

    const productNames: Record<ProductId, string> = {
      "da-desk": "DA-Desk",
      martrust: "MarTrust",
      shipserv: "ShipServ",
    };

    // Optimized: shorter prompt for faster processing
    const systemPrompt = `Expert assistant for ${productNames[productId]}. Answer using context. Be specific and helpful.`;

    const response = await withRateLimit(
      () =>
        productAgentLLM.invoke([
          new SystemMessage(systemPrompt),
          new HumanMessage(
            `Context:\n${contextText}\n\nQ: ${userQuestion}`
          ),
        ]),
      `product-${productId}`
    );

    return {
      productAnswers: {
        [productId]: response,
      },
    };
  };
}

/**
 * Synthesize node that combines all product answers into a unified response.
 * This node creates the "ecosystem" narrative by explaining how products work together.
 */
export async function synthesizeNode(
  state: GraphState,
  context: NodeContext
): Promise<Partial<GraphState>> {
  const lastMessage = state.messages[state.messages.length - 1];
  const userQuestion = lastMessage.content as string;

  const productAnswers = state.productAnswers;
  const selectedProducts = state.selectedProducts;

  if (selectedProducts.length === 0) {
    const response = await withRateLimit(
      () =>
        synthesizeLLM.invoke([
          new SystemMessage(
            "You are a helpful assistant for Marcura's product ecosystem. The user's question doesn't seem to relate to any specific Marcura products. Provide a helpful response and suggest they might want to learn about DA-Desk (port cost control), MarTrust (payments), or ShipServ (procurement)."
          ),
          new HumanMessage(userQuestion),
        ]),
      "synthesize"
    );

    return {
      messages: [response],
    };
  }

  // Performance optimization: If only one product, pass through its answer directly
  // This skips the synthesis LLM call and improves response time
  if (selectedProducts.length === 1) {
    const productId = selectedProducts[0];
    const answer = productAnswers[productId];
    if (answer) {
      return {
        messages: [answer],
      };
    }
  }

  // Build context from all product answers
  const productAnswersText = selectedProducts
    .map((productId) => {
      const answer = productAnswers[productId];
      const productNames: Record<string, string> = {
        "da-desk": "DA-Desk",
        martrust: "MarTrust",
        shipserv: "ShipServ",
      };
      return `${productNames[productId] || productId}:\n${answer?.content || "No answer available"}`;
    })
    .join("\n\n---\n\n");

  // Optimized: shorter prompt for faster processing
  const systemPrompt = `Synthesize answers from multiple Marcura products into one cohesive response. Explain how products work together. Be clear and concise.`;

  // Use stream() for token-level streaming of the final response
  // This allows the synthesize node to stream while having full context from all product agents
  const stream = await withRateLimit(
    () =>
      synthesizeLLM.stream([
        new SystemMessage(systemPrompt),
        new HumanMessage(
          `Q: ${userQuestion}\n\nAnswers:\n${productAnswersText}\n\nSynthesize:`
        ),
      ]),
    "synthesize"
  );

  // Collect all chunks into a final message
  // Note: The actual streaming happens via LangGraph's streamEvents, not here
  // This collection is just for the return value
  let fullContent = "";
  for await (const chunk of stream) {
    if (chunk.content) {
      fullContent += chunk.content;
    }
  }

  // Create final AIMessage from accumulated content
  const response = new AIMessage(fullContent);

  return {
    messages: [response],
  };
}

