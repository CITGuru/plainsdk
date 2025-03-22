import fs from 'fs/promises';
import path from 'path';
import { PlainSDKConfig, LLMConfig } from '../../types';
import { loadOpenAPISpec } from '../../utils/loader';
import { mergeWithExisting } from '../../utils/merge';
import { trackFile, cacheGeneratedContent } from '../../generator';
import axios from 'axios';

/**
 * Generate SDK using Language Model API
 * 
 * @param config - PlainSDK configuration
 * @param language - Target programming language
 * @param llmConfig - LLM configuration
 */
export async function generateSDKWithLLMv1(
    config: PlainSDKConfig,
    language: string,
    llmConfig: LLMConfig | any
): Promise<void> {
    if (!llmConfig) {
        throw new Error("LLM Config is missing ")
    }
    console.log(`Generating ${language} SDK using ${llmConfig.provider}...`);

    const sourceOpenAPI = config.basePath + '/' + config.sourceOpenAPI


    // Load OpenAPI spec
    const openApiSpec = await loadOpenAPISpec(sourceOpenAPI);

    // Create output directory
    const outputDir = path.resolve(process.cwd(), config.outputDir, language);
    await fs.mkdir(outputDir, { recursive: true });

    // Create prompt for the LLM
    const prompt = generatePrompt(config, language, openApiSpec);

    // Call LLM service

    try {

        const generatedCode = await callLLMService(prompt, llmConfig);

        // Parse and organize the generated code
        const files = parseGeneratedCode(generatedCode, language);

        // Write files to disk
        for (const [filePath, content] of Object.entries(files)) {
            const fullPath = path.join(outputDir, filePath);
            const dirPath = path.dirname(fullPath);

            // Ensure directory exists
            await fs.mkdir(dirPath, { recursive: true });

            // Check if file already exists
            let finalContent = content;
            try {
                const existingContent = await fs.readFile(fullPath, 'utf-8');
                // Merge with existing content if the file already exists
                finalContent = await mergeWithExisting(existingContent, content, filePath);
            } catch (error) {
                // File doesn't exist, use generated content
            }

            // Write file
            await fs.writeFile(fullPath, finalContent, 'utf-8');

            // Track file for future merges
            await trackFile(path.join(language, filePath));

            // Cache generated content
            await cacheGeneratedContent(path.join(language, filePath), content);
        }

    } catch (er: any) {
        console.log(er?.response.data)
    }


    console.log(`${language} SDK generation with ${llmConfig.provider} complete!`);
}


/**
 * Generate SDK using Language Model API
 * 
 * @param config - PlainSDK configuration
 * @param language - Target programming language
 * @param llmConfig - LLM configuration
 */
export async function generateSDKWithLLM(
    config: PlainSDKConfig,
    language: string,
    llmConfig: LLMConfig | any
): Promise<void> {
    console.log(`Generating ${language} SDK using ${llmConfig.provider} with enhanced consistency...`);

    // Load OpenAPI spec
    const openApiSpec = await loadOpenAPISpec(config.sourceOpenAPI);

    // Create output directory
    const outputDir = path.resolve(process.cwd(), config.outputDir, language);
    await fs.mkdir(outputDir, { recursive: true });

    // Create consistent prompt for the LLM
    const prompt = generateConsistentPrompt(config, language, openApiSpec);

    // Add examples for consistency if appropriate
    const examplesPrompt = config.llm?.includeExamples !== false ?
        generateExamples(config, language) : '';

    const fullPrompt = prompt + examplesPrompt;

    // Call LLM service
    const generatedCode = await callLLMService(fullPrompt, llmConfig);

    // Parse and organize the generated code
    let files = parseGeneratedCode(generatedCode, language);

    // Post-process for consistency
    files = postProcessForConsistency(files, language);

    // Write files to disk
    for (const [filePath, content] of Object.entries(files)) {
        const fullPath = path.join(outputDir, filePath);
        const dirPath = path.dirname(fullPath);

        // Ensure directory exists
        await fs.mkdir(dirPath, { recursive: true });

        // Check if file already exists
        let finalContent = content;
        try {
            const existingContent = await fs.readFile(fullPath, 'utf-8');
            // Merge with existing content if the file already exists
            finalContent = await mergeWithExisting(existingContent, content, filePath);
        } catch (error) {
            // File doesn't exist, use generated content
        }

        // Write file
        await fs.writeFile(fullPath, finalContent, 'utf-8');

        // Track file for future merges
        await trackFile(path.join(language, filePath));

        // Cache generated content
        await cacheGeneratedContent(path.join(language, filePath), content);
    }

    console.log(`${language} SDK generation with ${llmConfig.provider} complete!`);
}

