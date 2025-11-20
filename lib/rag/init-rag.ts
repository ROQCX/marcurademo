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

  retrievers = {};

  const embeddings = new OpenAIEmbeddings({
    modelName: "text-embedding-3-small",
  });

  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  for (const productId of PRODUCTS) {
    const filePath = join(process.cwd(), "data", "products", `${productId}.md`);
    const content = readFileSync(filePath, "utf-8");

    // Split the document into chunks
    const docs = await textSplitter.createDocuments([content], [
      { productId },
    ]);

    // Create vector store for this product
    const vectorStore = await MemoryVectorStore.fromDocuments(docs, embeddings);

    retrievers[productId] = vectorStore;
  }

  return retrievers;
}

