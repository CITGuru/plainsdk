/**
 * LLM-based SDK Generator
 * 
 * This module provides functionality for generating SDKs using Large Language Models
 * like OpenAI's GPT-4 and Anthropic's Claude.
 */

// Core generator
export { generateSDKWithLLM, generateSDKForLanguage } from './implementation';
export { generateSDKWithLLMv1 } from './generator';

// Configuration
export { getLLMConfig } from './config';
export type { LLMGeneratorConfig } from './config';

// Prompt generation
export { generatePrompt } from './prompt';

// Post-processing
export { postProcessGeneratedCode } from './post-processor';

// Utilities
export { 
  validateSDKStructure, 
  generateSDKStats, 
  generateReadme 
} from './utils';

// Style guides
export { 
  loadStyleGuide, 
  getDefaultStyleGuide 
} from './style-guide';