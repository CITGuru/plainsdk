import { PlainSDKConfig } from '../../types';
import { formatResourceName, formatMethodName, toSnakeCase } from '../../utils/formatter';

/**
 * Generate Python API clients from OpenAPI paths
 * 
 * @param paths - OpenAPI paths
 * @param packageName - Python package name
 * @param config - PlainSDK configuration
 * @returns Generated API client files
 */
export async function generatePythonApiClients(
  paths: Record<string, any>,
  packageName: string, 
  config: PlainSDKConfig
): Promise<Record<string, string>> {
  // Group paths by tag/resource
  const resourceGroups = groupPathsByResource(paths);
  const files: Record<string, string> = {};
  
  // Generate API client for each resource
  for (const [resourceName, pathItems] of Object.entries(resourceGroups)) {
    const formattedResourceName = formatResourceName(resourceName, config.naming.resourceStyle);
    const snakeName = toSnakeCase(formattedResourceName);
    
    const content = generateApiClientContent(formattedResourceName, pathItems, packageName, config);
    files[`${packageName}/api/${snakeName}.py`] = content;
  }
  
  return files;
}

/**
 * Group OpenAPI paths by resource/tag
 * 
 * @param paths - OpenAPI paths
 * @returns Paths grouped by resource
 */
function groupPathsByResource(paths: Record<string, any>): Record<string, any> {
  const groups: Record<string, any> = {};
  
  for (const [path, pathItem] of Object.entries(paths)) {
    const operations = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head']
      .filter(op => pathItem[op]);
    
    for (const operation of operations) {
      const operationObj = pathItem[operation];
      const tags = operationObj.tags || ['default'];
      
      // Use the first tag as the resource group
      const resource = tags[0];
      
      if (!groups[resource]) {
        groups[resource] = {};
      }
      
      if (!groups[resource][path]) {
        groups[resource][path] = {};
      }
      
      groups[resource][path][operation] = operationObj;
    }
  }
  
  return groups;
}

/**
 * Generate content for a Python API client
 * 
 * @param resourceName - Name of the resource
 * @param pathItems - OpenAPI path items for the resource
 * @param packageName - Python package name
 * @param config - PlainSDK configuration
 * @returns Generated API client content
 */
function generateApiClientContent(
  resourceName: string,
  pathItems: Record<string, any>,
  packageName: string,
  config: PlainSDKConfig
): string {
  // Prepare imports
  let content = `"""
API client for ${resourceName} resources
"""
from typing import Dict, List, Optional, Any, Union, TypeVar, Generic, cast
import requests
from ..core.config import Configuration
from ..core.auth import Authentication
from ..core.pagination import PaginationHandler

`;

  // Collect model imports
  const imports = new Set<string>();
  for (const operations of Object.values(pathItems)) {
    for (const operation of Object.values(operations)) {
      collectModelImports(operation, imports);
    }
  }

  // Add model imports if needed
  if (imports.size > 0) {
    const importPaths = Array.from(imports).map(name => {
      const snakeName = toSnakeCase(name);
      return `from ..models.${snakeName} import ${name}`;
    });
    content += importPaths.join('\n') + '\n\n';
  }

  // Start class definition
  content += `class ${resourceName}:
    """
    API client for ${resourceName} resources
    """
    def __init__(self, config: Configuration, auth: Authentication):
        """
        Initialize the ${resourceName} API client
        
        Args:
            config: API configuration
            auth: Authentication handler
        """
        self.config = config
        self.auth = auth
        self.pagination = PaginationHandler(config)
        self.session = requests.Session()
        
`;

  // Add methods for each operation
  const methods: string[] = [];
  
  for (const [path, operations] of Object.entries(pathItems)) {
    for (const [method, operation] of Object.entries(operations) as Array<[string, { operationId?: string }]>) {
      const operationId = operation.operationId || generateOperationId(method, path);
      const methodName = formatMethodName(operationId, config.naming.methodStyle);
      
      methods.push(generateMethodContent(methodName, method, path, operation, config));
    }
  }
  
  content += methods.join('\n\n');
  
  return content;
}

/**
 * Generate a Python method for an API operation
 * 
 * @param methodName - Name of the method
 * @param httpMethod - HTTP method (get, post, etc.)
 * @param path - API path
 * @param operation - OpenAPI operation
 * @param config - PlainSDK configuration
 * @returns Generated method content
 */
