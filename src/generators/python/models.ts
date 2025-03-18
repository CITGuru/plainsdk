import { PlainSDKConfig } from '../../types';
import { formatModelName, toSnakeCase, toPascalCase } from '../../utils/formatter';

/**
 * Generate Python models from OpenAPI schemas
 * 
 * @param modelDefinitions - Parsed model definitions
 * @param packageName - Python package name
 * @param config - PlainSDK configuration
 * @returns Generated Python model files
 */
export async function generatePythonModels(
  modelDefinitions: Record<string, any>,
  packageName: string,
  config: PlainSDKConfig
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  
  // Generate model file for each definition
  for (const [name, definition] of Object.entries(modelDefinitions)) {
    const modelName = formatModelName(name, config.naming.modelStyle);
    const snakeName = toSnakeCase(modelName);
    const content = generatePythonModelContent(modelName, definition, config);
    
    files[`${packageName}/models/${snakeName}.py`] = content;
  }
  
  return files;
}

/**
 * Generate Python model content
 * 
 * @param modelName - Name of the model
 * @param definition - Model definition
 * @param config - PlainSDK configuration
 * @returns Generated model content
 */
function generatePythonModelContent(
  modelName: string,
  definition: any,
  config: PlainSDKConfig
): string {
  // Start with imports
  let content = `from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from datetime import datetime

`;

  // Add imports for referenced models
  const imports = getModelImports(definition);
  if (imports.length > 0) {
    const importStatements = imports.map(name => {
      const snakeName = toSnakeCase(name);
      return `from .${snakeName} import ${name}`;
    });
    content += importStatements.join('\n') + '\n\n';
  }

  // Generate class definition
  if (definition.enum) {
    // Handle enum
    content += generatePythonEnum(modelName, definition);
  } else {
    // Handle regular model/dataclass
    content += generatePythonDataclass(modelName, definition);
  }

  return content;
}

/**
 * Get imports for referenced models
 * 
 * @param definition - Model definition
 * @returns Array of model names to import
 */
function getModelImports(definition: any): string[] {
  const imports: Set<string> = new Set();

  function collectImports(def: any) {
    if (!def) return;

    // Handle reference
    if (def.reference) {
      imports.add(def.reference);
    }

    // Handle properties
    if (def.properties) {
      for (const prop of Object.values(def.properties)) {
        collectImports(prop);
      }
    }

    // Handle array items
    if (def.type === 'array' && def.items) {
      collectImports(def.items);
    }

    // Handle schema compositions
    ['allOf', 'oneOf', 'anyOf'].forEach(key => {
      if (def[key]) {
        def[key].forEach((schema: any) => {
          collectImports(schema);
        });
      }
    });
  }

  collectImports(definition);
  return Array.from(imports);
}

/**
 * Generate Python enum
 * 
 * @param name - Enum name
 * @param definition - Enum definition
 * @returns Generated Python enum
 */
function generatePythonEnum(name: string, definition: any): string {
  const values = definition.values || [];
  const docs = definition.description ? `"""${definition.description}"""\n    ` : '';

  // Use Enum for string values, IntEnum for numeric values
  const enumType = definition.enumType === 'string' ? 'str, Enum' : 'int, IntEnum';
  const imports = definition.enumType === 'string' 
    ? 'from enum import Enum' 
    : 'from enum import IntEnum';

  let content = `${imports}\n\n\nclass ${name}(${enumType}):\n    ${docs}`;

  // Add enum values
  for (const value of values) {
    const enumKey = toValidPythonIdentifier(String(value));
    if (definition.enumType === 'string') {
      content += `${enumKey} = "${value}"\n    `;
    } else {
      content += `${enumKey} = ${value}\n    `;
    }
  }

  return content;
}

/**
 * Generate Python dataclass
 * 
 * @param name - Class name
 * @param definition - Class definition
 * @returns Generated Python dataclass
 */