// /**
//  * LLM service provider configuration
//  */
// export interface LLMConfig {
//     provider: 'openai' | 'anthropic' | 'custom';
//     apiKey: string;
//     model?: string;
//     endpoint?: string;
//     maxTokens?: number;
//     temperature?: number;
// }

/**
 * Generate prompt for the LLM
 */
function generatePrompt(config: PlainSDKConfig, language: string, openApiSpec: any): string {
    // Convert OpenAPI spec to string
    const specString = JSON.stringify(openApiSpec, null, 2);

    // Base prompt template
    let prompt = `You are an expert SDK generator. Your task is to generate a complete, idiomatic ${language} SDK for the following OpenAPI specification. 

The SDK should follow these requirements:
1. Be well-structured and follow ${language} best practices and conventions
2. Include proper error handling
3. Support pagination (${config.features.pagination?.style || 'cursor'}-based)
4. Implement authentication (${config.features.authentication?.types?.join(', ') || 'apiKey'})
5. Include comprehensive documentation
6. Be easy to use and maintain

Here's the OpenAPI specification:
\`\`\`json
${specString}
\`\`\`

Here are additional configuration preferences:
- Naming conventions: ${JSON.stringify(config.naming)}
- Features: ${JSON.stringify(config.features)}

Please generate a complete SDK that developers can use to interact with this API. Include all necessary files, classes, and documentation.
Format your response with code blocks for each file, with the file path as the title. For example:

# src/client.ts
\`\`\`typescript
// Code here
\`\`\`

# src/models/user.ts
\`\`\`typescript
// Code here
\`\`\`

This format will help me parse your response into separate files.`;

    // Add language-specific instructions
    switch (language) {
        case 'typescript':
            prompt += `\n\nFor TypeScript specifically:
- Use interfaces for models
- Use Axios for HTTP requests
- Include proper type definitions
- Make the SDK compatible with both Node.js and browser environments`;
            break;
        case 'python':
            prompt += `\n\nFor Python specifically:
- Use dataclasses for models
- Follow PEP 8 style guidelines
- Make the SDK compatible with Python 3.7+
- Use the requests library for HTTP requests`;
            break;
        case 'java':
            prompt += `\n\nFor Java specifically:
- Use proper OOP principles
- Include Builder patterns where appropriate
- Make the SDK compatible with Java 8+
- Use appropriate annotations`;
            break;
        // Add more languages as needed
    }

    return prompt;
}

/**
 * Call LLM service to generate code
 */
async function callLLMService(prompt: string, config: LLMConfig): Promise<string> {
    switch (config.provider) {
        case 'anthropic':
            return callAnthropic(prompt, config);
        case 'openai':
            return callOpenAI(prompt, config);
        case 'custom':
            return callCustomLLM(prompt, config);
        default:
            throw new Error(`Unsupported LLM provider: ${config.provider}`);
    }
}

/**
 * Call Anthropic API (Claude)
 */
async function callAnthropic(prompt: string, config: LLMConfig): Promise<string> {
    const response = await axios.post(
        config.endpoint || 'https://api.anthropic.com/v1/messages',
        {
            model: config.model || 'claude-3-opus-20240229',
            max_tokens: 64000,
            temperature: config.temperature || 0.2,
            messages: [
                { role: 'user', content: prompt }
            ]
        },
        {
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': config.apiKey,
                'anthropic-version': '2023-06-01'
            }
        }
    );

    return response.data.content[0].text;
}

/**
 * Call OpenAI API (GPT-4)
 */
async function callOpenAI(prompt: string, config: LLMConfig): Promise<string> {
    const response = await axios.post(
        config.endpoint || 'https://api.openai.com/v1/chat/completions',
        {
            model: config.model || 'gpt-4',
            max_tokens: config.maxTokens || 8192,
            temperature: config.temperature || 0.2,
            messages: [
                { role: 'system', content: 'You are an expert SDK generator that produces clean, idiomatic code.' },
                { role: 'user', content: prompt }
            ]
        },
        {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`
            }
        }
    );


    return response.data.choices[0].message.content;
}

/**
 * Call custom LLM API
 */
async function callCustomLLM(prompt: string, config: LLMConfig): Promise<string> {
    if (!config.endpoint) {
        throw new Error('Custom LLM requires an endpoint URL');
    }

    const response = await axios.post(
        config.endpoint,
        {
            prompt,
            max_tokens: config.maxTokens || 8192,
            temperature: config.temperature || 0.2
        },
        {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`
            }
        }
    );

    return response.data.text || response.data.content || response.data.completion;
}

