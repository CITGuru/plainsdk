import fs from 'fs/promises';
import path from 'path';
import { PlainSDKConfig } from './types';

/**
 * Validates a PlainSDK configuration
 * 
 * @param config - The configuration to validate
 * @returns Validation result
 */
export function validateConfig(config: PlainSDKConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Required fields
  if (!config.name) {
    errors.push('Configuration must include a name');
  }
  
  if (!config.version) {
    errors.push('Configuration must include a version');
  }
  
  if (!config.sourceOpenAPI) {
    errors.push('Configuration must include a sourceOpenAPI path');
  }
  
  if (!config.outputDir) {
    errors.push('Configuration must include an outputDir');
  }
  
  // Validate languages
  if (!config.languages || !Array.isArray(config.languages) || config.languages.length === 0) {
    errors.push('Configuration must include at least one language');
  } else {
    const validLanguages = [
      'typescript',
      'python',
      'ruby',
      'go',
      'java',
      'csharp',
      'php',
    ];
    
    for (const language of config.languages) {
      if (!validLanguages.includes(language)) {
        errors.push(`Invalid language: ${language}. Valid options are: ${validLanguages.join(', ')}`);
      }
    }
  }
  
  // Validate naming conventions
  if (!config.naming) {
    errors.push('Configuration must include naming conventions');
  } else {
    const validStyles = ['camelCase', 'snake_case', 'PascalCase'];
    
    if (!validStyles.includes(config.naming.methodStyle)) {
      errors.push(`Invalid methodStyle: ${config.naming.methodStyle}. Valid options are: ${validStyles.join(', ')}`);
    }
    
    if (!validStyles.includes(config.naming.parameterStyle)) {
      errors.push(`Invalid parameterStyle: ${config.naming.parameterStyle}. Valid options are: ${validStyles.join(', ')}`);
    }
    
    if (!validStyles.includes(config.naming.resourceStyle)) {
      errors.push(`Invalid resourceStyle: ${config.naming.resourceStyle}. Valid options are: ${validStyles.join(', ')}`);
    }
    
    if (!validStyles.includes(config.naming.modelStyle)) {
      errors.push(`Invalid modelStyle: ${config.naming.modelStyle}. Valid options are: ${validStyles.join(', ')}`);
    }
  }
  
  // Validate pagination configuration if present
  if (config.features?.pagination) {
    const { pagination } = config.features;
    const validStyles = ['offset', 'cursor', 'page', 'token'];
    
    if (!validStyles.includes(pagination.style)) {
      errors.push(`Invalid pagination style: ${pagination.style}. Valid options are: ${validStyles.join(', ')}`);
    }
    
    // Check if parameters are provided based on style
    if (pagination.style === 'offset' && !pagination.parameters?.offset) {
      errors.push('Offset pagination requires an offset parameter name');
    }
    
    if (pagination.style === 'cursor' && !pagination.parameters?.cursor) {
      errors.push('Cursor pagination requires a cursor parameter name');
    }
    
    if (pagination.style === 'page' && !pagination.parameters?.page) {
      errors.push('Page pagination requires a page parameter name');
    }
    
    if (pagination.style === 'token' && !pagination.parameters?.cursor) {
      errors.push('Token pagination requires a token parameter name (use cursor parameter)');
    }
  }
  
  // Validate authentication configuration if present
  if (config.features?.authentication) {
    const { authentication } = config.features;
    const validTypes = ['apiKey', 'bearer', 'basic', 'oauth2'];
    
    if (!authentication.types || !Array.isArray(authentication.types) || authentication.types.length === 0) {
      errors.push('Authentication configuration must include at least one type');
    } else {
      for (const type of authentication.types) {
        if (!validTypes.includes(type)) {
          errors.push(`Invalid authentication type: ${type}. Valid options are: ${validTypes.join(', ')}`);
        }
      }
    }
    
    // Check if API key name is provided when apiKey type is used
    if (authentication.types?.includes('apiKey') && !authentication.names?.apiKey) {
      errors.push('API key authentication requires an API key name');
    }
    
    // Check if oauth2 flows are provided when oauth2 type is used
    if (authentication.types?.includes('oauth2') && (!authentication.oauth2?.flows || authentication.oauth2.flows.length === 0)) {
      errors.push('OAuth2 authentication requires at least one flow');
    }
  }
  
  // Validate retry configuration if present
  if (config.features?.retries) {
    const { retries } = config.features;
    
    if (typeof retries.maxRetries !== 'number' || retries.maxRetries < 0) {
      errors.push('maxRetries must be a non-negative number');
    }
    
    if (typeof retries.initialDelay !== 'number' || retries.initialDelay < 0) {
      errors.push('initialDelay must be a non-negative number');
    }
    
    if (typeof retries.maxDelay !== 'number' || retries.maxDelay < retries.initialDelay) {
      errors.push('maxDelay must be greater than or equal to initialDelay');
    }
    
    if (typeof retries.backoffFactor !== 'number' || retries.backoffFactor < 1) {
      errors.push('backoffFactor must be greater than or equal to 1');
    }
  }
  
  // Validate templates if present
  if (config.templates) {
    for (const [key, templatePath] of Object.entries(config.templates)) {
      if (typeof templatePath !== 'string') {
        errors.push(`Template path for ${key} must be a string`);
      }
    }
  }
  
  // Validate hooks if present
  if (config.hooks) {
    if (config.hooks.preGenerate && typeof config.hooks.preGenerate !== 'string') {
      errors.push('preGenerate hook must be a string path to a script');
    }
    
    if (config.hooks.postGenerate && typeof config.hooks.postGenerate !== 'string') {
      errors.push('postGenerate hook must be a string path to a script');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if a source OpenAPI spec exists
 */
export async function checkSourceOpenAPI(source: string): Promise<boolean> {
  try {
    // Check if source is a URL
    try {
      new URL(source);
      return true; // Assume URL is valid, will be validated during loading
    } catch (error) {
      // Not a URL, check if file exists
      const filePath = path.resolve(process.cwd(), source);
      await fs.access(filePath);
      return true;
    }
  } catch (error) {
    return false;
  }
}