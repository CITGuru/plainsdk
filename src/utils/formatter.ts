import { format as prettierFormat } from 'prettier';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

/**
 * Format TypeScript/JavaScript code
 * 
 * @param content - The code to format
 * @returns Formatted code
 */
export async function formatTypescript(content: string): Promise<string> {
  try {
    // Try to use project's prettier config
    const configPath = await findPrettierConfig();
    
    const options: any = {
      parser: 'typescript',
      printWidth: 100,
      tabWidth: 2,
      singleQuote: true,
      trailingComma: 'es5',
      bracketSpacing: true,
      semi: true,
    };
    
    if (configPath) {
      // Load and merge with project config
      const projectConfig = require(configPath);
      Object.assign(options, projectConfig);
    }
    
    return prettierFormat(content, options);
  } catch (error) {
    // If formatting fails, return original content
    console.warn('Failed to format TypeScript code:', error);
    return content;
  }
}

/**
 * Format Python code
 * 
 * @param content - The code to format
 * @returns Formatted code
 */
export async function formatPython(content: string): Promise<string> {
  try {
    // Check if black is installed
    const hasBlack = await checkCommandExists('black --version');
    
    if (hasBlack) {
      // Use black for formatting
      const tempFile = path.join(process.cwd(), '.plainsdk-temp.py');
      await fs.writeFile(tempFile, content, 'utf-8');
      
      await execAsync(`black --quiet ${tempFile}`);
      
      const formatted = await fs.readFile(tempFile, 'utf-8');
      await fs.unlink(tempFile);
      
      return formatted;
    }
    
    // Fallback to simple indentation formatting
    return formatPythonIndentation(content);
  } catch (error) {
    // If formatting fails, return original content
    console.warn('Failed to format Python code:', error);
    return content;
  }
}

/**
 * Format Go code
 * 
 * @param content - The code to format
 * @returns Formatted code
 */
export async function formatGo(content: string): Promise<string> {
  try {
    // Check if gofmt is installed
    const hasGofmt = await checkCommandExists('gofmt -h');
    
    if (hasGofmt) {
      // Use gofmt for formatting
      const tempFile = path.join(process.cwd(), '.plainsdk-temp.go');
      await fs.writeFile(tempFile, content, 'utf-8');
      
      const { stdout } = await execAsync(`gofmt ${tempFile}`);
      
      await fs.unlink(tempFile);
      
      return stdout;
    }
    
    // If gofmt isn't available, return original content
    return content;
  } catch (error) {
    // If formatting fails, return original content
    console.warn('Failed to format Go code:', error);
    return content;
  }
}

/**
 * Format Java code
 * 
 * @param content - The code to format
 * @returns Formatted code
 */
export async function formatJava(content: string): Promise<string> {
  try {
    // Check if google-java-format is installed
    const hasJavaFormat = await checkCommandExists('google-java-format --version');
    
    if (hasJavaFormat) {
      // Use google-java-format for formatting
      const tempFile = path.join(process.cwd(), '.plainsdk-temp.java');
      await fs.writeFile(tempFile, content, 'utf-8');
      
      const { stdout } = await execAsync(`google-java-format ${tempFile}`);
      
      await fs.unlink(tempFile);
      
      return stdout;
    }
    
    // If google-java-format isn't available, return original content
    return content;
  } catch (error) {
    // If formatting fails, return original content
    console.warn('Failed to format Java code:', error);
    return content;
  }
}

/**
 * Format C# code
 * 
 * @param content - The code to format
 * @returns Formatted code
 */
export async function formatCSharp(content: string): Promise<string> {
  try {
    // Check if dotnet-format is installed
    const hasDotnetFormat = await checkCommandExists('dotnet format --version');
    
    if (hasDotnetFormat) {
      // Use dotnet-format for formatting
      const tempFile = path.join(process.cwd(), '.plainsdk-temp.cs');
      await fs.writeFile(tempFile, content, 'utf-8');
      
      await execAsync(`dotnet format ${tempFile}`);
      
      const formatted = await fs.readFile(tempFile, 'utf-8');
      await fs.unlink(tempFile);
      
      return formatted;
    }
    
    // If dotnet-format isn't available, return original content
    return content;
  } catch (error) {
    // If formatting fails, return original content
    console.warn('Failed to format C# code:', error);
    return content;
  }
}

/**
 * Format PHP code
 * 
 * @param content - The code to format
 * @returns Formatted code
 */
export async function formatPHP(content: string): Promise<string> {
  try {
    // Check if php-cs-fixer is installed
    const hasPhpCsFixer = await checkCommandExists('php-cs-fixer --version');
    
    if (hasPhpCsFixer) {
      // Use php-cs-fixer for formatting
      const tempFile = path.join(process.cwd(), '.plainsdk-temp.php');
      await fs.writeFile(tempFile, content, 'utf-8');
      
      await execAsync(`php-cs-fixer fix ${tempFile}`);
      
      const formatted = await fs.readFile(tempFile, 'utf-8');
      await fs.unlink(tempFile);
      
      return formatted;
    }
    
    // If php-cs-fixer isn't available, return original content
    return content;
  } catch (error) {
    // If formatting fails, return original content
    console.warn('Failed to format PHP code:', error);
    return content;
  }
}

/**
 * Format Ruby code
 * 
 * @param content - The code to format
 * @returns Formatted code
 */
