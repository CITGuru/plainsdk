# PlainSDK

Generate idiomatic and polished SDKs from OpenAPI specifications. PlainSDK helps developers deliver high-quality SDKs while staying focused on building their APIs.

## Features

- **Multiple Language Support**: Generate SDKs for TypeScript, Python, and more
- **Idiomatic Code**: Generate code that follows language conventions and best practices
- **Customizable**: Configure naming conventions, pagination, authentication, and more
- **Editable Generated Code**: Modify generated code freely - your changes persist across regenerations
- **Simple Configuration**: Get started with just an OpenAPI specification

## Installation

```bash
npm install -g plainsdk
```

## Quick Start

1. Initialize a new PlainSDK configuration:

```bash
plainsdk init --spec ./openapi.yaml
```

2. Generate SDKs:

```bash
plainsdk generate
```

3. Your SDKs are now available in the `./generated-sdks` directory.

## Configuration

PlainSDK uses a JavaScript configuration file (`plainsdk.config.js`) to customize the generated SDKs. Here's an example:

```js
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
  }
};
```

## Preserving Custom Changes

PlainSDK allows you to modify generated code without losing your changes when regenerating. Modifications are preserved using a smart diffing and merging system. Any manual changes you make will be automatically detected and preserved.

### How It Works

1. Modify any generated file as needed.
2. When regenerating the SDK, PlainSDK detects your custom changes.
3. The newly generated code is merged with your changes, preserving both your customizations and any updates from the OpenAPI spec.

## Supported Languages

PlainSDK currently supports generating SDKs for:

- TypeScript
- Python
- More coming soon...

## Command Line Interface

PlainSDK provides a command-line interface with the following commands:

- `plainsdk init`: Initialize a new PlainSDK configuration
- `plainsdk generate`: Generate SDKs based on configuration
- `plainsdk validate`: Validate an OpenAPI specification

## License

MIT