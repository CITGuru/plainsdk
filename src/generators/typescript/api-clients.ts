import { PlainSDKConfig } from '../../types';
import { formatMethodName, formatParameterName, formatResourceName } from '../../utils/formatter';

/**
 * Generate TypeScript API clients from OpenAPI paths
 * 
 * @param paths - OpenAPI paths
 * @param config - PlainSDK configuration
 * @returns Generated API client files
 */
export async function generateApiClients(
  paths: Record<string, any>,
  config: PlainSDKConfig
): Promise<Record<string, string>> {
  // Group paths by tag/resource
  const resourceGroups = groupPathsByResource(paths);
  const files: Record<string, string> = {};
  
  // Generate API client for each resource
  for (const [resourceName, pathItems] of Object.entries(resourceGroups)) {
    const formattedResourceName = formatResourceName(resourceName, config.naming.resourceStyle);
    const content = generateApiClientContent(formattedResourceName, pathItems, config);
    
    files[`src/api/${formattedResourceName}Client.ts`] = content;
  }
  
  // Generate index file for API clients
  const resourceNames = Object.keys(resourceGroups).map(name => 
    formatResourceName(name, config.naming.resourceStyle)
  );
  
  const indexContent = resourceNames.map(name => 
    `export * from './${name}Client';`
  ).join('\n');
  
  files['src/api/index.ts'] = `${indexContent}\n`;
  
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
 * Generate content for an API client class
 * 
 * @param resourceName - Name of the resource
 * @param pathItems - Path items for the resource
 * @param config - PlainSDK configuration
 * @returns Generated API client content
 */
function generateApiClientContent(
  resourceName: string,
  pathItems: Record<string, any>,
  config: PlainSDKConfig
): string {
  const methods: string[] = [];
  const imports: Set<string> = new Set(['Configuration', 'RequestOptions', 'BaseAPI']);
  
  // Process each path and operation
  for (const [path, operations] of Object.entries(pathItems)) {
    for (const [method, operation] of Object.entries(operations)  as Array<[string, { operationId?: string }]>) {
      const methodName = formatMethodName(operation.operationId || generateOperationId(method, path), config.naming.methodStyle);
      const methodContent = generateMethodContent(methodName, method, path, operation, config);
      methods.push(methodContent);
      
      // Collect model imports
      collectModelImports(operation, imports);
    }
  }
  
  // Generate the client class
  return `import { AxiosRequestConfig } from 'axios';
import { ${Array.from(filterGeneralImports(imports)).join(', ')} } from '../core';
${generateModelImports(imports)}

/**
 * ${resourceName} API client
 * @class
 * @extends {BaseAPI}
 */
export class ${resourceName}Client extends BaseAPI {
  /**
   * Creates a new ${resourceName} API client
   * @param {Configuration} [configuration] - Client configuration
   */
  constructor(configuration?: Configuration) {
    super(configuration);
  }

${methods.join('\n\n')}
}
`;
}

/**
 * Generate a method for an API operation
 * 
 * @param methodName - Name of the method
 * @param httpMethod - HTTP method (get, post, etc.)
 * @param path - API path
 * @param operation - OpenAPI operation object
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
  // Generate method parameters
  const { parameters, parameterDocs, requestType, responseType } = generateMethodParameters(operation, config);
  
  // Generate method JSDoc
  const jsDoc = generateMethodJSDoc(operation, parameterDocs, responseType);
  
  // Generate path parameter replacement
  const pathReplacements = generatePathReplacements(path);
  
  // Generate query parameters assignment
  const queryParams = generateQueryParams(operation);
  
  // Generate request body assignment
  const requestBody = generateRequestBody(operation, httpMethod);
  
  // Generate method implementation
  return `${jsDoc}
  public async ${methodName}(${parameters}): Promise<${responseType}> {
    const url = \`${pathReplacements}\`;
    
    const options: AxiosRequestConfig = {
      method: '${httpMethod.toUpperCase()}',${queryParams}${requestBody}
      ...requestOptions
    };
    
    return this.request<${responseType}>(url, options);
  }`;
}

/**
 * Generate method parameters
 * 
 * @param operation - OpenAPI operation
 * @param config - PlainSDK configuration
 * @returns Parameter declarations, docs, and types
 */
function generateMethodParameters(
  operation: any,
  config: PlainSDKConfig
): { parameters: string; parameterDocs: string[]; requestType: string; responseType: string } {
  const parameterEntries: string[] = [];
  const parameterDocs: string[] = [];
  
  // Process path parameters
  const pathParams = (operation.parameters || []).filter((p: any) => p.in === 'path');
  for (const param of pathParams) {
    const paramName = formatParameterName(param.name, config.naming.parameterStyle);
    const paramType = mapOpenAPITypeToTypescript(param.schema || { type: 'string' });
    
    parameterEntries.push(`${paramName}: ${paramType}`);
    parameterDocs.push(`@param {${paramType}} ${paramName} - ${param.description || `Path parameter: ${param.name}`}`);
  }
  
  // Process query parameters
  const queryParams = (operation.parameters || []).filter((p: any) => p.in === 'query');
  if (queryParams.length > 0) {
    const queryParamEntries: string[] = [];
    
    for (const param of queryParams) {
      const paramName = formatParameterName(param.name, config.naming.parameterStyle);
      const paramType = mapOpenAPITypeToTypescript(param.schema || { type: 'string' });
      const isRequired = param.required === true;
      
      queryParamEntries.push(`${paramName}${isRequired ? '' : '?'}: ${paramType}`);
      parameterDocs.push(`@param {${paramType}} ${isRequired ? '' : '['}${paramName}${isRequired ? '' : ']'} - ${param.description || `Query parameter: ${param.name}`}`);
    }
    
    if (queryParamEntries.length > 0) {
      parameterEntries.push(`queryParams?: { ${queryParamEntries.join('; ')} }`);
    }
  }
  
  // Process request body
  let requestType = 'void';
  if (operation.requestBody) {
    const contentType = operation.requestBody.content ? Object.keys(operation.requestBody.content)[0] : null;
    // Note Check for content type: json, && contentType.includes('json') x-www-form-urlencoded
    if (contentType) {
      const schema = operation.requestBody.content[contentType].schema;
      requestType = getSchemaType(schema);
      
      const isRequired = operation.requestBody.required === true;
      parameterEntries.push(`requestBody${isRequired ? '' : '?'}: ${requestType}`);
      parameterDocs.push(`@param {${requestType}} ${isRequired ? '' : '['}requestBody${isRequired ? '' : ']'} - Request payload`);
    }
  }
  
  // Add requestOptions parameter
  parameterEntries.push(`requestOptions?: RequestOptions`);
  parameterDocs.push(`@param {RequestOptions} [requestOptions] - Additional request options`);
  
  // Determine response type
  let responseType = 'void';
  const successResponse = operation.responses && (operation.responses['200'] || operation.responses['201'] || operation.responses['2XX']);
  
  if (successResponse && successResponse.content) {
    const contentType = Object.keys(successResponse.content)[0];
    if (contentType && contentType.includes('json')) {
      const schema = successResponse.content[contentType].schema;
      responseType = getSchemaType(schema);
    }
  }
  
  return {
    parameters: parameterEntries.join(', '),
    parameterDocs,
    requestType,
    responseType
  };
}

/**
 * Generate JSDoc for a method
 * 
 * @param operation - OpenAPI operation
 * @param parameterDocs - Parameter documentation
 * @param responseType - Response type
 * @returns JSDoc comment
 */
function generateMethodJSDoc(
  operation: any,
  parameterDocs: string[],
  responseType: string
): string {
  const description = operation.description || operation.summary || 'No description available';
  
  return `/**
   * ${description}
   * ${parameterDocs.map(doc => `* ${doc}`).join('\n   * ')}
   * @returns {Promise<${responseType}>} ${operation.responses?.['200']?.description || 'Success response'}
   */`;
}

/**
 * Generate code to replace path parameters
 * 
 * @param path - API path
 * @returns Path with parameter replacements
 */
function generatePathReplacements(path: string): string {
  // Replace {paramName} with ${paramName}
  return path.replace(/{([^}]+)}/g, (_, paramName) => `\${${formatParameterName(paramName, 'camelCase')}}`);
}

