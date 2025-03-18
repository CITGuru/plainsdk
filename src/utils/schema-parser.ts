import { OpenAPIV3 } from 'openapi-types';
import { PlainSDKConfig } from '../types';

/**
 * Parse OpenAPI schemas into a normalized format for code generation
 * 
 * @param schemas - OpenAPI schema definitions
 * @param config - PlainSDK configuration
 * @returns Normalized schema definitions
 */
export function parseSchema(
  schemas: Record<string, any>,
  config: PlainSDKConfig
): Record<string, any> {
  const result: Record<string, any> = {};
  
  for (const [name, schema] of Object.entries(schemas)) {
    result[name] = parseSchemaObject(schema, name, schemas, config);
  }
  
  return result;
}

/**
 * Parse a single schema object
 */
function parseSchemaObject(
  schema: any,
  name: string,
  allSchemas: Record<string, any>,
  config: PlainSDKConfig,
  visited: Set<string> = new Set()
): any {
  if (visited.has(name)) {
    // Handle circular references
    return { type: 'reference', name };
  }
  
  visited.add(name);
  
  const result = {
    name,
    description: schema?.description || '',
    nullable: schema?.nullable || false,
    deprecated: schema?.deprecated || false,
};

if (!schema) {
    return {
        ...result,
        type: 'unknown',
    };
}
  
  if (schema.$ref) {
    // Handle references
    const refName = schema.$ref.split('/').pop();
    const refSchema = allSchemas[refName];
    
    if (refSchema) {
      const parsedRef = parseSchemaObject(
        refSchema,
        refName,
        allSchemas,
        config,
        visited
      );
      
      return {
        ...result,
        type: 'reference',
        reference: refName,
        properties: parsedRef.properties,
      };
    }
    
    return {
      ...result,
      type: 'reference',
      reference: refName,
    };
  }
  
  if (schema.allOf) {
    // Handle allOf composition
    const allProps = {};
    
    for (const subSchema of schema.allOf) {
      const parsed = parseSchemaObject(
        subSchema,
        `${name}_sub`,
        allSchemas,
        config,
        visited
      );
      
      if (parsed.properties) {
        Object.assign(allProps, parsed.properties);
      }
    }
    
    return {
      ...result,
      type: 'object',
      properties: allProps,
    };
  }
  
  if (schema.type === 'object' || schema.properties) {
    // Handle object type
    const properties: Record<string, any> = {};
    
    for (const [propName, propSchema] of Object.entries(schema.properties || {})) {
      properties[propName] = parseSchemaObject(
        propSchema,
        `${name}_${propName}`,
        allSchemas,
        config,
        visited
      );
    }
    
    return {
      ...result,
      type: 'object',
      properties,
      required: schema.required || [],
      additionalProperties: schema.additionalProperties,
    };
  }
  
  if (schema.type === 'array') {
    // Handle array type
    const items = parseSchemaObject(
      schema.items,
      `${name}_item`,
      allSchemas,
      config,
      visited
    );
    
    return {
      ...result,
      type: 'array',
      items,
    };
  }
  
  if (schema.enum) {
    // Handle enum type
    return {
      ...result,
      type: 'enum',
      values: schema.enum,
      enumType: schema.type || 'string',
    };
  }
  
  // Handle primitive types
  if (schema.type === 'string') {
    return {
      ...result,
      type: 'string',
      format: schema.format,
      pattern: schema.pattern,
      minLength: schema.minLength,
      maxLength: schema.maxLength,
    };
  }
  
  if (schema.type === 'number' || schema.type === 'integer') {
    return {
      ...result,
      type: schema.type,
      format: schema.format,
      minimum: schema.minimum,
      maximum: schema.maximum,
      exclusiveMinimum: schema.exclusiveMinimum,
      exclusiveMaximum: schema.exclusiveMaximum,
      multipleOf: schema.multipleOf,
    };
  }
  
  if (schema.type === 'boolean') {
    return {
      ...result,
      type: 'boolean',
    };
  }
  
  // Handle oneOf, anyOf types
  if (schema.oneOf) {
    const variants = schema.oneOf.map((variant: any, index: number) => 
      parseSchemaObject(
        variant,
        `${name}_oneOf_${index}`,
        allSchemas,
        config,
        visited
      )
    );
    
    return {
      ...result,
      type: 'oneOf',
      variants,
    };
  }
  
  if (schema.anyOf) {
    const variants = schema.anyOf.map((variant: any, index: number) => 
      parseSchemaObject(
        variant,
        `${name}_anyOf_${index}`,
        allSchemas,
        config,
        visited
      )
    );
    
    return {
      ...result,
      type: 'anyOf',
      variants,
    };
  }
  
  // Default to unknown type
  return {
    ...result,
    type: 'unknown',
  };
}

/**
 * Resolve a JSON Schema reference
 */
function resolveReference(ref: string, allSchemas: Record<string, any>): any {
  const parts = ref.split('/');
  const name = parts[parts.length - 1];
  
  return allSchemas[name];
}