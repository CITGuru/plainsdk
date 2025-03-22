import fs from 'fs/promises';
import path from 'path';
import { PlainSDKConfig } from '../../types';

/**
 * Load style guide for a language
 * 
 * @param config - PlainSDK configuration
 * @param language - Target programming language
 * @returns Style guide content or null if not found
 */
export async function loadStyleGuide(config: PlainSDKConfig, language: string): Promise<string | null> {
  try {
    // Check for custom style guide in configuration
    if (config.llm?.styleGuidePath) {
      const customStylePath = path.resolve(process.cwd(), config.llm.styleGuidePath);
      try {
        return await fs.readFile(customStylePath, 'utf-8');
      } catch (error) {
        console.warn(`Could not load custom style guide from ${customStylePath}`);
      }
    }
    
    // Try to load built-in style guide for the language
    const builtInStylePath = path.join(__dirname, 'style-guides', `${language}.md`);
    try {
      return await fs.readFile(builtInStylePath, 'utf-8');
    } catch (error) {
      // No built-in style guide for this language
    }
    
    return null;
  } catch (error) {
    console.warn('Error loading style guide:', error);
    return null;
  }
}

/**
 * Get default style guide for a language
 * 
 * @param language - Target programming language
 * @returns Default style guide content
 */
export function getDefaultStyleGuide(language: string): string {
  switch (language) {
    case 'typescript':
      return `# TypeScript Style Guide

## Naming Conventions
- Use PascalCase for class and interface names
- Use camelCase for variables, properties, and method names
- Use camelCase for file names

## Code Structure
- One class/interface per file
- Group imports by source (external, then internal)
- Use named exports, not default exports

## Documentation
- Use JSDoc for all public APIs
- Include examples in documentation for complex methods
- Document all parameters and return values

## Error Handling
- Use custom error classes that extend from a base error
- Include appropriate error types in method signatures
- Use try/catch blocks consistently

## Type Safety
- Avoid 'any' type unless absolutely necessary
- Use union types instead of overloads when possible
- Use generics for reusable components
- Use readonly for immutable properties

## Asynchronous Code
- Use async/await consistently, not mixed with Promises
- Handle errors in async functions with try/catch
- Use proper typing for async functions

## Testing
- Write unit tests for all public APIs
- Use descriptive test names
- Organize tests to match the structure of the code
`;
    case 'python':
      return `# Python Style Guide

## Naming Conventions
- Use snake_case for variables, functions, methods, and modules
- Use PascalCase for class names
- Use UPPER_CASE for constants

## Code Structure
- Follow PEP 8 guidelines
- Maximum line length: 88 characters (Black formatter standard)
- Use 4 spaces for indentation, not tabs

## Documentation
- Use Google-style docstrings
- Document all parameters, return values, and exceptions
- Include examples for complex functions

## Error Handling
- Define custom exceptions that inherit from appropriate base exceptions
- Use context managers (with statements) where appropriate
- Use specific exception types for different error cases

## Type Hints
- Use type hints for all function parameters and return values
- Use Optional[] for parameters that can be None
- Use Union[] for parameters that can be multiple types

## Imports
- Group imports: standard library, third-party, local
- Sort imports alphabetically within groups
- Avoid wildcard imports

## Classes
- Use dataclasses for data containers
- Use proper class inheritance
- Define __str__ and __repr__ methods

## Testing
- Write unit tests for all public APIs
- Use pytest for testing
- Use descriptive test names
`;
    case 'java':
      return `# Java Style Guide

## Naming Conventions
- Use PascalCase for class names
- Use camelCase for methods and variables
- Use UPPER_SNAKE_CASE for constants

## Code Structure
- One class per file
- Follow standard Java package structure
- Use proper access modifiers (private, protected, public)

## Documentation
- Use Javadoc for all public APIs
- Document all parameters, return values, and exceptions
- Include examples for complex methods

## Error Handling
- Use custom exceptions that extend appropriate base exceptions
- Use checked exceptions for recoverable errors
- Use runtime exceptions for programming errors

## Type Safety
- Use generics for type safety
- Use final for immutable objects
- Use proper Java collections

## Design Patterns
- Use builder pattern for complex objects
- Use factory methods where appropriate
- Follow dependency injection principles

## Testing
- Write unit tests for all public APIs
- Use JUnit for testing
- Mock external dependencies
`;
    default:
      return '';
  }
}