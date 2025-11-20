import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import type { ProductId } from "./init-rag";

const TOP_K = 3; // Reduced from 5 for faster retrieval and smaller context

/**
 * Retrieve relevant chunks for a specific product based on the query.
 * This function maintains strict product scoping - each product agent
 * only sees its own documentation.
 */
export async function retrieveForProduct(
  productId: ProductId,
  query: string,
  vectorStore: MemoryVectorStore
): Promise<string> {
  const results = await vectorStore.similaritySearch(query, TOP_K);

  // Combine retrieved chunks into context
  const context = results
    .map((doc) => doc.pageContent)
    .join("\n\n---\n\n");

  return context;
}

