import { StateGraph, END, START } from "@langchain/langgraph";
import { StateAnnotation, GraphState } from "./state";
import {
  supervisorNode,
  createProductAgentNode,
  synthesizeNode,
} from "./nodes";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";

interface GraphContext {
  retrievers: Record<string, MemoryVectorStore>;
}

/**
 * Create the LangGraph workflow for the Marcura ecosystem assistant.
 * Flow: START → supervisor → product nodes → synthesize → END
 */
export function createGraph(retrievers: Record<string, MemoryVectorStore>) {
  const context: GraphContext = { retrievers };

  // Create product agent nodes
  const daDeskAgent = createProductAgentNode("da-desk");
  const marTrustAgent = createProductAgentNode("martrust");
  const shipServAgent = createProductAgentNode("shipserv");

  // Create the graph  
  // @ts-expect-error - LangGraph type inference issue with complex state types
  const workflow = new StateGraph(StateAnnotation)
    .addNode("supervisor", (state) => supervisorNode(state, context))
    .addNode("da-desk", (state) => daDeskAgent(state, context))
    .addNode("martrust", (state) => marTrustAgent(state, context))
    .addNode("shipserv", (state) => shipServAgent(state, context))
    .addNode("synthesize", (state) => synthesizeNode(state, context));

  // Helper function to determine next node after a product agent
  function getNextProductNode(state: GraphState): string {
    const products = state.selectedProducts;
    const completed = Object.keys(state.productAnswers);
    
    // Find the first product that hasn't been completed yet
    for (const product of products) {
      if (!completed.includes(product)) {
        return product;
      }
    }
    
    // All products completed, go to synthesis
    return "synthesize";
  }

  // Define edges
  workflow.addEdge(START, "supervisor");

  // Conditional routing from supervisor to first product node or directly to answer
  workflow.addConditionalEdges(
    "supervisor",
    (state) => {
      const products = state.selectedProducts;
      if (products.length === 0) {
        return "synthesize";
      }
      return products[0];
    },
    {
      "da-desk": "da-desk",
      martrust: "martrust",
      shipserv: "shipserv",
      synthesize: "synthesize",
    }
  );

  // Each product node routes to next incomplete product or to synthesize
  workflow.addConditionalEdges("da-desk", getNextProductNode, {
    "da-desk": "da-desk",
    martrust: "martrust",
    shipserv: "shipserv",
    synthesize: "synthesize",
  });

  workflow.addConditionalEdges("martrust", getNextProductNode, {
    "da-desk": "da-desk",
    martrust: "martrust",
    shipserv: "shipserv",
    synthesize: "synthesize",
  });

  workflow.addConditionalEdges("shipserv", getNextProductNode, {
    "da-desk": "da-desk",
    martrust: "martrust",
    shipserv: "shipserv",
    synthesize: "synthesize",
  });

  // Final edge to END
  workflow.addEdge("synthesize", END);

  return workflow.compile();
}

