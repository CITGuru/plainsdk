import { PlainSDKConfig } from '../../types';

/**
 * Generate error handling module for TypeScript SDK
 * 
 * @param errorConfig - Error handling configuration
 * @param config - PlainSDK configuration
 * @returns Generated error handling files
 */
export async function generateErrorHandling(
  errorConfig: any,
  config: PlainSDKConfig
): Promise<Record<string, string>> {
  // If no error handling config, return empty object
  if (!errorConfig) {
    return {
      'src/core/errors.ts': generateDefaultErrors()
    };
  }

  // Generate error handling module based on configuration
  const errorsContent = generateErrorsModule(errorConfig);

  return {
    'src/core/errors.ts': errorsContent
  };
}

/**
 * Generate default error handling module
 * 
 * @returns Default error handling content
 */
function generateDefaultErrors(): string {
  return `
  /**
 * API Error class for handling errors from the API
 */
export class ApiError extends Error {
  /**
   * HTTP status code
   */
  public readonly statusCode: number;
  
  /**
   * Error code from the API
   */
  public readonly errorCode?: string;
  
  /**
   * Response data from the API
   */
  public readonly response?: any;
  
  /**
   * Create a new API error
   * @param message - Error message
   * @param statusCode - HTTP status code
   * @param errorCode - Error code
   * @param response - Response data
   */
  constructor(
    message: string, 
    statusCode: number,
    errorCode?: string, 
    response?: any
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.response = response;
    
    // Maintain proper stack trace in Node.js environments
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  /**
   * Create an ApiError from an Axios error
   * @param error - Axios error
   * @returns ApiError instance
   */
  public static fromAxiosError(error: any): ApiError {
    if (error.response) {
      const { data, status } = error.response;
      const errorCode = data?.code || data?.error_code || data?.errorCode;
      const message = data?.message || data?.error_message || data?.errorMessage || error.message;
      
      return new ApiError(message, status, errorCode, data);
    }
    
    return new ApiError(
      error.message || 'Unknown API error',
      error.status || 0
    );
  }
}`
}



/**
 * Generate errors module based on configuration
 * 
 * @param errorConfig - Error handling configuration
 * @returns Errors module content
 */
