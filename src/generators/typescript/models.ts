import { PlainSDKConfig } from '../../types';
import { formatModelName } from '../../utils/formatter';

/**
 * Generate TypeScript models from OpenAPI schemas
 * 
 * @param modelDefinitions - Parsed model definitions
 * @param config - PlainSDK configuration
 * @returns Generated model files
 */
export async function generateModels(
  modelDefinitions: Record<string, any>,
  config: PlainSDKConfig
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  
  // Generate model file for each definition
  for (const [name, definition] of Object.entries(modelDefinitions)) {
    const modelName = formatModelName(name, config.naming.modelStyle);
    const content = generateModelContent(modelName, definition, config);
    
    files[`src/models/${modelName}.ts`] = content;
  }
  
  // Generate index file for models
  const modelNames = Object.keys(modelDefinitions).map(name => 
    formatModelName(name, config.naming.modelStyle)
  );
  
  const indexContent = modelNames.map(name => `export * from './${name}';`).join('\n');
  files['src/models/index.ts'] = `${indexContent}\n`;
  
  return files;
}

/**
 * Generate TypeScript model content
 * 
 * @param modelName - Name of the model
 * @param definition - Model definition
 * @param config - PlainSDK configuration
 * @returns Generated model content
 */
function generateModelContent(
  modelName: string,
  definition: any,
  config: PlainSDKConfig
): string {
  const imports = new Set<string>();
  const content: string[] = [];
  
  // Add imports for referenced models
  collectImports(definition, imports);
  
  // Generate import statements
  if (imports.size > 0) {
    content.push(generateImports(imports));
  }
  
  // Handle different model types
  if (definition.enum) {
    // Generate enum
    content.push(generateEnum(modelName, definition));
  } else if (definition.type === 'object' || definition.properties) {
    // Generate interface
    content.push(generateInterface(modelName, definition));
  } else if (definition.oneOf || definition.anyOf) {
    // Generate union type
    content.push(generateUnionType(modelName, definition));
  } else if (definition.allOf) {
    // Generate intersection type
    content.push(generateIntersectionType(modelName, definition));
  } else if (definition.type === 'array') {
    // Generate array type
    content.push(generateArrayType(modelName, definition));
  } else {
    // Generate alias for primitive types
    content.push(generateTypeAlias(modelName, definition));
  }
  
  return content.join('\n\n');
}

/**
 * Collect imports for referenced models
 * 
 * @param definition - Model definition
 * @param imports - Set to add imports to
 */
function collectImports(definition: any, imports: Set<string>): void {
  if (!definition) {
    return;
  }
  
  if (definition.type === 'reference' || definition.reference) {
    imports.add(definition.reference || definition.name);
    return;
  }
  
  if (definition.type === 'array' && definition.items) {
    collectImports(definition.items, imports);
    return;
  }
  
  if (definition.properties) {
    for (const prop of Object.values(definition.properties)) {
      collectImports(prop, imports);
    }
  }
  
  if (definition.additionalProperties && typeof definition.additionalProperties !== 'boolean') {
    collectImports(definition.additionalProperties, imports);
  }
  
  // Handle schema compositions
  ['allOf', 'oneOf', 'anyOf'].forEach(key => {
    if (definition[key]) {
      definition[key].forEach((schema: any) => {
        collectImports(schema, imports);
      });
    }
  });
}

/**
 * Generate import statements
 * 
 * @param imports - Set of import names
 * @returns Import statements
 */
function generateImports(imports: Set<string>): string {
  if (imports.size === 0) {
    return '';
  }
  
  return `import { ${Array.from(imports).join(', ')} } from './';`;
}

/**
 * Generate enum definition
 * 
 * @param name - Enum name
 * @param definition - Enum definition
 * @returns Enum definition
 */
function generateEnum(name: string, definition: any): string {
  // Generate documentation
  const docs = definition.description 
    ? `/**\n * ${definition.description}\n */\n` 
    : '';
  
  // Handle string and numeric enums differently
  if (definition.enumType === 'string') {
    const values = definition.values.map((value: string) => 
      `  ${toValidEnumKey(value)} = '${value}'`
    );
    
    return `${docs}export enum ${name} {\n${values.join(',\n')}\n}`;
  } else {
    const values = definition.values.map((value: any) => 
      `  ${toValidEnumKey(String(value))} = ${value}`
    );
    
    return `${docs}export enum ${name} {\n${values.join(',\n')}\n}`;
  }
}

/**
 * Generate interface definition
 * 
 * @param name - Interface name
 * @param definition - Interface definition
 * @returns Interface definition
 */
