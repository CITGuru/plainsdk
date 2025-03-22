import { OpenAPIV3 } from 'openapi-types';

/**
 * Summarized OpenAPI spec for LLM context
 */
export interface OpenAPISummary {
  title: string;
  version: string;
  description: string;
  endpointCount: number;
  resourceGroups: string[];
  authMethods: string[];
  schemaCount: number;
  commonOperations: string[];
  hasPagination: boolean;
  mainResources: Array<{
    name: string;
    operations: string[];
    properties?: string[];
  }>;
}

/**
 * Summarize an OpenAPI specification to provide context for LLM
 * 
 * @param spec - OpenAPI specification object
 * @returns Summarized information about the API
 */
export function summarizeOpenAPI(spec: any): OpenAPISummary {
  const summary: OpenAPISummary = {
    title: spec.info?.title || 'API',
    version: spec.info?.version || 'unknown',
    description: spec.info?.description || '',
    endpointCount: 0,
    resourceGroups: [],
    authMethods: [],
    schemaCount: 0,
    commonOperations: [],
    hasPagination: false,
    mainResources: []
  };

  // Count endpoints
  let endpointCount = 0;
  const operationCounts: Record<string, number> = {};
  const resourceGroups = new Set<string>();
  const pathsByResource: Record<string, string[]> = {};
  
  // Get auth methods
  if (spec.components?.securitySchemes) {
    for (const [key, scheme] of Object.entries<any>(spec.components.securitySchemes)) {
      const type = scheme.type;
      const flow = scheme.flows?.clientCredentials ? 'clientCredentials' : 
                  scheme.flows?.authorizationCode ? 'authorizationCode' : 
                  scheme.flows?.implicit ? 'implicit' : 
                  scheme.flows?.password ? 'password' : '';
      
      summary.authMethods.push(
        type === 'oauth2' ? `${type}:${flow}` : type
      );
    }
  }
  
  // Analyze paths
  for (const [path, pathObj] of Object.entries<any>(spec.paths || {})) {
    // Skip non-path properties
    if (typeof pathObj !== 'object' || pathObj === null) continue;
    
    // Extract resource group from path
    const pathParts = path.split('/').filter(Boolean);
    let resourceName = pathParts[0] || 'default';
    resourceGroups.add(resourceName);
    
    if (!pathsByResource[resourceName]) {
      pathsByResource[resourceName] = [];
    }
    pathsByResource[resourceName].push(path);
    
    // Count operations
    for (const [method, operation] of Object.entries<any>(pathObj)) {
      if (method === 'parameters' || method === '$ref' || typeof operation !== 'object') continue;
      
      endpointCount++;
      
      const operationId = operation.operationId || `${method}${path}`;
      const operationTag = (operation.tags && operation.tags[0]) || resourceName;
      
      // Normalize operation name
      let operationName = operationId.replace(/^(get|post|put|delete|patch)/, '').toLowerCase();
      operationName = operationName.replace(/^[^a-z]*/, ''); // Remove leading non-alphabetic chars
      
      // Count common operations
      if (!operationCounts[operationName]) {
        operationCounts[operationName] = 0;
      }
      operationCounts[operationName]++;
      
      // Check for pagination
      if (!summary.hasPagination) {
        // Look for pagination parameters
        const paginationParams = (operation.parameters || []).filter((param: any) => {
          const name = (param.name || '').toLowerCase();
          return name === 'page' || name === 'limit' || name === 'offset' || 
                 name === 'cursor' || name === 'per_page' || name === 'page_size';
        });
        
        if (paginationParams.length > 0) {
          summary.hasPagination = true;
        }
        
        // Also check response schema for pagination indicators
        const responses = operation.responses || {};
        for (const [_, response] of Object.entries<any>(responses)) {
          const schema = response.content?.['application/json']?.schema;
          if (schema) {
            const properties = schema.properties || {};
            const propNames = Object.keys(properties).map(p => p.toLowerCase());
            if (
              propNames.includes('next_page') || 
              propNames.includes('has_more') || 
              propNames.includes('next_cursor') ||
              propNames.includes('page_count') ||
              propNames.includes('total_pages')
            ) {
              summary.hasPagination = true;
              break;
            }
          }
        }
      }
    }
  }
  
  summary.endpointCount = endpointCount;
  summary.resourceGroups = Array.from(resourceGroups);
  
  // Find common operations
  summary.commonOperations = Object.entries(operationCounts)
    .filter(([_, count]) => count > 1)
    .map(([operation, _]) => operation);
  
  // Count schemas
  summary.schemaCount = Object.keys(spec.components?.schemas || {}).length;
  
  // Analyze main resources
  for (const resourceName of summary.resourceGroups) {
    const paths = pathsByResource[resourceName] || [];
    
    // Skip resources with too few endpoints
    if (paths.length < 2) continue;
    
    // Find operations for this resource
    const operations: string[] = [];
    
    for (const path of paths) {
      const pathObj = spec.paths[path];
      for (const [method, operation] of Object.entries<any>(pathObj)) {
        if (method === 'parameters' || method === '$ref') continue;
        
        if (operation.operationId) {
          operations.push(operation.operationId);
        } else {
          operations.push(`${method}${path}`);
        }
      }
    }
    
    // Find main schema for this resource (if any)
    let properties: string[] | undefined;
    const matchingSchemas = Object.entries<any>(spec.components?.schemas || {})
      .filter(([name, _]) => {
        // Look for schema name that matches resource name
        const normalizedName = name.toLowerCase();
        const normalizedResource = resourceName.toLowerCase();
        
        return normalizedName === normalizedResource || 
               normalizedName === `${normalizedResource}request` ||
               normalizedName === `${normalizedResource}response` ||
               normalizedName === `${normalizedResource}dto` ||
               normalizedName === `${normalizedResource}model`;
      });
    
    if (matchingSchemas.length > 0) {
      // Use the first matching schema
      const [_, schema] = matchingSchemas[0];
      properties = Object.keys(schema.properties || {});
    }
    
    summary.mainResources.push({
      name: resourceName,
      operations,
      properties
    });
  }
  
  return summary;
}

/**
 * Convert OpenAPI summary to a string for LLM prompt
 * 
 * @param summary - OpenAPI summary
 * @returns String representation for LLM
 */
export function openAPISummaryToString(summary: OpenAPISummary): string {
  let result = `API SUMMARY:
- Name: ${summary.title}
- Version: ${summary.version}
- Endpoints: ${summary.endpointCount}
- Resource Groups: ${summary.resourceGroups.join(', ')}
- Authentication: ${summary.authMethods.length > 0 ? summary.authMethods.join(', ') : 'None specified'}
- Has Pagination: ${summary.hasPagination ? 'Yes' : 'No'}
- Schemas/Models: ${summary.schemaCount}

MAIN RESOURCES:`;

  for (const resource of summary.mainResources) {
    result += `\n- ${resource.name}: ${resource.operations.length} operations`;
    if (resource.properties && resource.properties.length > 0) {
      result += `\n  Properties: ${resource.properties.slice(0, 5).join(', ')}${resource.properties.length > 5 ? '...' : ''}`;
    }
  }

  if (summary.commonOperations.length > 0) {
    result += `\n\nCOMMON OPERATION PATTERNS: ${summary.commonOperations.join(', ')}`;
  }

  if (summary.description) {
    result += `\n\nAPI DESCRIPTION: ${summary.description.slice(0, 300)}${summary.description.length > 300 ? '...' : ''}`;
  }

  return result;
}