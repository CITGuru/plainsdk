import fs from 'fs/promises';
import path from 'path';
import { PlainSDKConfig } from '../../types';
import { loadOpenAPISpec } from '../../utils/loader';
import { parseSchema } from '../../utils/schema-parser';
import { formatTypescript } from '../../utils/formatter';
import { mergeWithExisting } from '../../utils/merge';
import { trackFile, cacheGeneratedContent } from '../../generator';

// Import TypeScript generators
import { generateModels } from './models';
import { generateApiClients } from './api-clients';
import { generateAuthentication } from './authentication';
import { generatePagination } from './pagination';
import { generateErrorHandling } from './error-handling';
import { generateCoreTypes } from './core-types';
import { generateBaseClient } from './base-client';
import { generateClient, generateIndex, generatePackageJson, generateTsConfig } from './client';

/**
 * Generate TypeScript SDK from OpenAPI specification
 * 
 * @param config - PlainSDK configuration
 */
export async function generateTypeScriptSDK(config: PlainSDKConfig): Promise<void> {
    console.log('Generating TypeScript SDK...');

    // Load and parse OpenAPI specification
    const sourceOpenAPI = config.basePath + '/' + config.sourceOpenAPI
    const openApiSpec = await loadOpenAPISpec(sourceOpenAPI);

    // Create output directory structure
    const outputDir = path.resolve(process.cwd(), config.outputDir, 'typescript');

    await fs.mkdir(outputDir, { recursive: true });
    await fs.mkdir(path.join(outputDir, 'src'), { recursive: true });
    await fs.mkdir(path.join(outputDir, 'src', 'models'), { recursive: true });
    await fs.mkdir(path.join(outputDir, 'src', 'api'), { recursive: true });
    await fs.mkdir(path.join(outputDir, 'src', 'core'), { recursive: true });

    // Parse schemas into models
    const schemas = openApiSpec.components?.schemas || {};
    const modelDefinitions = parseSchema(schemas, config);

    // Generate models
    console.log('Generating TypeScript models...');
    const modelFiles = await generateModels(modelDefinitions, config);

    // Generate API clients
    console.log('Generating TypeScript API clients...');
    const apiClientFiles = await generateApiClients(openApiSpec.paths || {}, config);

    // Extract resource names from API client files
    const resourceNames = Object.keys(apiClientFiles)
        .filter(file => file.startsWith('src/api/') && file.endsWith('Client.ts'))
        .map(file => {
            const filename = path.basename(file, '.ts');
            return filename.replace('Client', '');
        });

    // Generate core modules
    console.log('Generating TypeScript core modules...');
    const coreTypesContent = await generateCoreTypes(config);
    const baseClientContent = await generateBaseClient(config);

    // Generate authentication
    console.log('Generating TypeScript authentication...');
    const authFiles = await generateAuthentication(config.features?.authentication, config);

    // Generate pagination
    console.log('Generating TypeScript pagination...');
    const paginationFiles = await generatePagination(config.features?.pagination, config);

    // Generate error handling
    console.log('Generating TypeScript error handling...');
    const errorFiles = await generateErrorHandling(config.features?.errorHandling, config);

    // Generate client
    console.log('Generating TypeScript client...');
    const clientContent = await generateClient(resourceNames, config);

    // Generate index file
    console.log('Generating TypeScript index...');
    const indexContent = await generateIndex(
        Object.keys(modelDefinitions),
        resourceNames,
        config
    );

    // Generate package.json
    console.log('Generating TypeScript package.json...');
    const packageJsonContent = await generatePackageJson(config);

    // Generate tsconfig.json
    console.log('Generating TypeScript tsconfig.json...');
    const tsConfigContent = await generateTsConfig();

    // Combine all generated files
    const files: Record<string, any> = {
        ...modelFiles,
        ...apiClientFiles,
        ...authFiles,
        ...paginationFiles,
        ...errorFiles,
        'src/core/types.ts': coreTypesContent,
        'src/core/base.ts': baseClientContent,
        'src/client.ts': clientContent,
        'src/index.ts': indexContent,
        'package.json': packageJsonContent,
        'tsconfig.json': tsConfigContent,
    };

    // Core index file
    files['src/core/index.ts'] = `export * from './types';
export * from './base';
export * from './auth';
export * from './errors';
export * from './pagination';
`;

    // Check for existing files and merge changes
    for (const [filePath, content] of Object.entries(files)) {
        const fullPath = path.join(outputDir, filePath);
        const dirPath = path.dirname(fullPath);

        // Ensure directory exists
        await fs.mkdir(dirPath, { recursive: true });

        // Check if file already exists
        let finalContent = content;
        try {
            const existingContent = await fs.readFile(fullPath, 'utf-8');
            // Merge with existing content if the file already exists
            finalContent = await mergeWithExisting(existingContent, content, filePath);
        } catch (error) {
            // File doesn't exist, use generated content
        }

        // Format TypeScript files
        if (filePath.endsWith('.ts')) {
            finalContent = await formatTypescript(finalContent);
        }

        // Write file
        await fs.writeFile(fullPath, finalContent, 'utf-8');

        // Track file for future merges
        await trackFile(path.join('typescript', filePath));

        // Cache generated content
        await cacheGeneratedContent(path.join('typescript', filePath), content);
    }

    // Create README.md
    const readmeContent = `# ${config.name} TypeScript SDK

Generated with PlainSDK from OpenAPI specification.

## Installation

\`\`\`bash
npm install ${config.name}
\`\`\`

## Usage

\`\`\`typescript
import { Client } from '${config.name}';

const client = new Client({
  baseUrl: 'https://api.example.com',
  // Authentication
  apiKey: 'YOUR_API_KEY',
  // or
  bearerToken: 'YOUR_BEARER_TOKEN',
});

// Use the SDK
// For example:
const response = await client.users.getUser('123');
\`\`\`

## Documentation

For full documentation, see the [API reference](./docs/README.md).
`;

    await fs.writeFile(path.join(outputDir, 'README.md'), readmeContent, 'utf-8');

    console.log('TypeScript SDK generation complete!');
}