import { OpenAIEmbeddings } from "@langchain/openai";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { RecursiveCharacterTextSplitter } from "@langchain/classic/text_splitter";
import { readFileSync } from "fs";
import { join } from "path";

const PRODUCTS = ["da-desk", "martrust", "shipserv"] as const;
export type ProductId = (typeof PRODUCTS)[number];

interface ProductRetrievers {
  [key: string]: MemoryVectorStore;
}

let retrievers: ProductRetrievers | null = null;

/**
 * Initialize RAG layer by loading product markdown files,
 * chunking them, creating embeddings, and storing in vector stores.
 * Returns a map of product IDs to their vector stores.
 */
export async function initRag(): Promise<ProductRetrievers> {
  if (retrievers) {
    return retrievers;
  }

  const newRetrievers: ProductRetrievers = {};

  const embeddings = new OpenAIEmbeddings({
    modelName: "text-embedding-3-small",
  });

  // Optimized chunking: smaller chunks and less overlap for faster processing
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 800, // Reduced from 1000 for faster processing
    chunkOverlap: 100, // Reduced from 200 for less redundancy
  });

  // Parallelize RAG initialization for all products
  await Promise.all(
    PRODUCTS.map(async (productId) => {
      const filePath = join(process.cwd(), "data", "products", `${productId}.md`);
      const content = readFileSync(filePath, "utf-8");

      // Split the document into chunks
      const docs = await textSplitter.createDocuments([content], [
        { productId },
      ]);

      // Create vector store for this product
      const vectorStore = await MemoryVectorStore.fromDocuments(docs, embeddings);

      newRetrievers[productId] = vectorStore;
    })
  );

  retrievers = newRetrievers;
  return retrievers;
}

