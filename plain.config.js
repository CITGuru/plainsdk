// plainsdk.config.js
module.exports = {
    // Base configuration
    name: "@company/api-sdk",
    version: "1.0.0",
    description: "SDK for Company API",
    sourceOpenAPI: "./openapi.yaml",
    
    // Output configuration
    outputDir: "./generated-sdks",
    languages: ["typescript", "python"],
    
    // SDK features
    features: {
      // Pagination configuration
      pagination: {
        style: "cursor",
        parameters: {
          limit: "limit",
          cursor: "cursor"
        },
        responseFields: {
          nextCursor: "next_cursor",
          hasMore: "has_more"
        }
      },
      
      // Authentication configuration
      authentication: {
        types: ["apiKey", "bearer"],
        locations: ["header"],
        names: {
          apiKey: "X-API-Key"
        }
      },
      
      // Error handling configuration
      errorHandling: {
        strategies: ["throw"],
        customErrors: {
          RateLimitExceeded: {
            status: 429,
            message: "Rate limit exceeded"
          }
        }
      },
      
      // Retry configuration
      retries: {
        maxRetries: 3,
        initialDelay: 300,
        maxDelay: 5000,
        backoffFactor: 2,
        retryableStatusCodes: [408, 429, 500, 502, 503, 504]
      }
    },
    
    // Naming conventions
    naming: {
      methodStyle: "camelCase",
      parameterStyle: "camelCase",
      resourceStyle: "PascalCase",
      modelStyle: "PascalCase"
    },
    
    // Hooks for pre/post processing
    hooks: {
      postGenerate: "scripts/post-generate.js"
    }
  };