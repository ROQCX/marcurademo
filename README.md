# Marcura Ecosystem Assistant

An AI-powered chat assistant for Marcura's product ecosystem, built with Next.js 16, LangChain, and LangGraph. The assistant uses RAG (Retrieval-Augmented Generation) to provide intelligent answers about DA-Desk, MarTrust, and ShipServ products, with a multi-agent architecture that routes questions to relevant products and synthesizes cross-product answers.

## Features

- **Multi-Agent Architecture**: Supervisor agent routes questions to product-specific agents
- **RAG-Powered**: Vector-based retrieval from product documentation
- **Streaming Responses**: Real-time streaming of AI responses (where supported)
- **Product-Specific Agents**: Dedicated agents for DA-Desk, MarTrust, and ShipServ
- **Cross-Product Synthesis**: Combines answers from multiple products when relevant
- **Performance Optimized**: Parallel processing, optimized prompts, and single-product pass-through
- **Modern UI**: Clean, responsive chat interface with Marcura branding

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **AI/ML**: 
  - LangChain for RAG and LLM integration
  - LangGraph for multi-agent orchestration
  - OpenAI GPT-4o-mini for LLM
  - OpenAI text-embedding-3-small for embeddings
- **UI**: React, Tailwind CSS, Shadcn UI, Framer Motion
- **Deployment**: AWS Amplify

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm
- OpenAI API key

### Installation

```bash
# Install dependencies
pnpm install

# Set up environment variables
# Create a .env.local file with:
OPENAI_API_KEY=your_api_key_here
```

### Development

```bash
# Run development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run type checking
pnpm exec tsc --noEmit
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Architecture

### RAG Layer
- Loads product documentation from `data/products/`
- Chunks documents using RecursiveCharacterTextSplitter
- Creates embeddings and stores in MemoryVectorStore
- Parallel initialization for faster startup

### LangGraph Workflow
1. **Supervisor Node**: Routes questions to relevant product(s)
2. **Product Agent Nodes**: Generate product-specific answers using RAG
3. **Synthesize Node**: Combines multiple product answers (skipped for single-product queries)

### Performance Optimizations
- Parallel RAG initialization
- Single-product pass-through (skips synthesis)
- Reduced token limits and optimized prompts
- Smaller chunk sizes and reduced retrieval count

## Deployment

### AWS Amplify

The project is configured for AWS Amplify deployment:

1. Set `OPENAI_API_KEY` in Amplify Console under Environment Variables
2. Push to your repository - Amplify will automatically build and deploy
3. The `amplify.yml` file handles the build configuration

**Note**: AWS Amplify Hosting doesn't support streaming from Server Actions, so responses are returned as complete messages.

## Project Structure

```
├── app/
│   ├── actions/
│   │   └── chat.ts          # Server Action for chat
│   ├── layout.tsx           # Root layout
│   ├── page.tsx             # Main page
│   └── icon.svg/ico          # Favicon
├── components/
│   ├── chat/                # Chat UI components
│   └── ui/                  # Shadcn UI components
├── data/
│   └── products/            # Product documentation (markdown)
├── lib/
│   ├── graph/               # LangGraph workflow
│   ├── llm/                 # LLM configuration and rate limiting
│   └── rag/                 # RAG initialization and retrieval
└── public/                  # Static assets
```

## Environment Variables

- `OPENAI_API_KEY` (required): Your OpenAI API key
- `OPENAI_MODEL` (optional): Override default model (default: gpt-4o-mini)
- `OPENAI_TEMPERATURE` (optional): Override default temperature
- `OPENAI_MAX_TOKENS` (optional): Override default max tokens

## License

Private - Marcura Demo
