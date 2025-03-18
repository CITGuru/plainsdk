// PlainSDK configuration for the Pet Store API
module.exports = {
    // Base configuration
    name: "@petstore/api-sdk",
    version: "1.0.0",
    description: "SDK for the Pet Store API",
    sourceOpenAPI: "./openapi.yaml",
    
    // Output configuration
    outputDir: "./sdk",
    languages: ["typescript", "python"],
    
    // SDK features
    features: {
      // Pagination configuration
      pagination: {
        style: "offset",
        parameters: {
          limit: "limit",
          offset: "offset"
        },
        responseFields: {
          totalCount: "total"
        }
      },
      
      // Authentication configuration
      authentication: {
        types: ["apiKey"],
        locations: ["header"],
        names: {
          apiKey: "api_key"
        }
      },
      
      // Error handling configuration
      errorHandling: {
        strategies: ["throw"],
        customErrors: {
          InvalidInput: {
            status: 400,
            message: "Invalid input"
          },
          NotFound: {
            status: 404,
            message: "Pet not found"
          },
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
    // hooks: {
    //   postGenerate: "scripts/post-generate.js"
    // }
  };