function generateMethodContent(
  methodName: string,
  httpMethod: string,
  path: string,
  operation: any,
  config: PlainSDKConfig
): string {
  // Extract path parameters
  const pathParams = (operation.parameters || [])
    .filter((p: any) => p.in === 'path')
    .map((p: any) => p.name);
  
  // Extract query parameters
  const queryParams = (operation.parameters || [])
    .filter((p: any) => p.in === 'query')
    .map((p: any) => p.name);
  
  // Determine if there's a request body
  const hasRequestBody = operation.requestBody && 
    (httpMethod === 'post' || httpMethod === 'put' || httpMethod === 'patch');
  
  // Format parameters for method signature
  const methodParams = [];
  
  // Add path parameters
  for (const param of pathParams) {
    const paramName = toSnakeCase(param);
    const paramType = getParameterType(
      operation.parameters.find((p: any) => p.name === param)
    );
    methodParams.push(`${paramName}: ${paramType}`);
  }
  
  // Add request body if applicable
  if (hasRequestBody) {
    const bodySchema = getRequestBodySchema(operation.requestBody);
    if (bodySchema) {
      const bodyType = getSchemaType(bodySchema);
      const isRequired = operation.requestBody.required === true;
      methodParams.push(`data : ${bodyType}${isRequired ? '' : ' = None'}`);
    }
  }
  
  // Add query parameters
  if (queryParams.length > 0) {
    for (const param of queryParams) {
      const paramName = toSnakeCase(param);
      const paramDef = operation.parameters.find((p: any) => p.name === param);
      const paramType = getParameterType(paramDef);
      const isRequired = paramDef.required === true;
      methodParams.push(`${paramName}: ${paramType}${isRequired ? '' : ' = None'}`);
    }
  }
  
  // Add **kwargs
  methodParams.push('**kwargs');
  
  // Format method signature
  const signature = `def ${methodName}(self, ${methodParams.join(', ')})`;
  
  // Format method docstring
  const docstring = generateMethodDocstring(methodName, operation, pathParams, queryParams);
  
  // Format method body
  let methodBody = '';
  
  // Format URL path
  let urlPath = path;
  for (const param of pathParams) {
    const paramName = toSnakeCase(param);
    urlPath = urlPath.replace(`{${param}}`, `{${paramName}}`);
  }
  
  // Define URL
  methodBody += `        url = f"{self.config.base_url}${urlPath}"\n`;
  
  // Define headers
  methodBody += `        headers = {}\n`;
  
  // Define query parameters
  if (queryParams.length > 0) {
    methodBody += `        query_params = {}\n`;
    for (const param of queryParams) {
      const paramName = toSnakeCase(param);
      methodBody += `        if ${paramName} is not None:\n`;
      methodBody += `            query_params["${param}"] = ${paramName}\n`;
    }
  } else {
    methodBody += `        query_params = {}\n`;
  }
  
  // Add kwargs
  methodBody += `        # Add any additional query parameters from kwargs\n`;
  methodBody += `        query_params.update({k: v for k, v in kwargs.items() if v is not None})\n`;
  
  // Add authentication
  methodBody += `        
        # Apply authentication
        auth_headers = self.auth.apply_to_request(headers)
        headers.update(auth_headers)\n`;
  
  // Make the request
  methodBody += `        
        response = self.session.${httpMethod.toLowerCase()}(
            url,
            headers=headers,
            params=query_params${hasRequestBody ? ',\n            json=data' : ''}
        )\n`;
  
  // Handle response
  methodBody += `        
        # Raise for status
        response.raise_for_status()
        
        # Return response data
        return response.json()\n`;
  
  // Assemble the method
  return `    ${signature}:
        ${docstring}
${methodBody}`;
}

/**
 * Generate a Python docstring for a method
 * 
 * @param methodName - Name of the method
 * @param operation - OpenAPI operation
 * @param pathParams - Path parameters
 * @param queryParams - Query parameters
 * @returns Generated docstring
 */
function generateMethodDocstring(
  methodName: string,
  operation: any,
  pathParams: string[],
  queryParams: string[]
): string {
  const lines: string[] = [];
  
  // Add description
  if (operation.summary || operation.description) {
    lines.push(operation.summary || operation.description);
    if (operation.description && operation.summary && operation.description !== operation.summary) {
      lines.push('');
      lines.push(operation.description);
    }
  } else {
    lines.push(`${methodName} operation`);
  }
  
  // Add parameters
  if (pathParams.length > 0 || queryParams.length > 0 || operation.requestBody) {
    lines.push('');
    lines.push('Args:');
    
    // Path parameters
    for (const param of pathParams) {
      const paramDef = operation.parameters.find((p: any) => p.name === param);
      const description = paramDef.description ? `: ${paramDef.description}` : '';
      lines.push(`    ${toSnakeCase(param)}${description}`);
    }
    
    // Request body
    if (operation.requestBody) {
      const description = operation.requestBody.description 
        ? `: ${operation.requestBody.description}`
        : ': Request data';
      lines.push(`    data${description}`);
    }
    
    // Query parameters
    for (const param of queryParams) {
      const paramDef = operation.parameters.find((p: any) => p.name === param);
      const description = paramDef.description ? `: ${paramDef.description}` : '';
      lines.push(`    ${toSnakeCase(param)}${description}`);
    }
    
    // Add kwargs
    lines.push(`    **kwargs: Additional parameters`);
  }
  
  // Add returns
  lines.push('');
  lines.push('Returns:');
  
  const successResponse = operation.responses && (
    operation.responses['200'] || 
    operation.responses['201'] || 
    operation.responses['2XX']
  );
  
  if (successResponse) {
    const description = successResponse.description || 'Successful response';
    lines.push(`    ${description}`);
  } else {
    lines.push('    API response');
  }
  
  // Format docstring
  return '"""' + lines.join('\n        ') + '\n        """';
}

