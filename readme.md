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

<hr/>
<br/><br/>
<hr/>


# LLM-based SDK Generation

PlainSDK supports generating SDKs using Large Language Models (LLMs) like Claude and GPT-4, offering a powerful alternative to the template-based approach. This can be especially useful for complex APIs or when you need highly customized SDKs.

## How It Works

Instead of using predefined templates and code generators, PlainSDK can send your OpenAPI specification to an LLM along with specific instructions about how to generate the SDK. The LLM analyzes the API structure and produces idiomatic, well-documented code in your target programming language.

The process includes:

1. **Prompt Engineering**: PlainSDK constructs a detailed prompt containing your OpenAPI spec and generation preferences
2. **LLM API Call**: The prompt is sent to the selected LLM (Claude, GPT-4, etc.)
3. **Code Parsing**: The LLM's response is parsed into separate files
4. **File Writing**: The generated files are written to disk, with smart merging for existing files

## Configuration

To use LLM-based generation, add an `llm` section to your `plainsdk.config.js` file:

```javascript
module.exports = {
  // ... standard configuration ...
  
  // LLM configuration
  llm: {
    // Whether to use LLM instead of template-based generation
    useForGeneration: true,
    
    // LLM provider: 'anthropic', 'openai', or 'custom'
    provider: "anthropic",
    
    // API key (can also be set via environment variable)
    apiKey: process.env.ANTHROPIC_API_KEY,
    
    // Model to use (optional)
    model: "claude-3-opus-20240229",
    
    // Only use LLM for these languages (optional)
    languages: ["typescript", "python"],
    
    // Additional instructions (optional)
    customInstructions: "Make sure the SDK has comprehensive error handling...",
    
    // Advanced options (optional)
    maxTokens: 100000,
    temperature: 0.2
  }
};
```

### CLI Options

You can also enable LLM generation via the command line:

```bash
plainsdk generate --llm --llm-provider anthropic --llm-key YOUR_API_KEY
```

Available options:
- `--llm`: Enable LLM-based generation
- `--llm-provider <provider>`: Set the LLM provider (anthropic, openai, or custom)
- `--llm-key <apiKey>`: Set the API key for the LLM service
- `--llm-model <model>`: Specify which model to use

## Supported Providers

### Anthropic (Claude)

Claude excels at understanding complex APIs and generating high-quality, idiomatic code with excellent documentation. It's recommended for most SDK generation tasks.

```javascript
llm: {
  provider: "anthropic",
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: "claude-3-opus-20240229" // Or "claude-3-sonnet-20240229" for faster generation
}
```

### OpenAI (GPT-4)

GPT-4 is another excellent choice for SDK generation, with strong coding abilities and API understanding.

```javascript
llm: {
  provider: "openai",
  apiKey: process.env.OPENAI_API_KEY,
  model: "gpt-4-turbo" // Or "gpt-4" or other variants
}
```

### Custom Provider

You can also integrate with other LLM providers by using the "custom" provider type and specifying an endpoint URL.

```javascript
llm: {
  provider: "custom",
  apiKey: "YOUR_API_KEY",
  endpoint: "https://your-llm-service.com/api/generate",
  // Other parameters as needed by your service
}
```

## Custom Instructions

You can provide additional instructions to the LLM to tailor the generated SDK to your specific needs:

```javascript
customInstructions: `
  Please ensure the generated SDK:
  1. Uses reactive programming patterns with RxJS
  2. Includes detailed JSDoc comments for all public methods
  3. Implements robust connection pooling
  4. Has comprehensive error handling with specific error types
  5. Includes a high-level facade for common operations
`
```

## Working with Generated Code

The smart merging system works with LLM-generated code just like with template-generated code. You can modify the generated files, and when you regenerate the SDK, your modifications will be preserved.

## Best Practices

1. **Start with a Clean OpenAPI Spec**: The better your OpenAPI specification, the better the generated SDK will be
2. **Use Custom Instructions**: Provide specific guidance about your preferences and requirements
3. **Try Different Models**: Different LLMs may excel at different languages or styles
4. **Iterate**: Generate, review, refine your configuration, and regenerate

## Troubleshooting

- **Large API Specifications**: For very large APIs, you may need to use a model with higher token limits
- **Rate Limits**: Be aware of the rate limits of your LLM provider
- **API Keys**: Make sure your API key is correctly set either in the config or as an environment variable
- **Parse Errors**: If the LLM response isn't correctly parsed into files, check the syntax in your custom instructions

## License

MIT