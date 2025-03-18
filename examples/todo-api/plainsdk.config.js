// PlainSDK configuration for the Todo API
module.exports = {
    // Base configuration
    name: "@todoapi/sdk",
    version: "1.0.0",
    description: "SDK for the Todo API",
    sourceOpenAPI: "./openapi.yaml",
    
    // Output configuration
    outputDir: "./sdk",
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
        types: ["bearer"],
        locations: ["header"]
      },
      
      // Error handling configuration
      errorHandling: {
        strategies: ["throw"],
        customErrors: {
          ValidationError: {
            status: 400,
            message: "Validation error"
          },
          NotFoundError: {
            status: 404,
            message: "Resource not found"
          },
          AuthenticationError: {
            status: 401,
            message: "Authentication required"
          },
          ForbiddenError: {
            status: 403,
            message: "Permission denied"
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
    }
  };