/**
 * Collect models that need to be imported for an operation
 * 
 * @param operation - OpenAPI operation
 * @param imports - Set to add imports to
 */
function collectModelImports(operation: any, imports: Set<string>): void {
  // Check request body
  if (operation.requestBody?.content) {
    const contentType = Object.keys(operation.requestBody.content)[0];
    if (contentType && contentType.includes('json')) {
      const schema = operation.requestBody.content[contentType].schema;
      collectImportsFromSchema(schema, imports);
    }
  }
  
  // Check responses
  if (operation.responses) {
    for (const response of Object.values(operation.responses) as Array<{ content?: Record<string, { schema: any }> }>) {
      if (response.content) {
        const contentType = Object.keys(response.content)[0];
        if (contentType && contentType.includes('json')) {
          const schema = response.content[contentType].schema;
          collectImportsFromSchema(schema, imports);
        }
      }
    }
  }
  
  // Check parameters
  if (operation.parameters) {
    for (const param of operation.parameters) {
      collectImportsFromSchema(param.schema, imports);
    }
  }
}

/**
 * Collect imports from a schema
 * 
 * @param schema - OpenAPI schema
 * @param imports - Set to add imports to
 */
function collectImportsFromSchema(schema: any, imports: Set<string>): void {
  if (!schema) {
    return;
  }
  
  if (schema.$ref) {
    const refParts = schema.$ref.split('/');
    const modelName = refParts[refParts.length - 1];
    imports.add(modelName);
    return;
  }
  
  if (schema.type === 'array' && schema.items) {
    collectImportsFromSchema(schema.items, imports);
    return;
  }
  
  if (schema.type === 'object') {
    if (schema.properties) {
      for (const propSchema of Object.values(schema.properties)) {
        collectImportsFromSchema(propSchema, imports);
      }
    }
    
    if (schema.additionalProperties && typeof schema.additionalProperties !== 'boolean') {
      collectImportsFromSchema(schema.additionalProperties, imports);
    }
  }
  
  // Handle schema compositions
  ['allOf', 'oneOf', 'anyOf'].forEach(combiner => {
    if (schema[combiner]) {
      schema[combiner].forEach((subSchema: any) => {
        collectImportsFromSchema(subSchema, imports);
      });
    }
  });
}

/**
 * Get request body schema from operation
 * 
 * @param requestBody - OpenAPI request body
 * @returns Request body schema
 */
function getRequestBodySchema(requestBody: any): any {
  if (!requestBody?.content) {
    return null;
  }
  
  const contentType = Object.keys(requestBody.content)[0];
  if (!contentType) {
    return null;
  }
  
  return requestBody.content[contentType].schema;
}

/**
 * Get Python type from a schema
 * 
 * @param schema - OpenAPI schema
 * @returns Python type string
 */
function getSchemaType(schema: any): string {
  if (!schema) {
    return 'Any';
  }
  
  if (schema.$ref) {
    const refParts = schema.$ref.split('/');
    return refParts[refParts.length - 1];
  }
  
  if (schema.type === 'array') {
    const itemType = schema.items ? getSchemaType(schema.items) : 'Any';
    return `List[${itemType}]`;
  }
  
  if (schema.type === 'object') {
    if (schema.additionalProperties) {
      const valueType = typeof schema.additionalProperties === 'boolean'
        ? 'Any'
        : getSchemaType(schema.additionalProperties);
      return `Dict[str, ${valueType}]`;
    }
    
    return 'Dict[str, Any]';
  }
  
  if (schema.oneOf || schema.anyOf) {
    const variants = schema.oneOf || schema.anyOf;
    if (variants.length === 1) {
      return getSchemaType(variants[0]);
    }
    // Python 3.10+ supports Union as a type directly, but for compatibility we use Any
    return 'Any';
  }
  
  if (schema.enum) {
    return 'str';  // Default to string for enums
  }
  
  switch (schema.type) {
    case 'string':
      if (schema.format === 'date' || schema.format === 'date-time') {
        return 'datetime';
      }
      return 'str';
    case 'number':
      return 'float';
    case 'integer':
      return 'int';
    case 'boolean':
      return 'bool';
    default:
      return 'Any';
  }
}

/**
 * Get parameter type
 * 
 * @param parameter - OpenAPI parameter
 * @returns Python type string
 */
function getParameterType(parameter: any): string {
  if (!parameter?.schema) {
    return 'Any';
  }
  
  return getSchemaType(parameter.schema);
}

/**
 * Generate operation ID from method and path
 * 
 * @param method - HTTP method
 * @param path - API path
 * @returns Generated operation ID
 */
function generateOperationId(method: string, path: string): string {
  const cleanPath = path
    .replace(/^\//, '')
    .replace(/{([^}]+)}/g, 'By$1')
    .replace(/[\/\-]/g, '_');
  
  return `${method.toLowerCase()}_${cleanPath}`;
}