/**
 * Parse generated code into separate files
 */
function parseGeneratedCode(generatedCode: string, language: string): Record<string, string> {
    const files: Record<string, string> = {};

    // Regular expression to match file blocks
    // Matches patterns like: # path/to/file.ext followed by ```language code ```
    const fileBlockPattern = /#+\s*([^\n]+)\n```(?:[a-z]+)?\n([\s\S]*?)```/g;

    let match;
    while ((match = fileBlockPattern.exec(generatedCode)) !== null) {
        let [_, filePath, fileContent] = match;

        // Clean up file path
        filePath = filePath.trim();

        // Extract file content
        fileContent = fileContent.trim();

        // Add to files
        files[filePath] = fileContent;
    }

    // If no files were parsed, try to identify language-specific patterns
    if (Object.keys(files).length === 0) {
        const languagePatterns: Record<string, RegExp> = {
            typescript: /(?:\/\/\s*([a-zA-Z0-9\/_.-]+\.ts))\n([\s\S]*?)(?=\/\/\s*[a-zA-Z0-9\/_.-]+\.ts|$)/g,
            python: /(?:#\s*([a-zA-Z0-9\/_.-]+\.py))\n([\s\S]*?)(?=#\s*[a-zA-Z0-9\/_.-]+\.py|$)/g,
            java: /(?:\/\/\s*([a-zA-Z0-9\/_.-]+\.java))\n([\s\S]*?)(?=\/\/\s*[a-zA-Z0-9\/_.-]+\.java|$)/g
        };

        const pattern = languagePatterns[language];
        if (pattern) {
            while ((match = pattern.exec(generatedCode)) !== null) {
                let [_, filePath, fileContent] = match;
                files[filePath.trim()] = fileContent.trim();
            }
        }
    }

    // If still no files were parsed, create a single file with all the code
    if (Object.keys(files).length === 0) {
        const extensions: Record<string, string> = {
            typescript: 'ts',
            python: 'py',
            java: 'java',
            ruby: 'rb',
            go: 'go',
            csharp: 'cs',
            php: 'php'
        };

        const ext = extensions[language] || 'txt';
        files[`sdk.${ext}`] = generatedCode;
    }

    return files;
}


/**
 * Enhanced prompt generator with consistency features
 */
function generateConsistentPrompt(config: PlainSDKConfig, language: string, openApiSpec: any): string {
    // Convert OpenAPI spec to string
    const specString = JSON.stringify(openApiSpec, null, 2);

    // Base prompt with strong consistency guidance
    let prompt = `You are an expert SDK generator tasked with creating a complete, idiomatic ${language} SDK for the following OpenAPI specification. 
  
  CONSISTENCY REQUIREMENTS:
  1. Follow a consistent coding style throughout all files
  2. Use consistent naming patterns for all similar entities
  3. Use consistent error handling approaches in all files
  4. Maintain consistent documentation format and level of detail
  5. Use consistent patterns for similar operations (e.g., CRUD operations)
  6. Structure all files in a consistent way
  
  STYLE GUIDE:
  - Class/Type naming: Use ${config.naming.modelStyle} (e.g., UserAccount)
  - Method naming: Use ${config.naming.methodStyle} (e.g., ${config.naming.methodStyle === 'camelCase' ? 'getUserById' : config.naming.methodStyle === 'snake_case' ? 'get_user_by_id' : 'GetUserById'})
  - Parameter naming: Use ${config.naming.parameterStyle} (e.g., ${config.naming.parameterStyle === 'camelCase' ? 'userId' : 'user_id'})
  - All resources should follow consistent patterns
  - Error classes should all inherit from a common base class
  - Documentation should always include examples
  
  Here's the OpenAPI specification:
  \`\`\`json
  ${specString}
  \`\`\`
  
  Here are additional configuration preferences:
  - Naming conventions: ${JSON.stringify(config.naming)}
  - Features: ${JSON.stringify(config.features)}
  
  Please generate a complete SDK that developers can use to interact with this API. Include all necessary files, classes, and documentation.
  Format your response with code blocks for each file, with the file path as the title. For example:
  
  # src/client.ts
  \`\`\`typescript
  // Code here
  \`\`\`
  
  # src/models/user.ts
  \`\`\`typescript
  // Code here
  \`\`\`
  
  This format will help me parse your response into separate files.`;

    // Add language-specific consistency instructions
    switch (language) {
        case 'typescript':
            prompt += `\n\nTYPESCRIPT CONSISTENCY GUIDE:
  - Use interfaces for data models and abstract classes for base functionality
  - Use consistent type imports (import type { X } from 'y')
  - All method responses should be properly typed
  - Use consistent async/await pattern (not mixing with Promises)
  - Use consistent error handling (try/catch blocks with specific error types)
  - All public methods and classes should have JSDoc comments
  - All parameters should have proper types (no 'any' unless absolutely necessary)
  - Use strict null checking consistently
  - Use consistent export patterns`;
            break;
        case 'python':
            prompt += `\n\nPYTHON CONSISTENCY GUIDE:
  - Use dataclasses for models
  - All methods should have type hints
  - Use consistent docstring format (Google style)
  - Use consistent import grouping
  - Follow PEP 8 style consistently
  - Use consistent error handling with custom exception classes
  - Use consistent async patterns if needed
  - Maintain consistent method parameter ordering (self, required, optional)`;
            break;
        case 'java':
            prompt += `\n\nJAVA CONSISTENCY GUIDE:
  - Use consistent package structure
  - All classes should have appropriate javadoc
  - Use consistent builder patterns
  - Use consistent exception handling with custom exceptions
  - All methods should have consistent access modifiers
  - Use consistent null checking strategies
  - Follow consistent immutability patterns`;
            break;
    }

    // Add structural consistency guide
    prompt += `\n\nSTRUCTURAL CONSISTENCY:
  - All API resource classes should follow the same pattern
  - All model classes should follow the same structure
  - Helper utilities should be organized consistently
  - Authentication, pagination, and error handling should be consistent
  - Configuration options should follow the same pattern
  - The main client class should provide consistent access to all resources
  
  GENERATE THE COMPLETE SDK WITH CONSISTENT STRUCTURE AND STYLING.`;

    // Add any custom instructions from the config
    if (config.llm?.customInstructions) {
        prompt += `\n\nADDITIONAL REQUIREMENTS:\n${config.llm.customInstructions}`;
    }

    return prompt;
}



/**
* Generate examples to guide consistent structure
*/
function generateExamples(config: PlainSDKConfig, language: string): string {
    // Language-specific examples to guide LLM
    switch (language) {
        case 'typescript':
            return `
  Here are examples of the expected structure and style to ensure consistency:
  
  ## Example Model Class:
  \`\`\`typescript
  /**
   * Represents a User in the system
   */
  export interface User {
    /**
     * Unique identifier for the user
     */
    id: string;
    
    /**
     * User's email address
     */
    email: string;
    
    /**
     * User's display name
     */
    name?: string;
    
    /**
     * When the user was created
     */
    createdAt: Date;
  }
  \`\`\`
  
  ## Example API Client Class:
  \`\`\`typescript
  import { BaseAPI, RequestOptions, Configuration } from '../core';
  import { User, UserCreateParams, UserUpdateParams } from '../models';
  
  /**
   * API client for User resources
   */
  export class UsersClient extends BaseAPI {
    /**
     * Create a new UsersClient
     * @param configuration - Client configuration
     */
    constructor(configuration?: Configuration) {
      super(configuration);
    }
    
    /**
     * Get a user by ID
     * @param userId - ID of the user to retrieve
     * @param requestOptions - Additional request options
     * @returns The requested user
     * @throws {NotFoundError} When user doesn't exist
     * @throws {AuthenticationError} When not authenticated
     * @example
     * \`\`\`typescript
     * const user = await client.users.getUser('123');
     * console.log(user.name);
     * \`\`\`
     */
    public async getUser(userId: string, requestOptions?: RequestOptions): Promise<User> {
      const url = \`/users/\${userId}\`;
      
      const options: AxiosRequestConfig = {
        method: 'GET',
        ...requestOptions
      };
      
      return this.request<User>(url, options);
    }
    
    // ... other methods with consistent patterns
  }
  \`\`\`
  
  ## Example Error Handling:
  \`\`\`typescript
  try {
    const user = await client.users.getUser('123');
  } catch (error) {
    if (error instanceof NotFoundError) {
      // Handle not found
    } else if (error instanceof AuthenticationError) {
      // Handle authentication error
    } else {
      // Handle other errors
    }
  }
  \`\`\`
  `;
        case 'python':
            return `
  Here are examples of the expected structure and style to ensure consistency:
  
  ## Example Model Class:
  \`\`\`python
  from dataclasses import dataclass
  from datetime import datetime
  from typing import Optional
  
  @dataclass
  class User:
      """
      Represents a User in the system
      
      Attributes:
          id: Unique identifier for the user
          email: User's email address
          name: User's display name
          created_at: When the user was created
      """
      id: str
      email: str
      name: Optional[str] = None
      created_at: datetime = None
  \`\`\`
  
  ## Example API Client Class:
  \`\`\`python
  from typing import Dict, List, Optional, Any
  from ..core.config import Configuration
  from ..core.auth import Authentication
  from ..models.user import User
  
  class UsersClient:
      """
      API client for User resources
      """
      def __init__(self, config: Configuration, auth: Authentication):
          """
          Initialize the Users API client
          
          Args:
              config: API configuration
              auth: Authentication handler
          """
          self.config = config
          self.auth = auth
          self.session = requests.Session()
      
      def get_user(self, user_id: str, **kwargs) -> User:
          """
          Get a user by ID
          
          Args:
              user_id: ID of the user to retrieve
              **kwargs: Additional request parameters
              
          Returns:
              The requested user
              
          Raises:
              NotFoundError: When user doesn't exist
              AuthenticationError: When not authenticated
              
          Example:
              >>> user = client.users.get_user('123')
              >>> print(user.name)
          """
          url = f"{self.config.base_url}/users/{user_id}"
          
          headers = {}
          auth_headers = self.auth.apply_to_request(headers)
          headers.update(auth_headers)
          
          response = self.session.get(
              url,
              headers=headers,
              params=kwargs
          )
          
          response.raise_for_status()
          
          return User(**response.json())
          
      # ... other methods with consistent patterns
  \`\`\`
  
  ## Example Error Handling:
  \`\`\`python
  try:
      user = client.users.get_user('123')
  except NotFoundError:
      # Handle not found
  except AuthenticationError:
      # Handle authentication error
  except ApiError as e:
      # Handle other errors
  \`\`\`
  `;
        default:
            return '';
    }
}


/**
 * Post-processing to ensure consistency
 */
function postProcessForConsistency(files: Record<string, string>, language: string): Record<string, string> {
    const processedFiles: Record<string, string> = {};

    // Process each file for consistency
    for (const [filePath, content] of Object.entries(files)) {
        let processedContent = content;

        // Apply language-specific consistency rules
        switch (language) {
            case 'typescript':
                // Ensure consistent imports
                processedContent = processedContent.replace(/import\s+{([^}]+)}/g, (match, imports) => {
                    const importItems = imports.split(',').map((item: any) => item.trim()).sort();
                    return `import { ${importItems.join(', ')} }`;
                });

                // Ensure consistent JSDoc format
                processedContent = processedContent.replace(/\/\*\*\s*\n([^*]|\*[^/])*\*\//g, (jsdoc) => {
                    return jsdoc.replace(/^\s*\*\s+@/gm, ' * @');
                });
                break;

            case 'python':
                // Ensure consistent imports
                const importBlocks: string[] = [];
                let standardImports = '';
                let thirdPartyImports = '';
                let localImports = '';

                // Extract import blocks
                processedContent = processedContent.replace(/^(import\s+.*$|from\s+.*$)/gm, (importLine) => {
                    if (importLine.startsWith('import ')) {
                        if (importLine.includes(' as ') || !importLine.includes(' from ')) {
                            standardImports += importLine + '\n';
                        } else if (importLine.includes(' from ')) {
                            if (importLine.includes(' from ".') || importLine.includes(" from '.")) {
                                localImports += importLine + '\n';
                            } else {
                                thirdPartyImports += importLine + '\n';
                            }
                        }
                    } else if (importLine.startsWith('from ')) {
                        if (importLine.startsWith('from .') || importLine.startsWith('from "."') || importLine.startsWith("from '.")) {
                            localImports += importLine + '\n';
                        } else {
                            thirdPartyImports += importLine + '\n';
                        }
                    }
                    return '';
                });

                // Rebuild with consistent import ordering
                if (standardImports || thirdPartyImports || localImports) {
                    processedContent = standardImports + (standardImports ? '\n' : '') +
                        thirdPartyImports + (thirdPartyImports ? '\n' : '') +
                        localImports + (localImports ? '\n' : '') +
                        processedContent;
                }
                break;
        }

        processedFiles[filePath] = processedContent;
    }

    return processedFiles;
}