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

  const systemPrompt = `You are a routing supervisor for Marcura's product ecosystem. Your job is to analyze user questions and determine which Marcura product(s) are relevant.

Available products:
- da-desk: Port disbursement account management and port call cost control
- martrust: Payment solutions for crew wages, vendor payments, and financial services
- shipserv: Maritime e-procurement and supplier network platform

Analyze the user's question and return ONLY a JSON array of relevant product IDs. Return an empty array [] if no products are relevant. Return multiple products if the question touches multiple areas.

Examples:
- "How can I reduce port call costs?" -> ["da-desk"]
- "I need to pay my crew members" -> ["martrust"]
- "Where can I find suppliers for spare parts?" -> ["shipserv"]
- "How can I combine port cost control with payment processing?" -> ["da-desk", "martrust"]

Return ONLY the JSON array, nothing else.`;

  const response = await withRateLimit(
    () =>
      supervisorLLM.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(`User question: ${userQuestion}\n\nReturn JSON array of relevant product IDs:`),
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

    const systemPrompt = `You are an expert assistant for ${productNames[productId]}, a Marcura product. You ONLY answer questions about ${productNames[productId]}. 

If the question is not related to ${productNames[productId]}, politely redirect the user or explain that you can only help with ${productNames[productId]}-related questions.

Use the provided context to answer accurately. Be specific and helpful.`;

    const response = await withRateLimit(
      () =>
        productAgentLLM.invoke([
          new SystemMessage(systemPrompt),
          new HumanMessage(
            `Context about ${productNames[productId]}:\n\n${contextText}\n\n\nUser question: ${userQuestion}`
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

  const systemPrompt = `You are a Marcura ecosystem assistant. Your role is to synthesize answers from multiple product experts into a cohesive, helpful response.

When multiple products are involved, explain:
1. How each product addresses different aspects of the user's question
2. How the products can work together in workflows
3. The combined value proposition

Be clear, concise, and focus on the "connected products" story - showing how Marcura's products integrate to solve maritime business challenges.

If context is insufficient, mention that and suggest the user provide more details.`;

  // Use stream() for token-level streaming of the final response
  // This allows the synthesize node to stream while having full context from all product agents
  const stream = await withRateLimit(
    () =>
      synthesizeLLM.stream([
        new SystemMessage(systemPrompt),
        new HumanMessage(
          `User question: ${userQuestion}\n\n\nProduct-specific answers:\n\n${productAnswersText}\n\n\nSynthesize these into a unified, helpful response:`
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

