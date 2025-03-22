// Example plainsdk.config.js with LLM configuration
module.exports = {
    // Base configuration
    name: "@company/api-sdk",
    version: "1.0.0",
    description: "SDK for Company API",
    sourceOpenAPI: "./openapi.yaml",
    
    // Output configuration
    outputDir: "./sdks",
    languages: ["typescript", "python"],
    
    // SDK features
    features: {
      // ... standard features ...
    },
    
    // Naming conventions
    naming: {
      methodStyle: "camelCase",
      parameterStyle: "camelCase",
      resourceStyle: "PascalCase",
      modelStyle: "PascalCase"
    },
    
    // LLM configuration
    llm: {
      // Whether to use LLM instead of template-based generation
      useForGeneration: true,
      
      // LLM provider: 'anthropic', 'openai', or 'custom'
      provider: "anthropic",
      
      // API key (can also be set via environment variable)
      apiKey: process.env.ANTHROPIC_API_KEY,
      
      // Model to use (optional, defaults to provider's latest model)
      model: "claude-3-7-sonnet-20250219",
      
      // Only use LLM for these languages (optional, if omitted uses LLM for all languages)
      languages: ["typescript"],
      
      // Additional instructions for the LLM (optional)
      customInstructions: `
        Please ensure the generated SDK has these extra features:
        1. Comprehensive documentation with examples
        2. Unit tests for major components
        3. A simplified facade API for common operations
      `,
      
      // Advanced options (optional)
    //   maxTokens: 100000,
      temperature: 0.2
    }
  };