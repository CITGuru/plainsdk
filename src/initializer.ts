import fs from 'fs/promises';
import path from 'path';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { OpenAPIV3 } from 'openapi-types';
import { loadOpenAPISpec } from './utils/loader';
import { checkSourceOpenAPI } from './validator';

import { ConfigFeatures } from "./types"

/**
 * Initialize a new PlainSDK configuration
 * 
 * @param specPath - Path to OpenAPI specification (optional)
 * @param outputDir - Output directory for the config file
 */
export async function initializeConfig(
  specPath?: string,
  outputDir: string = process.cwd()
): Promise<void> {
  // Prompt for OpenAPI spec if not provided
  if (!specPath) {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'specPath',
        message: 'Path or URL to OpenAPI specification:',
        validate: async (input) => {
          if (!input) {
            return 'Please enter a path or URL';
          }
          
          const exists = await checkSourceOpenAPI(input);
          
          if (!exists) {
            return 'OpenAPI specification not found';
          }
          
          return true;
        },
      },
    ]);
    
    specPath = answers.specPath;
  }
  
  // Load OpenAPI spec to extract info
  let spec: OpenAPIV3.Document;
  
  try {
    if (!specPath) {
      throw new Error('OpenAPI specification path is required');
    }
    spec = await loadOpenAPISpec(specPath as string);
  } catch (error: any) {
    throw new Error(`Failed to load OpenAPI specification: ${error.message}`);
  }
  
  // Prompt for SDK configuration
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'SDK package name:',
      default: getDefaultPackageName(spec.info?.title || 'api-sdk'),
    },
    {
      type: 'input',
      name: 'version',
      message: 'SDK version:',
      default: '1.0.0',
    },
    {
      type: 'input',
      name: 'description',
      message: 'SDK description:',
      default: spec.info?.description || `SDK for ${spec.info?.title || 'API'}`,
    },
    {
      type: 'checkbox',
      name: 'languages',
      message: 'Languages to generate:',
      choices: [
        { name: 'TypeScript', value: 'typescript', checked: true },
        { name: 'Python', value: 'python' },
        { name: 'Ruby', value: 'ruby' },
        { name: 'Go', value: 'go' },
        { name: 'Java', value: 'java' },
        { name: 'C#', value: 'csharp' },
        { name: 'PHP', value: 'php' },
      ],
      validate: (input) => {
        if (input.length === 0) {
          return 'Please select at least one language';
        }
        return true;
      },
    },
    {
      type: 'list',
      name: 'methodStyle',
      message: 'Naming style for methods:',
      choices: [
        { name: 'camelCase', value: 'camelCase' },
        { name: 'snake_case', value: 'snake_case' },
        { name: 'PascalCase', value: 'PascalCase' },
      ],
      default: 'camelCase',
    },
    {
      type: 'list',
      name: 'modelStyle',
      message: 'Naming style for models:',
      choices: [
        { name: 'camelCase', value: 'camelCase' },
        { name: 'snake_case', value: 'snake_case' },
        { name: 'PascalCase', value: 'PascalCase' },
      ],
      default: 'PascalCase',
    },
    {
      type: 'confirm',
      name: 'configurePagination',
      message: 'Configure pagination?',
      default: true,
    },
    {
      type: 'list',
      name: 'paginationStyle',
      message: 'Pagination style:',
      choices: [
        { name: 'Cursor-based', value: 'cursor' },
        { name: 'Offset-based', value: 'offset' },
        { name: 'Page-based', value: 'page' },
        { name: 'Token-based', value: 'token' },
      ],
      default: 'cursor',
      when: (answers) => answers.configurePagination,
    },
    {
      type: 'confirm',
      name: 'configureAuthentication',
      message: 'Configure authentication?',
      default: true,
    },
    {
      type: 'checkbox',
      name: 'authTypes',
      message: 'Authentication types:',
      choices: [
        { name: 'API Key', value: 'apiKey' },
        { name: 'Bearer Token', value: 'bearer' },
        { name: 'Basic Auth', value: 'basic' },
        { name: 'OAuth 2.0', value: 'oauth2' },
      ],
      default: ['apiKey', 'bearer'],
      when: (answers) => answers.configureAuthentication,
    },
    {
      type: 'input',
      name: 'apiKeyName',
      message: 'API Key header name:',
      default: 'X-API-Key',
      when: (answers) => answers.configureAuthentication && answers.authTypes?.includes('apiKey'),
    },
    {
      type: 'confirm',
      name: 'configureRetries',
      message: 'Configure automatic retries?',
      default: true,
    },
    {
      type: 'input',
      name: 'maxRetries',
      message: 'Maximum retry attempts:',
      default: '3',
      validate: (input) => {
        const num = parseInt(input, 10);
        if (isNaN(num) || num < 0) {
          return 'Please enter a non-negative number';
        }
        return true;
      },
      when: (answers) => answers.configureRetries,
    },
  ]);
  
  // Create configuration object
  const config = {
    name: answers.name,
    version: answers.version,
    description: answers.description,
    sourceOpenAPI: specPath,
    
    outputDir: './generated-sdks',
    languages: answers.languages,
    
    features: {} as ConfigFeatures,
    
    naming: {
      methodStyle: answers.methodStyle,
      parameterStyle: answers.methodStyle, // Use same style for parameters as methods
      resourceStyle: answers.modelStyle, // Use same style for resources as models
      modelStyle: answers.modelStyle,
    },
  };
  
  // Add pagination configuration if selected
  if (answers.configurePagination) {
    config.features.pagination = {
      style: answers.paginationStyle,
      parameters: {},
      responseFields: {},
    };
    
    // Set default parameters and response fields based on style
    switch (answers.paginationStyle) {
      case 'cursor':
        config.features.pagination.parameters.limit = 'limit';
        config.features.pagination.parameters.cursor = 'cursor';
        config.features.pagination.responseFields.nextCursor = 'next_cursor';
        config.features.pagination.responseFields.hasMore = 'has_more';
        break;
      case 'offset':
        config.features.pagination.parameters.limit = 'limit';
        config.features.pagination.parameters.offset = 'offset';
        config.features.pagination.responseFields.totalCount = 'total_count';
        break;
      case 'page':
        config.features.pagination.parameters.limit = 'limit';
        config.features.pagination.parameters.page = 'page';
        config.features.pagination.responseFields.totalPages = 'total_pages';
        config.features.pagination.responseFields.totalCount = 'total_count';
        break;
      case 'token':
        config.features.pagination.parameters.limit = 'limit';
        config.features.pagination.parameters.cursor = 'token';
        config.features.pagination.responseFields.nextToken = 'next_token';
        config.features.pagination.responseFields.hasMore = 'has_more';
        break;
    }
  }
  
  // Add authentication configuration if selected
  if (answers.configureAuthentication) {
    config.features.authentication = {
      types: answers.authTypes,
      locations: ['header'],
    };
    
    if (answers.authTypes?.includes('apiKey')) {
      config.features.authentication.names = {
        apiKey: answers.apiKeyName,
      };
    }
    
    if (answers.authTypes?.includes('oauth2')) {
      config.features.authentication.oauth2 = {
        flows: ['clientCredentials', 'authorizationCode'],
        scopes: [],
      };
    }
  }
  
  // Add retry configuration if selected
  if (answers.configureRetries) {
    config.features.retries = {
      maxRetries: parseInt(answers.maxRetries, 10),
      initialDelay: 300,
      maxDelay: 5000,
      backoffFactor: 2,
      retryableStatusCodes: [408, 429, 500, 502, 503, 504],
    };
  }
  
  // Write configuration to file
  const configPath = path.join(outputDir, 'plainsdk.config.js');
  const configContent = `module.exports = ${JSON.stringify(config, null, 2)};`;
  
  await fs.writeFile(configPath, configContent, 'utf-8');
  
  // Initialize .plainsdk directory for tracking files
  const plainsdkDir = path.join(outputDir, '.plainsdk');
  await fs.mkdir(plainsdkDir, { recursive: true });
  
  // Create tracking file
  const trackingFile = path.join(plainsdkDir, 'tracked-files.json');
  await fs.writeFile(trackingFile, JSON.stringify({ files: [] }, null, 2), 'utf-8');
  
  console.log(chalk.green('\nConfiguration initialized successfully!'));
}

/**
 * Get a default package name from an API title
 */
function getDefaultPackageName(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-api$/, '')
    .replace(/^api-/, '')
    + '-sdk';
}