function generateErrorsModule(errorConfig: any): string {
  const strategies = errorConfig.strategies || ['throw'];
  const customErrors = errorConfig.customErrors || {};
  
  let content = `/**
 * API Error class for handling errors from the API
 */
export class ApiError extends Error {
  /**
   * HTTP status code
   */
  public readonly statusCode: number;
  
  /**
   * Error code from the API
   */
  public readonly errorCode?: string;
  
  /**
   * Response data from the API
   */
  public readonly response?: any;
  
  /**
   * Create a new API error
   * @param message - Error message
   * @param statusCode - HTTP status code
   * @param errorCode - Error code
   * @param response - Response data
   */
  constructor(
    message: string, 
    statusCode: number,
    errorCode?: string, 
    response?: any
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.response = response;
    
    // Maintain proper stack trace in Node.js environments
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  /**
   * Create an ApiError from an Axios error
   * @param error - Axios error
   * @returns ApiError instance
   */
  public static fromAxiosError(error: any): ApiError {
    if (error.response) {
      const { data, status } = error.response;
      const errorCode = data?.code || data?.error_code || data?.errorCode;
      const message = data?.message || data?.error_message || data?.errorMessage || error.message;
      
      return new ApiError(message, status, errorCode, data);
    }
    
    return new ApiError(
      error.message || 'Unknown API error',
      error.status || 0
    );
  }
}\n`;
  
  // Add custom error classes if defined
  if (Object.keys(customErrors).length > 0) {
    content += '\n';
    
    for (const [errorName, errorDef] of Object.entries(customErrors) as Array<[string, { message?: string, status?: string }]>) {
      content += `/**
 * ${errorDef.message || errorName}
 */
export class ${errorName} extends ApiError {
  constructor(
    message: string = '${errorDef.message || errorName}',
    statusCode: number = ${errorDef.status || 500},
    errorCode: string = '${errorName}',
    response?: any
  ) {
    super(message, statusCode, errorCode, response);
    this.name = '${errorName}';
  }
}\n\n`;
    }
  }
  
  // Add error handler class if needed
  if (strategies.includes('callback') || strategies.includes('return')) {
    content += `/**
 * Result of an API operation that might fail
 */
export interface ApiResult<T> {
  /**
   * Whether the operation was successful
   */
  success: boolean;
  
  /**
   * Data from the API (if successful)
   */
  data?: T;
  
  /**
   * Error information (if failed)
   */
  error?: ApiError;
}

/**
 * Error handling strategies
 */
export type ErrorStrategy = ${strategies.map((s: any) => `'${s}'`).join(' | ')};

/**
 * Error handler for API requests
 */
export class ErrorHandler {
  /**
   * Current error handling strategy
   */
  private strategy: ErrorStrategy;
  
  /**
   * Create a new error handler
   * @param strategy - Error handling strategy
   */
  constructor(strategy: ErrorStrategy = 'throw') {
    this.strategy = strategy;
  }
  
  /**
   * Set the error handling strategy
   * @param strategy - Error handling strategy
   */
  public setStrategy(strategy: ErrorStrategy): void {
    this.strategy = strategy;
  }
  
  /**
   * Handle an error based on the current strategy
   * @param error - Error to handle
   * @param callback - Callback for 'callback' strategy
   * @returns Result for 'return' strategy
   */
  public handleError<T>(error: any, callback?: (error: ApiError) => void): ApiResult<T> | never {
    const apiError = error instanceof ApiError
      ? error
      : ApiError.fromAxiosError(error);
    
    switch (this.strategy) {
      case 'return':
        return {
          success: false,
          error: apiError,
        };
      case 'callback':
        if (callback) {
          callback(apiError);
          return { success: false, error: apiError };
        }
        // Fall through to throw if no callback provided
      case 'throw':
      default:
        throw apiError;
    }
  }
  
  /**
   * Handle a successful response
   * @param data - Response data
   * @returns Result for 'return' strategy
   */
  public handleSuccess<T>(data: T): ApiResult<T> {
    if (this.strategy === 'return' || this.strategy === 'callback') {
      return {
        success: true,
        data,
      };
    }
    
    return data as any;
  }
}\n`;
  }
  
  // Create factory method for custom errors if needed
  if (Object.keys(customErrors).length > 0) {
    content += `
/**
 * Factory for creating API errors
 */
export class ApiErrorFactory {
  /**
   * Create an API error based on status code and error code
   * @param status - HTTP status code
   * @param message - Error message
   * @param errorCode - Error code
   * @param response - Response data
   * @returns Appropriate API error instance
   */
  public static createError(
    status: number,
    message: string,
    errorCode?: string,
    response?: any
  ): ApiError {
    // Check for specific error status codes
    switch (status) {
${Object.entries(customErrors)
  .map(([errorName, errorDef]: [string, any] ) => 
    `      case ${errorDef.status}:
        return new ${errorName}(message, ${errorDef.status}, errorCode || '${errorName}', response);`)
  .join('\n')}
      default:
        return new ApiError(message, status, errorCode, response);
    }
  }
}\n`;
  }
  
  return content;
}

// /**
//  * Generate default error handling module
//  * 
//  * @returns Default error handling content
//  */
// function generateErrorsModule(c: any): string {
//   return `
//   /**
//    * API Error class for handling errors from the API
//    */
//     export class ApiError extends Error {
//       /**
//        * HTTP status code
//        */
//       public readonly statusCode: number;
      
//       /**
//        * Error code from the API
//        */
//       public readonly errorCode?: string;
      
//       /**
//        * Response data from the API
//        */
//       public readonly response?: any;
      
//       /**
//        * Create a new API error
//        * @param message - Error message
//        * @param statusCode - HTTP status code
//        * @param errorCode - Error code
//        * @param response - Response data
//        */
//       constructor(
//         message: string, 
//         statusCode: number,
//         errorCode?: string, 
//         response?: any
//       ) {
//         super(message);
//         this.name = 'ApiError';
//         this.statusCode = statusCode;
//         this.errorCode = errorCode;
//         this.response = response;
        
//         // Maintain proper stack trace in Node.js environments
//         if (typeof Error.captureStackTrace === 'function') {
//           Error.captureStackTrace(this, this.constructor);
//         }
//       }
      
//       /**
//        * Create an ApiError from an Axios error
//        * @param error - Axios error
//        * @returns ApiError instance
//        */
//       public static fromAxiosError(error: any): ApiError {
//         if (error.response) {
//           const { data, status } = error.response;
//           const errorCode = data?.code || data?.error_code || data?.errorCode;
//           const message = data?.message || data?.error_message || data?.errorMessage || error.message;
          
//           return new ApiError(message, status, errorCode, data);
//         }
        
//         return new ApiError(
//           error.message || 'Unknown API error',
//           error.status || 0
//         );
//       }
//     }`
// }