/**
 * Generate query parameters assignment
 * 
 * @param operation - OpenAPI operation
 * @returns Query parameters assignment code
 */
function generateQueryParams(operation: any): string {
  const queryParams = (operation.parameters || []).filter((p: any) => p.in === 'query');
  
  if (queryParams.length > 0) {
    return `
      params: queryParams,`;
  }
  
  return '';
}

/**
 * Generate request body assignment
 * 
 * @param operation - OpenAPI operation
 * @param httpMethod - HTTP method
 * @returns Request body assignment code
 */
function generateRequestBody(operation: any, httpMethod: string): string {
  if (operation.requestBody && ['post', 'put', 'patch'].includes(httpMethod.toLowerCase())) {
    return `
      data: requestBody,`;
  }
  
  return '';
}

/**
 * Get TypeScript type for an OpenAPI schema
 * 
 * @param schema - OpenAPI schema
 * @returns TypeScript type
 */
function getSchemaType(schema: any): string {
  if (!schema) {
    return 'any';
  }
  
  if (schema.$ref) {
    // Extract model name from reference
    const refParts = schema.$ref.split('/');
    return refParts[refParts.length - 1];
  }
  
  return mapOpenAPITypeToTypescript(schema);
}

/**
 * Map OpenAPI types to TypeScript types
 * 
 * @param schema - OpenAPI schema
 * @returns TypeScript type
 */