function generatePythonDataclass(name: string, definition: any): string {
  const docs = definition.description 
    ? `"""${definition.description}"""\n    ` 
    : '';

  let content = `@dataclass
class ${name}:
    ${docs}`;

  // Add class properties
  if (definition.properties) {
    for (const [propName, propDef] of Object.entries(definition.properties) as Array<[string, { description?: string, [x: string]: any }]>) {
      const pythonPropName = toSnakeCase(propName);
      const isRequired = definition.required?.includes(propName);
      const propType = getPythonType(propDef);
      const propDocs = propDef.description ? `"""${propDef.description}"""\n    ` : '';

      // let proppedName = `${/^\d/.test(pythonPropName) ? `"${pythonPropName}"`: pythonPropName}`
      
      if (/^\d/.test(pythonPropName)){
        console.log('Warning - Invalid Variable. Resolution - Removing ', pythonPropName);
        continue
      }

      if (isRequired) {
        content += `${pythonPropName}: ${propType}\n    ${propDocs}`;
      } else {
        content += `${pythonPropName}: Optional[${propType}] = None\n    ${propDocs}`;
      }
    }
  }

  // If no properties, add pass statement
  if (!definition.properties || Object.keys(definition.properties).length === 0) {
    content += 'pass\n';
  }

  return content;
}

/**
 * Get Python type from a schema definition
 * 
 * @param definition - Schema definition
 * @returns Python type string
 */
function getPythonType(definition: any): string {
  if (!definition) {
    return 'Any';
  }

  if (definition.reference) {
    return definition.reference;
  }

  if (definition.type === 'array') {
    const itemType = definition.items ? getPythonType(definition.items) : 'Any';
    return `List[${itemType}]`;
  }

  if (definition.type === 'object') {
    if (definition.additionalProperties) {
      const valueType = typeof definition.additionalProperties === 'boolean'
        ? 'Any'
        : getPythonType(definition.additionalProperties);
      return `Dict[str, ${valueType}]`;
    }
    
    return 'Dict[str, Any]';
  }

  if (definition.oneOf || definition.anyOf) {
    const variants = definition.oneOf || definition.anyOf;
    if (variants.length === 1) {
      return getPythonType(variants[0]);
    }
    // Python 3.10+ supports Union as a type directly, but for compatibility we use Optional
    if (variants.length === 2 && variants.some((v: { type: any }) => v.type === 'null')) {
      const nonNullVariant = variants.find((v: { type: any }) => v.type !== 'null');
      return `Optional[${getPythonType(nonNullVariant)}]`;
    }
    // For more complex unions, use Any
    return 'Any';
  }

  if (definition.enum) {
    // Reference to an enum
    if (definition.enumName) {
      return definition.enumName;
    }
    return 'str';  // Default to string for inline enums
  }

  switch (definition.type) {
    case 'string':
      if (definition.format === 'date' || definition.format === 'date-time') {
        return 'datetime';
      }
      return 'str';
    case 'number':
    case 'integer':
      return 'int' + (definition.format === 'float' || definition.format === 'double' ? ' | float' : '');
    case 'boolean':
      return 'bool';
    case 'null':
      return 'None';
    default:
      return 'Any';
  }
}

/**
 * Convert a string to a valid Python identifier
 * 
 * @param value - Original value
 * @returns Valid Python identifier
 */
function toValidPythonIdentifier(value: string): string {
  // Replace invalid characters with underscores
  let identifier = value.replace(/[^a-zA-Z0-9_]/g, '_');
  
  // Ensure it doesn't start with a number
  if (/^[0-9]/.test(identifier)) {
    identifier = '_' + identifier;
  }
  
  // Handle Python reserved keywords
  const pythonKeywords = [
    'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await',
    'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except',
    'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is',
    'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return',
    'try', 'while', 'with', 'yield'
  ];
  
  if (pythonKeywords.includes(identifier)) {
    identifier += '_';
  }
  
  return identifier;
}