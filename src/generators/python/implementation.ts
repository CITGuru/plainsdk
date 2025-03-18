import fs from 'fs/promises';
import path from 'path';
import { PlainSDKConfig } from '../../types';
import { loadOpenAPISpec } from '../../utils/loader';
import { parseSchema } from '../../utils/schema-parser';
import { formatPython } from '../../utils/formatter';
import { mergeWithExisting } from '../../utils/merge';
import { trackFile, cacheGeneratedContent } from '../../generator';
import { getPackageName } from './client';

// Import Python generators
import { generatePythonModels } from './models';
import { generatePythonApiClients } from './api-clients';
import { generatePythonAuthentication } from './authentication';
import { generatePythonPagination } from './pagination';
import { generatePythonClient, generatePythonSetupPy, generatePythonInitFiles } from './client';

/**
 * Generate Python SDK from OpenAPI specification
 * 
 * @param config - PlainSDK configuration
 */
export async function generatePythonSDK(config: PlainSDKConfig): Promise<void> {
  console.log('Generating Python SDK...');
  
  // Load and parse OpenAPI specification
  const sourceOpenAPI = config.basePath + '/' +config.sourceOpenAPI
  const openApiSpec = await loadOpenAPISpec(sourceOpenAPI);
  
  // Create output directory structure
  const packageName = getPackageName(config.name);
  const outputDir = path.resolve(process.cwd(), config.outputDir, 'python');
  
  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(path.join(outputDir, packageName), { recursive: true });
  await fs.mkdir(path.join(outputDir, packageName, 'models'), { recursive: true });
  await fs.mkdir(path.join(outputDir, packageName, 'api'), { recursive: true });
  await fs.mkdir(path.join(outputDir, packageName, 'core'), { recursive: true });
  
  // Parse schemas into models
  const schemas = openApiSpec.components?.schemas || {};
  const modelDefinitions = parseSchema(schemas, config);
  
  // Generate models
  console.log('Generating Python models...');
  const modelFiles = await generatePythonModels(modelDefinitions, packageName, config);
  
  // Generate API clients
  console.log('Generating Python API clients...');
  const apiClientFiles = await generatePythonApiClients(openApiSpec.paths || {}, packageName, config);
  
  // Generate authentication
  console.log('Generating Python authentication...');
  const authFiles = await generatePythonAuthentication(config.features?.authentication, packageName, config);
  
  // Generate pagination
  console.log('Generating Python pagination...');
  const paginationFiles = await generatePythonPagination(config.features?.pagination, packageName, config);
  
  // Generate client
  console.log('Generating Python client...');
  const clientContent = await generatePythonClient(packageName, config);
  
  // Generate __init__.py files
  console.log('Generating Python __init__.py files...');
  const initFiles = await generatePythonInitFiles(modelDefinitions, packageName, config);
  
  // Generate setup.py
  console.log('Generating Python setup.py...');
  const setupPyContent = await generatePythonSetupPy(packageName, config);
  
  // Combine all generated files
  const files = {
    ...modelFiles,
    ...apiClientFiles,
    ...authFiles,
    ...paginationFiles,
    ...initFiles,
    [`${packageName}/client.py`]: clientContent,
    'setup.py': setupPyContent,
  };
  
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
    
    // Format Python files
    if (filePath.endsWith('.py')) {
      finalContent = await formatPython(finalContent);
    }
    
    // Write file
    await fs.writeFile(fullPath, finalContent, 'utf-8');
    
    // Track file for future merges
    await trackFile(path.join('python', filePath));
    
    // Cache generated content
    await cacheGeneratedContent(path.join('python', filePath), content);
  }
  
  // Create README.md
  const readmeContent = `# ${config.name} Python SDK

Generated with PlainSDK from OpenAPI specification.

## Installation

\`\`\`bash
pip install ${packageName}
\`\`\`

## Usage

\`\`\`python
from ${packageName} import Client

client = Client(
    base_url="https://api.example.com",
    # Authentication
    api_key="YOUR_API_KEY",
    # or
    token="YOUR_BEARER_TOKEN",
)

# Use the SDK
# For example:
response = client.users.get_user("123")
\`\`\`

## Documentation

For full documentation, see the [API reference](./docs/README.md).
`;
  
  await fs.writeFile(path.join(outputDir, 'README.md'), readmeContent, 'utf-8');
  
  console.log('Python SDK generation complete!');
}