import fs from 'fs/promises';
import path from 'path';
import { parse as parseTS } from '@typescript-eslint/typescript-estree';
import { parse as parseJS } from 'acorn';
import diff from 'diff';

/**
 * Merge newly generated content with existing content while preserving manual changes
 * 
 * @param existingContent - The existing file content
 * @param newContent - The newly generated content
 * @param filePath - Path to the file (used to determine file type)
 * @returns The merged content
 */
export async function mergeWithExisting(
  existingContent: string,
  newContent: string,
  filePath: string
): Promise<string> {
  // Get file extension
  const extension = path.extname(filePath);
  
  // Check if file is tracked for custom changes
  const isTracked = await isFileTracked(filePath);
  
  // If file is not tracked, just return the new content
  if (!isTracked) {
    return newContent;
  }
  
  // Different merge strategies based on file type
  switch (extension) {
    case '.ts':
    case '.tsx':
      return mergeTypeScript(existingContent, newContent);
    case '.js':
    case '.jsx':
      return mergeJavaScript(existingContent, newContent);
    case '.json':
      return mergeJSON(existingContent, newContent);
    case '.md':
    case '.txt':
      return mergeText(existingContent, newContent);
    default:
      // For unknown file types, use text-based merge
      return mergeText(existingContent, newContent);
  }
}

/**
 * Check if a file is being tracked for custom changes
 */
async function isFileTracked(filePath: string): Promise<boolean> {
  try {
    // Check if .plainsdk directory exists
    const plainsdkDir = path.join(process.cwd(), '.plainsdk');
    const exists = await fs.stat(plainsdkDir).then(
      () => true,
      () => false
    );
    
    if (!exists) {
      return false;
    }
    
    // Check if file is in tracking list
    const trackingFile = path.join(plainsdkDir, 'tracked-files.json');
    const trackingData = await fs.readFile(trackingFile, 'utf-8')
      .then(JSON.parse)
      .catch(() => ({ files: [] }));
    
    return trackingData.files.includes(filePath);
  } catch (error) {
    // If any error occurs, assume file is not tracked
    return false;
  }
}

/**
 * Merge TypeScript files using AST-based merging
 */
async function mergeTypeScript(
  existingContent: string,
  newContent: string
): Promise<string> {
  try {
    const existingAST = parseTS(existingContent, { 
      loc: true, 
      range: true,
      tokens: true,
      comment: true,
      jsx: true
    });
    
    const newAST = parseTS(newContent, { 
      loc: true, 
      range: true,
      tokens: true,
      comment: true,
      jsx: true
    });
    
    // Find custom modifications in the existing content
    const customModifications = findCustomModifications(existingAST, newAST);
    
    // Apply custom modifications to new content
    return applyCustomModifications(newContent, customModifications);
  } catch (error) {
    // If AST-based merging fails, fall back to text-based merging
    console.warn('AST-based merging failed, falling back to text-based merging', error);
    return mergeText(existingContent, newContent);
  }
}

/**
 * Merge JavaScript files using AST-based merging
 */
async function mergeJavaScript(
  existingContent: string,
  newContent: string
): Promise<string> {
  try {
    const existingAST = parseJS(existingContent, { 
      locations: true, 
      ranges: true,
      ecmaVersion: 'latest',
      sourceType: 'module'
    });
    
    const newAST = parseJS(newContent, { 
      locations: true, 
      ranges: true,
      ecmaVersion: 'latest',
      sourceType: 'module'
    });
    
    // Find custom modifications in the existing content
    const customModifications = findCustomModifications(existingAST, newAST);
    
    // Apply custom modifications to new content
    return applyCustomModifications(newContent, customModifications);
  } catch (error) {
    // If AST-based merging fails, fall back to text-based merging
    console.warn('AST-based merging failed, falling back to text-based merging', error);
    return mergeText(existingContent, newContent);
  }
}

/**
 * Merge JSON files
 */
async function mergeJSON(
  existingContent: string,
  newContent: string
): Promise<string> {
  try {
    const existingData = JSON.parse(existingContent);
    const newData = JSON.parse(newContent);
    
    // Deep merge objects
    const mergedData = deepMerge(newData, existingData);
    
    // Preserve formatting of existing file
    const spaces = detectJsonIndentation(existingContent);
    return JSON.stringify(mergedData, null, spaces);
  } catch (error) {
    // If JSON merging fails, fall back to text-based merging
    console.warn('JSON merging failed, falling back to text-based merging', error);
    return mergeText(existingContent, newContent);
  }
}

/**
 * Merge text files using diff/patch approach
 */
async function mergeText(
  existingContent: string,
  newContent: string
): Promise<string> {
  // Create a diff between the last generated content and new content
  // We need to get the last generated content from the tracking system
  const lastGeneratedContent = await getLastGeneratedContent(existingContent);
  
  if (!lastGeneratedContent) {
    // If we don't have last generated content, we can't merge
    return newContent;
  }
  
  // Create patches
  const patches = diff.createPatch('file', lastGeneratedContent, newContent);
  
  // Apply patches to existing content
  const mergedContent = diff.applyPatch(existingContent, patches);
  
  return mergedContent || newContent;
}

/**
 * Get the last generated content for a file
 */
async function getLastGeneratedContent(existingContent: string): Promise<string | null> {
  // Check for special comment markers that PlainSDK adds to track generated content
  const generatedStartMarker = '// @plainsdk-generated-start';
  const generatedEndMarker = '// @plainsdk-generated-end';
  
  if (existingContent.includes(generatedStartMarker) && existingContent.includes(generatedEndMarker)) {
    // Extract the original generated content
    const start = existingContent.indexOf(generatedStartMarker) + generatedStartMarker.length;
    const end = existingContent.lastIndexOf(generatedEndMarker);
    
    if (start < end) {
      return existingContent.substring(start, end).trim();
    }
  }
  
  // If we can't find markers, check the .plainsdk cache
  try {
    // Implementation would check a cache of previously generated content
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Find custom modifications between two ASTs
 * This is a placeholder for the actual implementation
 */
function findCustomModifications(existingAST: any, newAST: any): any[] {
  // Implementation would analyze the ASTs to find custom modifications
  return [];
}

/**
 * Apply custom modifications to the new content
 * This is a placeholder for the actual implementation
 */
function applyCustomModifications(newContent: string, modifications: any[]): string {
  // Implementation would apply the found modifications to the new content
  return newContent;
}

/**
 * Deep merge objects (with existing values taking precedence)
 */
function deepMerge(target: any, source: any): any {
  const output = { ...target };
  
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  
  return output;
}

/**
 * Check if value is an object
 */
function isObject(item: any): boolean {
  return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Detect JSON indentation
 */
function detectJsonIndentation(json: string): number {
  const lines = json.split('\n');
  
  if (lines.length <= 1) {
    return 2; // Default indentation
  }
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^(\s+)/);
    
    if (match) {
      return match[1].length;
    }
  }
  
  return 2; // Default indentation
}