function mapOpenAPITypeToTypescript(schema: any): string {
  if (!schema) {
    return 'any';
  }
  
  if (schema.$ref) {
    // Extract model name from reference
    const refParts = schema.$ref.split('/');
    return refParts[refParts.length - 1];
  }
  
  if (schema.type === 'array') {
    const itemsType = schema.items ? getSchemaType(schema.items) : 'any';
    return `${itemsType}[]`;
  }
  
  if (schema.type === 'object') {
    if (schema.additionalProperties) {
      const valueType = schema.additionalProperties === true ? 
        'any' : 
        getSchemaType(schema.additionalProperties);
      return `Record<string, ${valueType}>`;
    }
    
    if (schema.properties) {
      const props = Object.entries(schema.properties).map(([propName, propSchema]) => {
        const isRequired = schema.required?.includes(propName);
        return `${/^\d/.test(propName) ? `"${propName}"`: propName}${isRequired ? '' : '?'}: ${getSchemaType(propSchema)}`;
      });
      
      return `{ ${props.join('; ')} }`;
    }
    
    return 'Record<string, any>';
  }
  
  if (schema.enum) {
    return schema.enum.map((v: any) => typeof v === 'string' ? `'${v}'` : v).join(' | ');
  }
  
  switch (schema.type) {
    case 'integer':
    case 'number':
      return 'number';
    case 'string':
      if (schema.format === 'date' || schema.format === 'date-time') {
        return 'Date';
      }
      return 'string';
    case 'boolean':
      return 'boolean';
    case 'null':
      return 'null';
    default:
      return 'any';
  }
}

/**
 * Collect model imports from an operation
 * 
 * @param operation - OpenAPI operation
 * @param imports - Set of imports
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
    for (const response of Object.values(operation.responses)  as Array<{ content?: Record<string, { schema: any }> }>) {
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
 * @param imports - Set of imports
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
  
  // Handle allOf, oneOf, anyOf
  ['allOf', 'oneOf', 'anyOf'].forEach(combiner => {
    if (schema[combiner]) {
      schema[combiner].forEach((subSchema: any) => {
        collectImportsFromSchema(subSchema, imports);
      });
    }
  });
}

/**
 * Generate model imports
 * 
 * @param imports - Set of imports
 * @returns Import statements
 */
function generateModelImports(imports: Set<string>): string {
  const modelImports = Array.from(imports).filter(name => 
    !['Configuration', 'RequestOptions', 'BaseAPI'].includes(name)
  );
  
  if (modelImports.length === 0) {
    return '';
  }
  
  return `import { ${modelImports.join(', ')} } from '../models';\n`;
}

/**
 * Generate model imports
 * 
 * @param imports - Set of imports
 * @returns Import statements
 */
function filterGeneralImports(imports: Set<string>): Set<string> {
  const modelImports = Array.from(imports).filter(name => 
    ['Configuration', 'RequestOptions', 'BaseAPI'].includes(name)
  );

  return new Set(modelImports)
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
    .replace(/{([^}]+)}/g, '_by_$1')
    .replace(/[\/\-]/g, '_');
  
  return `${method.toLowerCase()}_${cleanPath}`;
}