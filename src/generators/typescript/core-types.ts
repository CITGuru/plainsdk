import { PlainSDKConfig } from '../../types';

/**
 * Generate core types module for TypeScript SDK
 * 
 * @param config - PlainSDK configuration
 * @returns Generated core types content
 */
export async function generateCoreTypes(
  config: PlainSDKConfig
): Promise<string> {
  return `import { AxiosRequestConfig, AxiosResponse } from 'axios';
import { AuthConfig } from './auth';

/**
 * Configuration options for the API client
 */
export interface Configuration {
  /**
   * Base URL for API requests
   */
  baseUrl: string;
  
  /**
   * API key for authentication (if applicable)
   */
  apiKey?: string;
  
  /**
   * Bearer token for authentication (if applicable)
   */
  bearerToken?: string;
  
  /**
   * Username for basic authentication (if applicable)
   */
  username?: string;
  
  /**
   * Password for basic authentication (if applicable)
   */
  password?: string;
  
  /**
   * Request timeout in milliseconds
   */
  timeout?: number;
  
  /**
   * Additional headers to include with requests
   */
  headers?: Record<string, string>;
  
  /**
   * Retry configuration
   */
  retry?: RetryConfig;
  
  /**
   * Whether to automatically handle pagination
   */
  handlePagination?: boolean;
  
  /**
   * Authentication configuration
   */
  auth?: AuthConfig;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  /**
   * Maximum number of retry attempts
   */
  maxRetries: number;
  
  /**
   * Initial delay between retries in milliseconds
   */
  initialDelay: number;
  
  /**
   * Maximum delay between retries in milliseconds
   */
  maxDelay: number;
  
  /**
   * Factor by which to increase delay on each retry
   */
  backoffFactor: number;
  
  /**
   * HTTP status codes to retry
   */
  retryableStatusCodes: number[];
}

/**
 * Additional request options
 */
export interface RequestOptions extends AxiosRequestConfig {
  /**
   * Whether to handle this request as paginated
   */
  paginated?: boolean;
  
  /**
   * Whether to retry this request on failure
   */
  retry?: boolean;
  
  /**
   * Retry configuration for this request (overrides global config)
   */
  retryConfig?: RetryConfig;
}
`;
}