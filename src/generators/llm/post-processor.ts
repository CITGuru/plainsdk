import { PlainSDKConfig } from '../../types';

/**
 * Post-process generated code for consistency and quality
 * 
 * @param files - Map of file paths to file contents
 * @param language - Target programming language
 * @param config - PlainSDK configuration
 * @returns Processed files
 */
export function postProcessGeneratedCode(
  files: Record<string, string>,
  language: string,
  config: PlainSDKConfig
): Record<string, string> {
  const consistencyLevel = config.llm?.consistencyLevel || 'balanced';
  const processedFiles: Record<string, string> = {};
  
  // Analyze the code to extract patterns
  const patterns = extractConsistencyPatterns(files, language);
  
  // Process each file
  for (const [filePath, content] of Object.entries(files)) {
    let processedContent = content;
    
    // Apply language-specific processors
    switch (language) {
      case 'typescript':
        processedContent = processTypeScript(processedContent, patterns, consistencyLevel, config);
        break;
      case 'python':
        processedContent = processPython(processedContent, patterns, consistencyLevel, config);
        break;
      case 'go':
        processedContent = processGo(processedContent, patterns, consistencyLevel, config);
        break;
      // Add more language processors as needed
    }
    
    // Apply common consistency fixes
    processedContent = applyCommonFixes(processedContent, filePath, language, config);
    
    processedFiles[filePath] = processedContent;
  }
  
  return processedFiles;
}

/**
 * Extract consistency patterns from the generated code
 */
function extractConsistencyPatterns(files: Record<string, string>, language: string): any {
  const patterns: any = {
    indentation: 2, // Default
    imports: {},
    namingPatterns: {},
    docPatterns: {},
    errorHandling: {}
  };
  
  // Analyze files to extract consistent patterns
  for (const content of Object.values(files)) {
    // Extract indentation pattern
    const indentMatch = content.match(/^(\s+)\S/m);
    if (indentMatch && indentMatch[1]) {
      const spaces = indentMatch[1].length;
      if (spaces > 0) {
        // Update the most common indentation
        patterns.indentation = spaces;
      }
    }
    
    // Extract other patterns based on language
    if (language === 'typescript') {
      // Extract import patterns
      const importMatches = content.match(/import\s+{[^}]+}\s+from\s+['"][^'"]+['"]/g) || [];
      for (const importMatch of importMatches) {
        patterns.imports.style = 'grouped';
      }
      
      // Extract error handling patterns
      const errorHandlingMatches = content.match(/try\s*{[^}]*}\s*catch\s*\([^)]*\)\s*{[^}]*}/g) || [];
      if (errorHandlingMatches.length > 0) {
        patterns.errorHandling.style = 'try-catch';
      }
    } else if (language === 'python') {
      // Extract import patterns
      const fromImports = (content.match(/from\s+[^\s]+\s+import\s+/g) || []).length;
      const directImports = (content.match(/^import\s+[^\s]+/gm) || []).length;
      patterns.imports.style = fromImports > directImports ? 'from-import' : 'import';
      
      // Extract docstring style
      if (content.includes('"""')) {
        const googleStyleDocs = (content.match(/Args:/g) || []).length;
        const restStyleDocs = (content.match(/:param /g) || []).length;
        patterns.docPatterns.style = googleStyleDocs > restStyleDocs ? 'google' : 'rest';
      }
    }
  }
  
  return patterns;
}

/**
 * Process TypeScript code for consistency
 */
function processTypeScript(
  content: string, 
  patterns: any, 
  level: string, 
  config: PlainSDKConfig
): string {
  let processed = content;
  
  // Fix imports based on extracted patterns
  processed = processed.replace(/import\s+{([^}]+)}/g, (match, imports) => {
    const importItems = imports.split(',').map((item: string) => item.trim()).sort();
    return `import { ${importItems.join(', ')} }`;
  });
  
  // Ensure consistent JSDoc formatting
  processed = processed.replace(/\/\*\*\s*\n([^*]|\*[^/])*\*\//g, (jsdoc) => {
    return jsdoc.replace(/^\s*\*\s+@/gm, ' * @');
  });
  
  // Apply naming conventions based on config
  if (config.naming.methodStyle === 'camelCase') {
    // Ensure method names are camelCase
    processed = processed.replace(/public\s+([A-Z][a-zA-Z0-9]*)\(/g, (match, methodName) => {
      const camelCaseName = methodName.charAt(0).toLowerCase() + methodName.slice(1);
      return `public ${camelCaseName}(`;
    });
  } else if (config.naming.methodStyle === 'PascalCase') {
    // Ensure method names are PascalCase
    processed = processed.replace(/public\s+([a-z][a-zA-Z0-9]*)\(/g, (match, methodName) => {
      const pascalCaseName = methodName.charAt(0).toUpperCase() + methodName.slice(1);
      return `public ${pascalCaseName}(`;
    });
  }
  
  // Ensure consistent indentation
  const indentSize = patterns.indentation || 2;
  processed = processed.replace(/^(\s+)/gm, (match, spaces) => {
    const level = Math.round(spaces.length / indentSize);
    return ' '.repeat(level * indentSize);
  });
  
  // If strict consistency is required, apply more rules
  if (level === 'strict') {
    // Ensure consistent error handling
    processed = processed.replace(/catch\s*\(([^)]*)\)\s*{(?!\s*\/\/)/g, (match, catchParam) => {
      const paramName = catchParam.trim().split(' ')[0] || 'error';
      return `catch (${paramName}) {\n    // Handle error appropriately`;
    });
    
    // Ensure consistent async/await use
    processed = processed.replace(/return\s+new\s+Promise/g, 'return await new Promise');
    
    // Ensure consistent parameter type annotations
    processed = processed.replace(/\(([^:)]+)\)(?!:)/g, (match, params) => {
      // Only modify if it looks like a function parameter list
      if (params.includes(',') || !params.includes('=')) {
        const processedParams = params.split(',').map((param: any) => {
          const trimmed = param.trim();
          if (trimmed && !trimmed.includes(':') && !trimmed.includes('...')) {
            return `${trimmed}: any`;
          }
          return trimmed;
        }).join(', ');
        return `(${processedParams})`;
      }
      return match;
    });
  }
  
  return processed;
}

