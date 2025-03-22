import { PlainSDKConfig, LLMConfig } from '../../types';

/**
 * LLM generator configuration
 */
export interface LLMGeneratorConfig {
  /**
   * LLM provider
   */
  provider: 'openai' | 'anthropic' | 'custom';
  
  /**
   * API key for the LLM service
   */
  apiKey: string;
  
  /**
   * Model to use
   */
  model?: string;
  
  /**
   * API endpoint (defaults to provider's standard endpoint)
   */
  endpoint?: string;
  
  /**
   * Maximum tokens to generate
   */
  maxTokens?: number;
  
  /**
   * Temperature (randomness) for generation
   */
  temperature?: number;
  
  /**
   * Additional prompt instructions
   */
  customInstructions?: string;
}

/**
 * Default LLM configurations by provider
 */
export const DEFAULT_LLM_CONFIGS: Record<string, Partial<LLMGeneratorConfig>> = {
  anthropic: {
    model: 'claude-3-opus-20240229',
    endpoint: 'https://api.anthropic.com/v1/messages',
    maxTokens: 100000,
    temperature: 0.2
  },
  openai: {
    model: 'gpt-4-turbo',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    maxTokens: 8192,
    temperature: 0.2
  }
};

/**
 * Get LLM configuration from PlainSDK config
 */
export function getLLMConfig(config: PlainSDKConfig): LLMConfig | null {
  if (!config.llm) {
    return null;
  }
  
  const provider = config.llm.provider || 'anthropic';
  const defaultConfig = DEFAULT_LLM_CONFIGS[provider] || {};
  
  return {
    provider,
    apiKey: config.llm.apiKey || process.env.LLM_API_KEY || '',
    model: config.llm.model || defaultConfig.model,
    endpoint: config.llm.endpoint || defaultConfig.endpoint,
    maxTokens: config.llm.maxTokens || defaultConfig.maxTokens,
    temperature: config.llm.temperature || defaultConfig.temperature,
    customInstructions: config.llm.customInstructions
  };
}