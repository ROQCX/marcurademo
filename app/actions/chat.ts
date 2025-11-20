"use server"

import { initRag } from "@/lib/rag/init-rag";
import { createGraph } from "@/lib/graph/graph";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { GraphState } from "@/lib/graph/state";

let graphInstance: Awaited<ReturnType<typeof createGraph>> | null = null;
let retrievers: Awaited<ReturnType<typeof initRag>> | null = null;

async function getGraph() {
  if (!retrievers) {
    retrievers = await initRag();
  }
  if (!graphInstance) {
    graphInstance = createGraph(retrievers) as Awaited<ReturnType<typeof createGraph>>;
  }
  return graphInstance;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Server Action for chat - streams responses via ReadableStream
 * This is automatically protected by Next.js and only accessible from same origin
 */
export async function chatAction(messages: ChatMessage[]): Promise<ReadableStream> {
  // Validate input
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw new Error("Messages array is required and cannot be empty");
  }

  // Limit message count
  if (messages.length > 100) {
    throw new Error("Too many messages. Maximum 100 messages allowed.");
  }

  // Validate each message
  for (const message of messages) {
    if (!message.role || !message.content) {
      throw new Error("Each message must have 'role' and 'content' fields");
    }
    if (!["user", "assistant", "system"].includes(message.role)) {
      throw new Error("Message role must be 'user', 'assistant', or 'system'");
    }
    if (typeof message.content !== "string") {
      throw new Error("Message content must be a string");
    }
    if (message.content.length > 10000) {
      throw new Error("Message content too long. Maximum 10000 characters.");
    }
  }

  const graph = await getGraph();

  // Convert messages to LangChain format
  const langchainMessages = messages.map((msg) => {
    if (msg.role === "user") {
      return new HumanMessage(msg.content);
    } else {
      return new AIMessage(msg.content);
    }
  });

  // Get the last user message
  const lastUserMessage = langchainMessages
    .slice()
    .reverse()
    .find((msg) => msg instanceof HumanMessage);

  if (!lastUserMessage) {
    throw new Error("No user message found");
  }

  // Initialize state
  const initialState: GraphState = {
    messages: langchainMessages,
    selectedProducts: [],
    productAnswers: {},
  };

  // Return a ReadableStream for streaming responses
  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        // Use streamEvents to capture streaming from LLM calls
        const streamEvents = graph.streamEvents(initialState as any, { version: "v2" });

        let accumulatedContent = "";
        let hasStreamed = false;
        let isInSynthesizeNode = false;

        for await (const event of streamEvents) {
          // Track when we enter/exit the synthesize node
          if (event.event === "on_chain_start" && event.name === "synthesize") {
            isInSynthesizeNode = true;
          }

          if (event.event === "on_chain_end" && event.name === "synthesize") {
            isInSynthesizeNode = false;
          }

          // Capture streaming chunks from synthesize node
          if (event.event === "on_chat_model_stream" && isInSynthesizeNode) {
            const chunk = event.data?.chunk;

            if (chunk) {
              // Extract content from AIMessageChunk
              let content = "";
              if (typeof chunk === "string") {
                content = chunk;
              } else if (chunk && typeof chunk === "object") {
                // Handle AIMessageChunk object
                if ("content" in chunk) {
                  if (typeof chunk.content === "string") {
                    content = chunk.content;
                  } else if (Array.isArray(chunk.content)) {
                    // Handle content array (e.g., from complex messages)
                    content = chunk.content
                      .map((c: any) => (typeof c === "string" ? c : c?.text || String(c)))
                      .join("");
                  }
                } else if ("text" in chunk) {
                  content = String(chunk.text);
                }
              }

              if (content) {
                accumulatedContent += content;
                hasStreamed = true;
                // Send chunk to client immediately for real-time streaming
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
                );
              }
            }
          }

          // Also check for LLM token events (alternative event format)
          if (event.event === "on_llm_new_token" && isInSynthesizeNode) {
            const data = event.data as any;
            const token = data?.token;
            if (token && typeof token === "string") {
              accumulatedContent += token;
              hasStreamed = true;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ content: token })}\n\n`)
              );
            }
          }

          // Check for stream chunk events (another possible format)
          if (event.event === "on_chat_model_stream_chunk" && isInSynthesizeNode) {
            const chunk = event.data?.chunk;
            if (chunk && chunk.content) {
              const content =
                typeof chunk.content === "string" ? chunk.content : String(chunk.content);
              if (content) {
                accumulatedContent += content;
                hasStreamed = true;
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
                );
              }
            }
          }

          // When synthesize node completes, send final message if needed
          if (event.event === "on_chain_end" && event.name === "synthesize") {
            // If we didn't stream but have content, send it all at once
            if (!hasStreamed) {
              const finalState = event.data?.output;
              if (finalState?.messages) {
                const lastMessage = finalState.messages[finalState.messages.length - 1];
                if (lastMessage && "content" in lastMessage) {
                  const content = String(lastMessage.content);
                  accumulatedContent = content;
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
                  );
                }
              }
            }
            // Send completion signal
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
            controller.close();
            return;
          }

          // Handle errors
          if (event.event === "on_chain_error" || event.event === "on_chat_model_error") {
            console.error("Error in graph execution:", event.data);
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ error: "An error occurred during generation" })}\n\n`)
            );
            controller.close();
            return;
          }
        }

        // If we get here without closing, something went wrong
        if (!hasStreamed && accumulatedContent) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ content: accumulatedContent })}\n\n`)
          );
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        controller.close();
      } catch (error) {
        console.error("Error streaming response:", error);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: "Failed to generate response" })}\n\n`
          )
        );
        controller.close();
      }
    },
  });
}

