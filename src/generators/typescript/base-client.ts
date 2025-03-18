import { PlainSDKConfig } from '../../types';

/**
 * Generate base client module for TypeScript SDK
 * 
 * @param config - PlainSDK configuration
 * @returns Generated base client content
 */
export async function generateBaseClient(
  config: PlainSDKConfig
): Promise<string> {
  // Extract configurations
  const hasRetries = !!config.features?.retries;
  const hasRateLimit = !!config.features?.rateLimit;
  
  return `import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { Configuration, RequestOptions } from './types';
import { ApiError } from './errors';
${hasRetries ? "import { RetryConfig } from './types';" : ''}
${hasRateLimit ? "import { RateLimitConfig } from './types';" : ''}

/**
 * Base API client class with common functionality
 */
export class BaseAPI {
  /**
   * Axios instance for making requests
   */
  protected readonly axios: AxiosInstance;
  
  /**
   * Configuration for the API client
   */
  protected readonly configuration: Configuration;
  
  /**
   * Create a new API client
   * @param configuration - Client configuration
   */
  constructor(configuration?: Partial<Configuration>) {
    this.configuration = {
      baseUrl: 'https://api.example.com',
      timeout: 30000,
      ...configuration,
    };
    
    this.axios = axios.create({
      baseURL: this.configuration.baseUrl,
      timeout: this.configuration.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...this.configuration.headers,
      },
    });
    
    // Add authentication interceptor
    this.axios.interceptors.request.use(this.authInterceptor.bind(this));
    
    // Add retry interceptor if configured
    ${hasRetries ? `if (this.configuration.retry && this.configuration.retry.maxRetries > 0) {
      this.axios.interceptors.response.use(
        response => response,
        this.retryInterceptor.bind(this)
      );
    }` : ''}
    
    ${hasRateLimit ? `// Add rate limiting interceptor if configured
    if (this.configuration.rateLimit && this.configuration.rateLimit.enabled) {
      this.axios.interceptors.request.use(this.rateLimitInterceptor.bind(this));
    }` : ''}
  }
  
  /**
   * Make an API request
   * @param url - Request URL (relative to base URL)
   * @param options - Request options
   * @returns Request response
   */
  protected async request<T>(url: string, options: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.axios.request<T>({
        url,
        ...options,
      });
      
      return response.data;
    } catch (error) {
      // Handle error
      this.handleError(error);
      throw error;
    }
  }
  
  /**
   * Add authentication to requests
   * @param config - Request configuration
   * @returns Modified request configuration
   */

  private authInterceptor(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
  // Add authentication based on available credentials
  if (this.configuration.bearerToken) {
    config.headers.set('Authorization', \`Bearer \${this.configuration.bearerToken}\`);
  } else if (this.configuration.apiKey) {
    config.headers.set('X-API-Key', this.configuration.apiKey);
  } else if (this.configuration.username && this.configuration.password) {
    const basicAuth = Buffer.from(
      \`\${this.configuration.username}:\${this.configuration.password}\`
    ).toString('base64');
    
    config.headers.set('Authorization', \`Basic \${basicAuth}\`);
  }
  
  return config;
}


  ${hasRetries ? `
  /**
   * Retry failed requests
   * @param error - Request error
   * @returns Retry promise
   */
  private async retryInterceptor(error: any): Promise<AxiosResponse> {
    if (!error.config) {
      return Promise.reject(error);
    }
    
    const retryConfig = this.configuration.retry;
    
    if (!retryConfig) {
      return Promise.reject(error);
    }
    
    // Get current retry attempt or initialize to 0
    const retryAttempt = error.config.__retryAttempt ?? 0;
    
    // Check if we should retry
    const shouldRetry =
      retryAttempt < retryConfig.maxRetries &&
      (!error.response || retryConfig.retryableStatusCodes.includes(error.response.status));
    
    if (!shouldRetry) {
      return Promise.reject(error);
    }
    
    // Calculate delay with exponential backoff
    const delay = Math.min(
      retryConfig.initialDelay * Math.pow(retryConfig.backoffFactor, retryAttempt),
      retryConfig.maxDelay
    );
    
    // Wait for the delay
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Retry the request
    error.config.__retryAttempt = retryAttempt + 1;
    return this.axios.request(error.config);
  }` : ''}
  ${hasRateLimit ? `
  /**
   * Apply rate limiting to requests
   * @param config - Request configuration
   * @returns Modified request configuration
   */
  private async rateLimitInterceptor(config: AxiosRequestConfig): Promise<AxiosRequestConfig> {
    const rateLimitConfig = this.configuration.rateLimit;
    
    if (!rateLimitConfig || !rateLimitConfig.enabled) {
      return config;
    }
    
    // Implement token bucket rate limiting
    const tokensPerSecond = rateLimitConfig.requestsPerSecond || 
                            (rateLimitConfig.requestsPerMinute ? rateLimitConfig.requestsPerMinute / 60 : 10);
    
    // If this is the first request, initialize the token bucket
    if (!this._tokenBucket) {
      this._tokenBucket = {
        tokens: 1,
        lastRefill: Date.now(),
      };
    }
    
    // Refill the token bucket based on time elapsed
    const now = Date.now();
    const elapsed = (now - this._tokenBucket.lastRefill) / 1000;
    this._tokenBucket.tokens = Math.min(1, this._tokenBucket.tokens + elapsed * tokensPerSecond);
    this._tokenBucket.lastRefill = now;
    
    // If we have a token, consume it and proceed with the request
    if (this._tokenBucket.tokens >= 1) {
      this._tokenBucket.tokens -= 1;
      return config;
    }
    
    // If we don't have a token, wait for one to become available
    const waitTime = (1 - this._tokenBucket.tokens) / tokensPerSecond * 1000;
    await new Promise(resolve => setTimeout(resolve, waitTime));
    
    // Consume the token and proceed
    this._tokenBucket.tokens = 0;
    this._tokenBucket.lastRefill = Date.now();
    
    return config;
  }
  
  // Token bucket for rate limiting
  private _tokenBucket: { tokens: number; lastRefill: number } | null = null;` : ''}
  
  /**
   * Handle request errors
   * @param error - Request error
   */
  private handleError(error: any): void {
    // Log error or perform additional handling
    if (error.response) {
      // Server responded with non-2xx status
      console.error(\`API Error: \${error.response.status} \${error.response.statusText}\`);
    } else if (error.request) {
      // Request was made but no response received
      console.error('API Error: No response received');
    } else {
      // Error setting up the request
      console.error(\`API Error: \${error.message}\`);
    }
  }
}
`;
}