/**
 * Process Python code for consistency
 */
function processPython(
  content: string, 
  patterns: any, 
  level: string, 
  config: PlainSDKConfig
): string {
  let processed = content;
  
  // Organize imports
  const stdlibImports: string[] = [];
  const thirdPartyImports: string[] = [];
  const localImports: string[] = [];
  
  // Extract all imports
  const importRegex = /^(from|import)\s+.+$/gm;
  const imports = processed.match(importRegex) || [];
  
  // Categorize imports
  imports.forEach(imp => {
    if (imp.startsWith('from .') || imp.startsWith('from __future__')) {
      localImports.push(imp);
    } else if (imp.startsWith('from ') || imp.startsWith('import ')) {
      // Check if it's a standard library import
      const moduleName = imp.split(' ')[1].split('.')[0];
      const stdLibModules = [
        'os', 'sys', 'math', 'json', 'datetime', 'time', 're', 'collections',
        'typing', 'pathlib', 'uuid', 'random', 'functools', 'itertools'
      ];
      
      if (stdLibModules.includes(moduleName)) {
        stdlibImports.push(imp);
      } else {
        thirdPartyImports.push(imp);
      }
    }
  });
  
  // Remove all imports
  processed = processed.replace(importRegex, '');
  
  // Add imports back in groups
  const allImports = [
    ...stdlibImports.sort(),
    stdlibImports.length > 0 ? '' : '',
    ...thirdPartyImports.sort(),
    thirdPartyImports.length > 0 ? '' : '',
    ...localImports.sort()
  ].filter(Boolean).join('\n');
  
  // Only add imports back if we extracted some
  if (imports.length > 0) {
    processed = allImports + '\n\n' + processed.trimStart();
  }
  
  // Apply naming conventions based on config
  if (config.naming.methodStyle === 'snake_case') {
    // Ensure method names are snake_case
    processed = processed.replace(/def\s+([a-zA-Z0-9_]+)\(/g, (match, methodName) => {
      // Only convert camelCase to snake_case
      if (methodName.match(/[a-z][A-Z]/)) {
        const snakeCaseName = methodName.replace(/([A-Z])/g, '_$1').toLowerCase();
        return `def ${snakeCaseName}(`;
      }
      return match;
    });
  }
  
  // Ensure consistent docstring style based on patterns
  const docStyle = patterns.docPatterns?.style || 'google';
  if (level === 'strict' && docStyle === 'google') {
    // Convert reST style to Google style
    processed = processed.replace(/:param ([^:]+):\s*([^\n]+)/g, 'Args:\n        $1: $2');
    processed = processed.replace(/:return:\s*([^\n]+)/g, 'Returns:\n        $1');
    processed = processed.replace(/:raises:\s*([^\n]+)/g, 'Raises:\n        $1');
  }
  
  return processed;
}

/**
 * Process Go code for consistency
 */
function processGo(
  content: string, 
  patterns: any, 
  level: string, 
  config: PlainSDKConfig
): string {
  let processed = content;
  
  // Sort imports
  const importBlock = processed.match(/import\s*\(\s*([^)]+)\)/);
  if (importBlock) {
    const imports = importBlock[1].trim().split('\n').map(line => line.trim()).filter(Boolean);
    const sortedImports = imports.sort();
    processed = processed.replace(/import\s*\(\s*([^)]+)\)/, `import (\n\t${sortedImports.join('\n\t')}\n)`);
  }
  
  // Fix naming conventions based on config
  if (config.naming.methodStyle === 'camelCase') {
    // Ensure method names start with lowercase (for unexported methods)
    processed = processed.replace(/func\s+\([^)]+\)\s+([A-Z][a-zA-Z0-9]*)\(/g, (match, methodName) => {
      // Only convert if it's not meant to be exported
      if (!methodName.match(/^[A-Z]/)) {
        const camelCaseName = methodName.charAt(0).toLowerCase() + methodName.slice(1);
        return match.replace(methodName, camelCaseName);
      }
      return match;
    });
  }
  
  return processed;
}

/**
 * Apply common fixes across all languages
 */
function applyCommonFixes(
  content: string, 
  filePath: string, 
  language: string, 
  config: PlainSDKConfig
): string {
  let processed = content;
  
  // Fix whitespace issues
  processed = processed.replace(/\s+$/gm, ''); // Remove trailing whitespace
  processed = processed.replace(/\n{3,}/g, '\n\n'); // Replace multiple blank lines with at most one
  
  // Fix common typos in comments
  const typos: [RegExp, string][] = [
    [/(?<=\W)paramater(?=\W)/g, 'parameter'],
    [/(?<=\W)reponse(?=\W)/g, 'response'],
    [/(?<=\W)retreive(?=\W)/g, 'retrieve'],
    [/(?<=\W)reutrn(?=\W)/g, 'return'],
    [/(?<=\W)occured(?=\W)/g, 'occurred']
  ];
  
  for (const [pattern, replacement] of typos) {
    processed = processed.replace(pattern, replacement);
  }
  
  // Ensure files end with a newline
  if (!processed.endsWith('\n')) {
    processed += '\n';
  }
  
  return processed;
}