export async function formatRuby(content: string): Promise<string> {
  try {
    // Check if rubocop is installed
    const hasRubocop = await checkCommandExists('rubocop --version');
    
    if (hasRubocop) {
      // Use rubocop for formatting
      const tempFile = path.join(process.cwd(), '.plainsdk-temp.rb');
      await fs.writeFile(tempFile, content, 'utf-8');
      
      await execAsync(`rubocop -a ${tempFile}`);
      
      const formatted = await fs.readFile(tempFile, 'utf-8');
      await fs.unlink(tempFile);
      
      return formatted;
    }
    
    // If rubocop isn't available, return original content
    return content;
  } catch (error) {
    // If formatting fails, return original content
    console.warn('Failed to format Ruby code:', error);
    return content;
  }
}

/**
 * Simple Python indentation formatter
 */
function formatPythonIndentation(content: string): string {
  const lines = content.split('\n');
  let indentLevel = 0;
  const formattedLines: string[] = [];
  
  for (let line of lines) {
    // Trim trailing whitespace
    line = line.trimRight();
    
    // Skip empty lines
    if (!line.trim()) {
      formattedLines.push('');
      continue;
    }
    
    // Decrease indent for lines that end blocks
    if (line.trim().startsWith('}') || line.trim().startsWith(')') || line.trim() === 'else:' || line.trim() === 'elif:') {
      indentLevel = Math.max(0, indentLevel - 1);
    }
    
    // Add indentation
    const indentation = '    '.repeat(indentLevel);
    formattedLines.push(indentation + line.trim());
    
    // Increase indent for lines that start blocks
    if (line.trim().endsWith(':') || line.trim().endsWith('{') || line.trim().endsWith('(')) {
      indentLevel += 1;
    }
  }
  
  return formattedLines.join('\n');
}

/**
 * Find a Prettier config file in the project
 */
async function findPrettierConfig(): Promise<string | null> {
  const configFiles = [
    '.prettierrc',
    '.prettierrc.json',
    '.prettierrc.js',
    '.prettierrc.yml',
    '.prettierrc.yaml',
    'prettier.config.js',
  ];
  
  for (const file of configFiles) {
    try {
      const configPath = path.join(process.cwd(), file);
      await fs.access(configPath);
      return configPath;
    } catch (error) {
      // Config file not found, try next one
    }
  }
  
  return null;
}

/**
 * Check if a command exists and can be executed
 */
async function checkCommandExists(command: string): Promise<boolean> {
  try {
    await execAsync(command);
    return true;
  } catch (error) {
    return false;
  }
}


/**
 * Format a model name according to the specified style
 * 
 * @param name - Original name
 * @param style - Naming style (camelCase, snake_case, PascalCase)
 * @returns Formatted name
 */
export function formatModelName(name: string, style: string): string {
    switch (style) {
      case 'camelCase':
        return toCamelCase(name);
      case 'snake_case':
        return toSnakeCase(name);
      case 'PascalCase':
        return toPascalCase(name);
      default:
        return name;
    }
  }
  
  /**
   * Format a method name according to the specified style
   * 
   * @param name - Original name
   * @param style - Naming style (camelCase, snake_case, PascalCase)
   * @returns Formatted name
   */
  export function formatMethodName(name: string, style: string): string {
    switch (style) {
      case 'camelCase':
        return toCamelCase(name);
      case 'snake_case':
        return toSnakeCase(name);
      case 'PascalCase':
        return toPascalCase(name);
      default:
        return name;
    }
  }
  
  /**
   * Format a parameter name according to the specified style
   * 
   * @param name - Original name
   * @param style - Naming style (camelCase, snake_case, PascalCase)
   * @returns Formatted name
   */
  export function formatParameterName(name: string, style: string): string {
    switch (style) {
      case 'camelCase':
        return toCamelCase(name);
      case 'snake_case':
        return toSnakeCase(name);
      case 'PascalCase':
        return toPascalCase(name);
      default:
        return name;
    }
  }
  
  /**
   * Format a resource name according to the specified style
   * 
   * @param name - Original name
   * @param style - Naming style (camelCase, snake_case, PascalCase)
   * @returns Formatted name
   */
  export function formatResourceName(name: string, style: string): string {
    // Handle plural forms and transform to singular
    // This is a simplistic implementation; a real one would use a proper singularization library
    // const singular = name.endsWith('s') ? name.slice(0, -1) : name;
    const singular = name

    console.log(singular, name)
    
    switch (style) {
      case 'camelCase':
        return toCamelCase(singular);
      case 'snake_case':
        return toSnakeCase(singular);
      case 'PascalCase':
        return toPascalCase(singular);
      default:
        return singular;
    }
  }
  
  /**
   * Convert a string to camelCase
   * 
   * @param str - Input string
   * @returns camelCase string
   */
  export function toCamelCase(str: string): string {
    return str
      // Split on any non-alphanumeric character
      .split(/[^a-zA-Z0-9]/)
      // Filter out empty segments
      .filter(Boolean)
      // Convert first word to lowercase, others to title case
      .map((word, index) => {
        if (index === 0) {
          return word.toLowerCase();
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join('');
  }
  
  /**
   * Convert a string to snake_case
   * 
   * @param str - Input string
   * @returns snake_case string
   */
  export function toSnakeCase(str: string): string {
    return str
      // Handle camelCase
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      // Split on any non-alphanumeric character
      .split(/[^a-zA-Z0-9]/)
      // Filter out empty segments
      .filter(Boolean)
      // Convert all to lowercase
      .map(word => word.toLowerCase())
      .join('_');
  }
  
  /**
   * Convert a string to PascalCase
   * 
   * @param str - Input string
   * @returns PascalCase string
   */
  export function toPascalCase(str: string): string {
    return str
      // Split on any non-alphanumeric character
      .split(/[^a-zA-Z0-9]/)
      // Filter out empty segments
      .filter(Boolean)
      // Convert all words to title case
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }