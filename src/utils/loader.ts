import fs from 'fs/promises';
import path from 'path';
import { OpenAPIV3 } from 'openapi-types';
import yaml from 'js-yaml';
import fetch from 'node-fetch';
import { URL } from 'url';

/**
 * Load an OpenAPI specification from a file or URL
 * 
 * @param source - Path or URL to the OpenAPI specification
 * @returns Parsed OpenAPI specification
 */
export async function loadOpenAPISpec(source: string): Promise<OpenAPIV3.Document> {
  let content: string;
  
  // Check if source is a URL
  try {
    const url = new URL(source);
    content = await fetchFromUrl(url.toString());
  } catch (error) {
    // Not a URL, treat as a file path
    const filePath = path.resolve(process.cwd(), source);
    content = await fs.readFile(filePath, 'utf-8');
  }
  
  // Parse content based on file extension
  const ext = path.extname(source.toLowerCase());
  let parsed: any;
  
  if (ext === '.json' || source.toLowerCase().endsWith('json')) {
    parsed = JSON.parse(content);
  } else if (ext === '.yaml' || ext === '.yml' || 
            source.toLowerCase().endsWith('yaml') || 
            source.toLowerCase().endsWith('yml')) {
    parsed = yaml.load(content);
  } else {
    // Try to guess the format
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      parsed = yaml.load(content);
    }
  }
  
  // Validate that it's an OpenAPI spec
  validateOpenAPISpec(parsed);
  
  // Convert from Swagger 2.0 to OpenAPI 3.0 if needed
  if (parsed.swagger && parsed.swagger.startsWith('2.')) {
    parsed = convertSwaggerToOpenAPI(parsed);
  }
  
  return parsed;
}

/**
 * Fetch content from a URL
 */
async function fetchFromUrl(url: string): Promise<string> {
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch from ${url}: ${response.statusText}`);
  }
  
  return response.text();
}

/**
 * Validate that the parsed content is an OpenAPI specification
 */
function validateOpenAPISpec(spec: any): void {
  // Check if it has required OpenAPI fields
  if (!spec.openapi && !spec.swagger) {
    throw new Error('Invalid OpenAPI specification: missing openapi or swagger version');
  }
  
  // Check OpenAPI version
  const version = spec.openapi || spec.swagger;
  
  if (version.startsWith('3.')) {
    // OpenAPI 3.x
    if (!spec.info || !spec.paths) {
      throw new Error('Invalid OpenAPI 3.x specification: missing required fields (info, paths)');
    }
  } else if (version.startsWith('2.')) {
    // Swagger 2.x
    if (!spec.info || !spec.paths) {
      throw new Error('Invalid Swagger 2.x specification: missing required fields (info, paths)');
    }
  } else {
    throw new Error(`Unsupported OpenAPI/Swagger version: ${version}`);
  }
}

/**
 * Convert a Swagger 2.0 spec to OpenAPI 3.0
 * Note: This is a simplified conversion and may not handle all cases
 */
function convertSwaggerToOpenAPI(swagger: any): OpenAPIV3.Document {
  const openapi: any = {
    openapi: '3.0.0',
    info: { ...swagger.info },
    paths: { ...swagger.paths },
  };
  
  // Convert parameters
  for (const pathKey in openapi.paths) {
    const path = openapi.paths[pathKey];
    
    for (const methodKey in path) {
      const method = path[methodKey];
      
      if (method.parameters) {
        // Convert body parameters to requestBody
        const bodyParam = method.parameters.find((p: any) => p.in === 'body');
        if (bodyParam) {
          method.requestBody = {
            content: {
              'application/json': {
                schema: bodyParam.schema,
              },
            },
            required: bodyParam.required,
          };
          
          // Remove body parameter
          method.parameters = method.parameters.filter((p: any) => p.in !== 'body');
        }
        
        // Convert formData parameters to requestBody
        const formParams = method.parameters.filter((p: any) => p.in === 'formData');
        if (formParams.length > 0) {
          const properties: Record<string, any> = {};
          const required: string[] = [];
          
          for (const param of formParams) {
            properties[param.name] = param.schema || { type: param.type };
            
            if (param.required) {
              required.push(param.name);
            }
          }
          
          method.requestBody = {
            content: {
              'application/x-www-form-urlencoded': {
                schema: {
                  type: 'object',
                  properties,
                  required: required.length > 0 ? required : undefined,
                },
              },
            },
            required: formParams.some((p: any) => p.required),
          };
          
          // Remove formData parameters
          method.parameters = method.parameters.filter((p: any) => p.in !== 'formData');
        }
      }
      
      // Convert responses
      if (method.responses) {
        for (const statusCode in method.responses) {
          const response = method.responses[statusCode];
          
          if (response.schema) {
            response.content = {
              'application/json': {
                schema: response.schema,
              },
            };
            
            delete response.schema;
          }
        }
      }
    }
  }
  
  // Convert definitions to components/schemas
  if (swagger.definitions) {
    openapi.components = {
      ...openapi.components,
      schemas: { ...swagger.definitions },
    };
  }
  
  // Convert securityDefinitions to components/securitySchemes
  if (swagger.securityDefinitions) {
    openapi.components = {
      ...openapi.components,
      securitySchemes: { ...swagger.securityDefinitions },
    };
    
    // Convert securityDefinitions formats
    for (const key in openapi.components.securitySchemes) {
      const scheme = openapi.components.securitySchemes[key];
      
      if (scheme.type === 'apiKey') {
        // apiKey format is the same
      } else if (scheme.type === 'basic') {
        scheme.type = 'http';
        scheme.scheme = 'basic';
      } else if (scheme.type === 'oauth2') {
        if (scheme.flow === 'implicit') {
          scheme.flows = {
            implicit: {
              authorizationUrl: scheme.authorizationUrl,
              scopes: scheme.scopes || {},
            },
          };
        } else if (scheme.flow === 'password') {
          scheme.flows = {
            password: {
              tokenUrl: scheme.tokenUrl,
              scopes: scheme.scopes || {},
            },
          };
        } else if (scheme.flow === 'application') {
          scheme.flows = {
            clientCredentials: {
              tokenUrl: scheme.tokenUrl,
              scopes: scheme.scopes || {},
            },
          };
        } else if (scheme.flow === 'accessCode') {
          scheme.flows = {
            authorizationCode: {
              authorizationUrl: scheme.authorizationUrl,
              tokenUrl: scheme.tokenUrl,
              scopes: scheme.scopes || {},
            },
          };
        }
        
        delete scheme.flow;
        delete scheme.authorizationUrl;
        delete scheme.tokenUrl;
        delete scheme.scopes;
      }
    }
  }
  
  return openapi;
}