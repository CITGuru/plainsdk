import fs from 'fs/promises';
import path from 'path';
import { PlainSDKConfig } from '../../types';

/**
 * Expected file structure based on language
 */
const EXPECTED_FILES: Record<string, string[]> = {
  typescript: [
    'index.ts',
    'client.ts',
    'core/base.ts',
    'core/config.ts',
    'core/auth.ts',
    'core/error.ts',
    'models/index.ts',
  ],
  python: [
    '__init__.py',
    'client.py',
    'core/__init__.py',
    'core/base.py',
    'core/config.py',
    'core/auth.py',
    'core/error.py',
    'models/__init__.py',
  ],
  go: [
    'client.go',
    'config.go',
    'auth.go',
    'error.go',
    'models.go',
  ],
};

/**
 * Validate SDK structure after generation
 * 
 * @param outputDir - Directory containing the generated SDK
 * @param language - Target programming language
 * @returns Validation result with missing critical files
 */
export async function validateSDKStructure(
  outputDir: string,
  language: string
): Promise<{ valid: boolean; missingCriticalFiles: string[] }> {
  const expectedFiles = EXPECTED_FILES[language] || [];
  const missingCriticalFiles: string[] = [];
  
  for (const expectedFile of expectedFiles) {
    try {
      const filePath = path.join(outputDir, expectedFile);
      await fs.access(filePath);
    } catch (error) {
      missingCriticalFiles.push(expectedFile);
    }
  }
  
  return { 
    valid: missingCriticalFiles.length === 0, 
    missingCriticalFiles 
  };
}

/**
 * Create statistics about the generated SDK
 * 
 * @param outputDir - Directory containing the generated SDK
 * @param language - Target programming language
 * @returns Statistics about the generated SDK
 */
export async function generateSDKStats(
  outputDir: string,
  language: string
): Promise<{ fileCount: number; totalLinesOfCode: number; resourceCount: number }> {
  const stats = {
    fileCount: 0,
    totalLinesOfCode: 0,
    resourceCount: 0,
  };
  
  // Helper function to recursively scan directories
  async function scanDirectory(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        await scanDirectory(fullPath);
      } else {
        // Only count files with appropriate extensions
        const extension = path.extname(entry.name);
        if (
          (language === 'typescript' && extension === '.ts') ||
          (language === 'python' && extension === '.py') ||
          (language === 'go' && extension === '.go') ||
          (language === 'java' && extension === '.java') ||
          (language === 'ruby' && extension === '.rb')
        ) {
          stats.fileCount++;
          
          // Count lines of code
          const content = await fs.readFile(fullPath, 'utf-8');
          const lines = content.split('\n').filter(line => line.trim() !== '');
          stats.totalLinesOfCode += lines.length;
          
          // Try to identify resource files
          const fileName = path.basename(entry.name, extension);
          if (
            !fileName.includes('base') && 
            !fileName.includes('api') && 
            !fileName.includes('core') && 
            !fileName.includes('auth') && 
            !fileName.includes('config') && 
            !fileName.includes('error') && 
            !fileName.includes('index') && 
            !fileName.includes('utils') && 
            !fileName.includes('client') &&
            !fileName.includes('model') &&
            !fileName.startsWith('_')
          ) {
            stats.resourceCount++;
          }
        }
      }
    }
  }
  
  await scanDirectory(outputDir);
  
  return stats;
}

/**
 * Generate a README for the SDK
 * 
 * @param config - PlainSDK configuration 
 * @param language - Target programming language
 * @param stats - SDK statistics
 * @returns README content
 */
export function generateReadme(
  config: PlainSDKConfig,
  language: string,
  stats: { fileCount: number; totalLinesOfCode: number; resourceCount: number }
): string {
  const languageMap: Record<string, { extension: string; installCmd: string; importExample: string }> = {
    typescript: {
      extension: 'ts',
      installCmd: `npm install ${config.name}`,
      importExample: `import { Client } from '${config.name}';`
    },
    python: {
      extension: 'py',
      installCmd: `pip install ${config.name}`,
      importExample: `from ${config.name.replace(/-/g, '_')} import Client`
    },
    go: {
      extension: 'go',
      installCmd: `go get ${config.name}`,
      importExample: `import "${config.name}"`
    }
  };
  
  const langInfo = languageMap[language] || { extension: '', installCmd: '', importExample: '' };
  
  return `# ${config.name} - ${language.charAt(0).toUpperCase() + language.slice(1)} SDK

${config.description || 'SDK for interacting with the API'}

## Installation

\`\`\`
${langInfo.installCmd}
\`\`\`

## Usage

\`\`\`${language}
${langInfo.importExample}

// Initialize the client
const client = new Client({
  apiKey: 'YOUR_API_KEY',
  // Additional configuration options
});

// Make API calls
// Example usage will depend on your specific API
\`\`\`

## Features

${config.features.authentication ? `- **Authentication**: Supports ${config.features.authentication.types.join(', ')} authentication\n` : ''}
${config.features.pagination ? `- **Pagination**: Supports ${config.features.pagination.style} pagination\n` : ''}
${config.features.errorHandling ? `- **Error Handling**: ${config.features.errorHandling.strategies.join(', ')} error handling strategies\n` : ''}
${config.features.retries ? `- **Retry Mechanism**: Automatic retries with configurable backoff\n` : ''}

## SDK Statistics

- Files: ${stats.fileCount}
- Total Lines of Code: ${stats.totalLinesOfCode}
- API Resources: ${stats.resourceCount}

## License

This SDK is licensed under the terms provided with your API access.

---

Generated with [PlainSDK](https://github.com/yourusername/plainsdk).
`;
}