function generateInterface(name: string, definition: any): string {
  // Generate documentation
  const docs = definition.description 
    ? `/**\n * ${definition.description}\n */\n` 
    : '';
  
  // Generate properties
  const properties: string[] = [];
  
  if (definition.properties) {
    for (const [propName, propDef] of Object.entries(definition.properties) as Array<[string, { description?: string, [x: string]: any }]>) {
      const isRequired = definition.required?.includes(propName);
      const propDocs = propDef.description ? `  /**\n   * ${propDef.description}\n   */\n` : `// Data Type - ${propName}`;
      const propType = getTypeFromDefinition(propDef);
      
      properties.push(`${propDocs}  ${/^\d/.test(propName) ? `"${propName}"`: propName}${isRequired ? '' : '?'}: ${propType};`);
    }
  }
  
  // Handle additional properties
  if (definition.additionalProperties) {
    const valueType = typeof definition.additionalProperties === 'boolean'
      ? 'any'
      : getTypeFromDefinition(definition.additionalProperties);
    
    properties.push(`  [key: string]: ${valueType};`);
  }
  
  return `${docs}export interface ${name} {\n${properties.join('\n')}\n}`;
}

/**
 * Generate union type definition
 * 
 * @param name - Type name
 * @param definition - Union type definition
 * @returns Union type definition
 */
function generateUnionType(name: string, definition: any): string {
  // Generate documentation
  const docs = definition.description 
    ? `/**\n * ${definition.description}\n */\n` 
    : '';
  
  const variants = definition.oneOf || definition.anyOf;
  const unionTypes = variants.map((variant: any) => getTypeFromDefinition(variant));
  
  return `${docs}export type ${name} = ${unionTypes.join(' | ')};`;
}

/**
 * Generate intersection type definition
 * 
 * @param name - Type name
 * @param definition - Intersection type definition
 * @returns Intersection type definition
 */
function generateIntersectionType(name: string, definition: any): string {
  // Generate documentation
  const docs = definition.description 
    ? `/**\n * ${definition.description}\n */\n` 
    : '';
  
  const intersectionTypes = definition.allOf.map((schema: any) => getTypeFromDefinition(schema));
  
  return `${docs}export type ${name} = ${intersectionTypes.join(' & ')};`;
}

/**
 * Generate array type definition
 * 
 * @param name - Type name
 * @param definition - Array definition
 * @returns Array type definition
 */
function generateArrayType(name: string, definition: any): string {
  // Generate documentation
  const docs = definition.description 
    ? `/**\n * ${definition.description}\n */\n` 
    : '';
  
  const itemType = getTypeFromDefinition(definition.items);
  
  return `${docs}export type ${name} = ${itemType}[];`;
}

/**
 * Generate type alias for primitive types
 * 
 * @param name - Type name
 * @param definition - Type definition
 * @returns Type alias definition
 */
function generateTypeAlias(name: string, definition: any): string {
  // Generate documentation
  const docs = definition.description 
    ? `/**\n * ${definition.description}\n */\n` 
    : '';
  
  const type = getTypeFromDefinition(definition);
  
  return `${docs}export type ${name} = ${type};`;
}

/**
 * Get TypeScript type from a schema definition
 * 
 * @param definition - Schema definition
 * @returns TypeScript type
 */
function getTypeFromDefinition(definition: any): string {
  if (!definition) {
    return 'any';
  }
  
  if (definition.type === 'reference' || definition.reference) {
    return definition.reference || definition.name;
  }
  
  if (definition.type === 'array') {
    const itemType = definition.items ? getTypeFromDefinition(definition.items) : 'any';
    return `${itemType}[]`;
  }
  
  if (definition.oneOf || definition.anyOf) {
    const variants = definition.oneOf || definition.anyOf;
    return variants.map((v: any) => getTypeFromDefinition(v)).join(' | ');
  }
  
  if (definition.allOf) {
    return definition.allOf.map((s: any) => getTypeFromDefinition(s)).join(' & ');
  }
  
  if (definition.enum) {
    if (definition.enumType === 'string') {
      return definition.values.map((v: string) => `'${v}'`).join(' | ');
    } else {
      return definition.values.join(' | ');
    }
  }
  
  switch (definition.type) {
    case 'string':
      if (definition.format === 'date' || definition.format === 'date-time') {
        return 'Date';
      }
      return 'string';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'object':
      if (definition.additionalProperties) {
        const valueType = typeof definition.additionalProperties === 'boolean'
          ? 'any'
          : getTypeFromDefinition(definition.additionalProperties);
        return `Record<string, ${valueType}>`;
      }
      return 'Record<string, any>';
    case 'null':
      return 'null';
    default:
      return 'any';
  }
}

/**
 * Convert a string to a valid enum key
 * 
 * @param value - Original value
 * @returns Valid enum key
 */
function toValidEnumKey(value: string): string {
  // Replace invalid characters with underscores
  let key = value.replace(/[^\w]/g, '_');
  
  // Ensure the key starts with a letter or underscore
  if (/^[0-9]/.test(key)) {
    key = '_' + key;
  }
  
  return key;
}