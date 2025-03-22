import chalk from 'chalk';
import SwaggerParser from '@apidevtools/swagger-parser';

/**
 * Validation result with potential issues
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

/**
 * Validation issue with details
 */
export interface ValidationIssue {
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Validates an OpenAPI specification for SDK generation compatibility
 * 
 * @param specPath - Path to the OpenAPI specification
 * @returns Validation result
 */
export async function validateOpenAPISpec(specPath: string): Promise<ValidationResult> {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: []
  };
  
  try {
    // Parse and validate the OpenAPI document
    const api = await SwaggerParser.validate(specPath);
    
    // Check for potential SDK generation issues
    await checkForSDKIssues(api, result);
    
    // Set valid flag based on errors
    result.valid = result.errors.length === 0;
    
    return result;
    
  } catch (error) {
    // Handle validation errors from the parser
    if (error instanceof Error) {
      result.errors.push({
        path: 'root',
        message: error.message,
        severity: 'error'
      });
    }
    
    result.valid = false;
    return result;
  }
}

/**
 * Check for potential issues that would affect SDK generation
 */
async function checkForSDKIssues(api: any, result: ValidationResult): Promise<void> {
  // Check if OpenAPI version is supported
  const openApiVersion = api.openapi || api.swagger;
  if (!openApiVersion || !openApiVersion.startsWith('3.')) {
    result.warnings.push({
      path: 'root',
      message: `OpenAPI version ${openApiVersion || 'unknown'} detected. Only OpenAPI 3.x is fully supported.`,
      severity: 'warning'
    });
  }
  
  // Check if there are any paths defined
  if (!api.paths || Object.keys(api.paths).length === 0) {
    result.errors.push({
      path: 'paths',
      message: 'No API paths defined. SDK will be empty.',
      severity: 'error'
    });
  }
  
  // Check if operationIds are present and unique
  const operationIds = new Set<string>();
  const duplicateOperationIds = new Set<string>();
  const missingOperationIdPaths: string[] = [];
  
  for (const [pathName, pathObj] of Object.entries<any>(api.paths || {})) {
    for (const [method, operation] of Object.entries<any>(pathObj || {})) {
      if (method === 'parameters' || method === '$ref') continue;
      
      if (!operation.operationId) {
        missingOperationIdPaths.push(`${method.toUpperCase()} ${pathName}`);
      } else {
        if (operationIds.has(operation.operationId)) {
          duplicateOperationIds.add(operation.operationId);
        } else {
          operationIds.add(operation.operationId);
        }
      }
    }
  }
  
  if (missingOperationIdPaths.length > 0) {
    result.warnings.push({
      path: 'paths',
      message: `Missing operationId in ${missingOperationIdPaths.length} operations. This may affect method naming in the SDK.`,
      severity: 'warning'
    });
  }
  
  if (duplicateOperationIds.size > 0) {
    result.errors.push({
      path: 'paths',
      message: `Found ${duplicateOperationIds.size} duplicate operationIds: ${Array.from(duplicateOperationIds).join(', ')}`,
      severity: 'error'
    });
  }
  
  // Check if schemas are defined
  if (!api.components?.schemas || Object.keys(api.components.schemas).length === 0) {
    result.warnings.push({
      path: 'components.schemas',
      message: 'No schema definitions found. SDK will have limited type safety.',
      severity: 'warning'
    });
  }
  
  // Check security schemes
  if (!api.components?.securitySchemes || Object.keys(api.components.securitySchemes).length === 0) {
    result.warnings.push({
      path: 'components.securitySchemes',
      message: 'No security schemes defined. Authentication may not be properly supported.',
      severity: 'warning'
    });
  }
  
  // Check for circular references
  try {
    await SwaggerParser.resolve(api);
  } catch (error) {
    if (error instanceof Error && error.message.includes('Circular $ref pointer')) {
      result.warnings.push({
        path: 'root',
        message: 'Circular references detected in the spec. May cause issues in SDK generation.',
        severity: 'warning'
      });
    }
  }
}

/**
 * Print validation results to the console
 */
export function printValidationResults(results: ValidationResult): void {
  if (results.valid) {
    console.log(chalk.green('✅ OpenAPI specification is valid for SDK generation'));
  } else {
    console.log(chalk.red('❌ OpenAPI specification has issues that may affect SDK generation'));
  }
  
  if (results.errors.length > 0) {
    console.log(chalk.red('\nErrors:'));
    results.errors.forEach(error => {
      console.log(chalk.red(`  - [${error.path}] ${error.message}`));
    });
  }
  
  if (results.warnings.length > 0) {
    console.log(chalk.yellow('\nWarnings:'));
    results.warnings.forEach(warning => {
      console.log(chalk.yellow(`  - [${warning.path}] ${warning.message}`));
    });
  }
  
  if (results.errors.length === 0 && results.warnings.length === 0) {
    console.log(chalk.green('No issues found!'));
  }
}