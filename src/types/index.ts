/**
 * Core type definitions for PlainSDK
 */

/**
 * PlainSDK configuration
 */
export interface PlainSDKConfig {
  // Base configuration
  name: string;                    // SDK package name
  version: string;                 // SDK version
  description?: string;            // SDK description
  sourceOpenAPI: string;           // Path or URL to OpenAPI spec
  basePath?: string;

  // Output configuration
  outputDir: string;               // Directory where SDK will be generated
  languages: Language[];           // Languages to generate

  // SDK features
  features: {
    pagination?: PaginationConfig;     // Pagination configuration
    authentication?: AuthConfig;       // Authentication configuration
    errorHandling?: ErrorHandlingConfig;  // Error handling configuration
    retries?: RetryConfig;            // Retry configuration
    rateLimit?: RateLimitConfig;      // Rate limiting configuration
  };

  // Naming conventions
  naming: {
    methodStyle: 'camelCase' | 'snake_case' | 'PascalCase';
    parameterStyle: 'camelCase' | 'snake_case';
    resourceStyle: 'camelCase' | 'snake_case' | 'PascalCase';
    modelStyle: 'camelCase' | 'snake_case' | 'PascalCase';
  };

  // Custom templates
  templates?: {
    [key: string]: string;         // Path to custom template files
  };

  // Hooks for pre/post processing
  hooks?: {
    preGenerate?: string;          // Script to run before generation
    postGenerate?: string;         // Script to run after generation
  };

  /**
 * LLM configuration
 */
  llm?: LLMConfig;
}

/**
 * Language configuration
 */
export type Language = 'typescript' | 'python' | 'ruby' | 'go' | 'java' | 'csharp' | 'php';

/**
 * Pagination configuration
 */
export interface PaginationConfig {
  style: 'offset' | 'cursor' | 'page' | 'token';
  parameters: {
    limit?: string;
    cursor?: string;
    page?: string;
    offset?: string;
  };
  responseFields: {
    nextCursor?: string;
    hasMore?: string;
    totalCount?: string;
  };
}

/**
 * Authentication configuration
 */
export interface AuthConfig {
  types: Array<'apiKey' | 'bearer' | 'basic' | 'oauth2'>;
  locations?: Array<'header' | 'query' | 'cookie'>;
  names?: {
    apiKey?: string;
    bearerPrefix?: string;
  };
  oauth2?: {
    flows: Array<'clientCredentials' | 'authorizationCode' | 'implicit' | 'password'>;
    scopes?: string[];
  };
}

/**
 * Error handling configuration
 */
export interface ErrorHandlingConfig {
  strategies: Array<'throw' | 'return' | 'callback'>;
  customErrors?: Record<string, {
    status: number;
    message: string;
  }>;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffFactor: number;
  retryableStatusCodes: number[];
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  enabled: boolean;
  requestsPerSecond?: number;
  requestsPerMinute?: number;
  requestsPerHour?: number;
  queueStrategy?: 'fifo' | 'priority';
}

/**
 * Schema definition
 */
export interface SchemaDefinition {
  name: string;
  type: string;
  description?: string;
  properties?: Record<string, SchemaPropertyDefinition>;
  required?: string[];
  enum?: any[];
  default?: any;
  nullable?: boolean;
  deprecated?: boolean;
  format?: string;
  reference?: string;
  items?: SchemaDefinition;
  oneOf?: SchemaDefinition[];
  anyOf?: SchemaDefinition[];
  allOf?: SchemaDefinition[];
}

/**
 * Schema property definition
 */
export interface SchemaPropertyDefinition {
  type: string;
  description?: string;
  format?: string;
  enum?: any[];
  default?: any;
  nullable?: boolean;
  deprecated?: boolean;
  reference?: string;
  items?: SchemaPropertyDefinition;
  properties?: Record<string, SchemaPropertyDefinition>;
  required?: string[];
  minimum?: number;
  maximum?: number;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
}


export interface ConfigFeatures {
  pagination?: {
    style: string;
    parameters: Record<string, string>;
    responseFields: Record<string, string>;
  };
  authentication?: {
    types: string[];
    locations: string[];
    names?: Record<string, string>;
    oauth2?: {
      flows: string[];
      scopes: string[];
    };
  };
  retries?: {
    maxRetries: number;
    initialDelay: number;
    maxDelay: number;
    backoffFactor: number;
    retryableStatusCodes: number[];
  };
}



/**
* LLM configuration for PlainSDK
*/
export interface LLMConfig {
  /**
   * LLM provider to use
   */
  provider?: 'anthropic' | 'openai' | 'custom';

  /**
   * API key for the LLM service
   */
  apiKey?: string;

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

  /**
   * Whether to use LLM instead of the template-based approach
   */
  useForGeneration?: boolean;

  /**
   * Languages to use LLM for (if undefined, use for all languages)
   */
  languages?: string[];


   /**
   * Whether to include code examples in the prompt for consistency
   */
   includeExamples?: boolean;
  
   /**
    * Whether to apply post-processing for consistency
    */
   applyConsistencyRules?: boolean;
   
   /**
    * Path to a custom style guide file
    */
   styleGuidePath?: string;
   
   /**
    * Consistency strategy: 'strict' enforces rigid patterns, 'balanced' allows some flexibility
    */
   consistencyLevel?: 'strict' | 'balanced' | 'flexible';
}
