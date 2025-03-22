import { PlainSDKConfig } from '../../types';
import { loadStyleGuide, getDefaultStyleGuide } from './style-guide';

/**
 * Generate a prompt for LLM-based SDK generation
 * 
 * @param config - PlainSDK configuration
 * @param language - Target programming language
 * @param openApiSpec - OpenAPI specification
 * @returns Formatted prompt for the LLM
 */
export async function generatePrompt(
  config: PlainSDKConfig,
  language: string,
  openApiSpec: any
): Promise<string> {
  // Convert OpenAPI spec to string
  const specString = JSON.stringify(openApiSpec, null, 2);
  
  // Load style guide
  const styleGuide = await loadStyleGuide(config, language) || getDefaultStyleGuide(language);
  
  // Create base prompt
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

${styleGuide ? `DETAILED STYLE GUIDELINES:\n${styleGuide}\n` : ''}

FEATURES TO IMPLEMENT:
${config.features.pagination ? `- Pagination (style: ${config.features.pagination.style})` : ''}
${config.features.authentication ? `- Authentication (types: ${config.features.authentication.types.join(', ')})` : ''}
${config.features.errorHandling ? `- Error handling (strategies: ${config.features.errorHandling.strategies.join(', ')})` : ''}
${config.features.retries ? `- Retry mechanism (max retries: ${config.features.retries.maxRetries})` : ''}

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
\`\`\``;

  // Add language-specific instructions
  prompt += getLanguageSpecificInstructions(language);
  
  // Add examples for consistency if configured
  if (config.llm?.includeExamples !== false) {
    prompt += getLanguageExamples(language);
  }
  
  // Add custom instructions if provided
  if (config.llm?.customInstructions) {
    prompt += `\n\nADDITIONAL REQUIREMENTS:\n${config.llm.customInstructions}`;
  }
  
  return prompt;
}

/**
 * Get language-specific instructions for the prompt
 */
function getLanguageSpecificInstructions(language: string): string {
  switch (language) {
    case 'typescript':
      return `\n\nTYPESCRIPT REQUIREMENTS:
- Use interfaces for data models and abstract classes for base functionality
- Use consistent type imports (import type { X } from 'y')
- All method responses should be properly typed
- Use consistent async/await pattern (not mixing with Promises)
- Use consistent error handling (try/catch blocks with specific error types)
- All public methods and classes should have JSDoc comments
- All parameters should have proper types (no 'any' unless absolutely necessary)
- Use strict null checking consistently
- Use consistent export patterns
- Use Axios for HTTP requests
- Make the SDK compatible with both Node.js and browser environments`;
      
    case 'python':
      return `\n\nPYTHON REQUIREMENTS:
- Use dataclasses for models
- All methods should have type hints
- Use consistent docstring format (Google style)
- Use consistent import grouping
- Follow PEP 8 style consistently
- Use consistent error handling with custom exception classes
- Use consistent async patterns if needed
- Maintain consistent method parameter ordering (self, required, optional)
- Use the requests library for HTTP requests
- Make the SDK compatible with Python 3.7+`;
      
    case 'go':
      return `\n\nGO REQUIREMENTS:
- Follow Go idiomatic patterns
- Use consistent error handling (return error as last return value)
- Provide proper documentation comments
- Use interfaces appropriately
- Follow standard Go project layout
- Make the SDK compatible with Go 1.13+`;
      
    default:
      return '';
  }
}

/**
 * Get language-specific examples for the prompt
 */
function getLanguageExamples(language: string): string {
  switch (language) {
    case 'typescript':
      return `\n\nEXAMPLES FOR CONSISTENCY:

## Example Model:
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
   * User's display name (optional)
   */
  name?: string;
  
  /**
   * When the user was created
   */
  createdAt: string;
}
\`\`\`

## Example API Client:
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
    
    const options = {
      method: 'GET',
      ...requestOptions
    };
    
    return this.request<User>(url, options);
  }
}
\`\`\``;
      
    case 'python':
      return `\n\nEXAMPLES FOR CONSISTENCY:

## Example Model:
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

## Example API Client:
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
\`\`\``;
      
    default:
      return '';
  }
}