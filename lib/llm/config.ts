/**
 * LLM Configuration
 * Centralized configuration for all LLM instances
 */

export interface LLMConfig {
  modelName: string;
  temperature: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  timeout?: number;
}

/**
 * Default LLM configuration
 */
export const DEFAULT_LLM_CONFIG: LLMConfig = {
  modelName: "gpt-4o-mini",
  temperature: 0.7,
  maxTokens: 2000,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
  timeout: 20000, // 20 seconds - faster failure for better UX
};

/**
 * Supervisor node LLM configuration
 * Lower temperature for more consistent routing decisions
 */
export const SUPERVISOR_LLM_CONFIG: LLMConfig = {
  ...DEFAULT_LLM_CONFIG,
  temperature: 0.2, // Lower temperature for more deterministic routing
  maxTokens: 100, // Much shorter - just need JSON array
};

/**
 * Product agent LLM configuration
 * Balanced temperature for informative but consistent answers
 */
export const PRODUCT_AGENT_LLM_CONFIG: LLMConfig = {
  ...DEFAULT_LLM_CONFIG,
  temperature: 0.6,
  maxTokens: 1200, // Reduced from 1500 for faster generation
};

/**
 * Synthesize node LLM configuration
 * Slightly higher temperature for more natural, creative synthesis
 */
export const SYNTHESIZE_LLM_CONFIG: LLMConfig = {
  ...DEFAULT_LLM_CONFIG,
  temperature: 0.7, // Slightly reduced for faster generation
  maxTokens: 1500, // Reduced from 2000 for faster generation
};

/**
 * Get LLM config from environment variables
 * Allows overriding defaults via environment
 */
export function getLLMConfig(baseConfig: LLMConfig = DEFAULT_LLM_CONFIG): LLMConfig {
  return {
    modelName: process.env.OPENAI_MODEL || baseConfig.modelName,
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE || String(baseConfig.temperature)),
    maxTokens: process.env.OPENAI_MAX_TOKENS
      ? parseInt(process.env.OPENAI_MAX_TOKENS, 10)
      : baseConfig.maxTokens,
    topP: process.env.OPENAI_TOP_P
      ? parseFloat(process.env.OPENAI_TOP_P)
      : baseConfig.topP,
    frequencyPenalty: process.env.OPENAI_FREQUENCY_PENALTY
      ? parseFloat(process.env.OPENAI_FREQUENCY_PENALTY)
      : baseConfig.frequencyPenalty,
    presencePenalty: process.env.OPENAI_PRESENCE_PENALTY
      ? parseFloat(process.env.OPENAI_PRESENCE_PENALTY)
      : baseConfig.presencePenalty,
    timeout: process.env.OPENAI_TIMEOUT
      ? parseInt(process.env.OPENAI_TIMEOUT, 10)
      : baseConfig.timeout,
  };
}

