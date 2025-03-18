import { PlainSDKConfig } from '../../types';
import { formatResourceName } from '../../utils/formatter';

/**
 * Generate the main TypeScript client class
 * 
 * @param resourceNames - Names of API resources
 * @param config - PlainSDK configuration
 * @returns Generated client content
 */
export async function generateClient(
  resourceNames: string[],
  config: PlainSDKConfig
): Promise<string> {
  // Format resource names according to configured style
  const formattedResources = resourceNames.map(name => 
    formatResourceName(name, config.naming.resourceStyle)
  );
  
  // Generate imports for resource clients
  const imports = formattedResources.map(name => 
    `import { ${name}Client } from './api/${name}Client';`
  ).join('\n');
  
  // Generate property declarations for resource clients
  const properties = formattedResources.map(name => {
    const instanceName = name.charAt(0).toLowerCase() + name.slice(1);
    return `  /**\n   * ${name} API client\n   */\n  public readonly ${instanceName}: ${name}Client;`;
  }).join('\n\n');
  
  // Generate initializations for resource clients
  const initializations = formattedResources.map(name => {
    const instanceName = name.charAt(0).toLowerCase() + name.slice(1);
    return `    this.${instanceName} = new ${name}Client(this.configuration);`;
  }).join('\n');
  
  // Generate client class
  return `import { Configuration, BaseAPI } from './core';
${imports}

/**
 * Client for the ${config.name} API
 */
export class Client extends BaseAPI {
${properties}

  /**
   * Create a new API client
   * @param {Configuration} [configuration] - Client configuration
   */
  constructor(configuration?: Partial<Configuration>) {
    super(configuration);
    
${initializations}
  }
}
`;
}

/**
 * Generate the TypeScript package entry point (index.ts)
 * 
 * @param modelNames - Names of models
 * @param resourceNames - Names of API resources
 * @param config - PlainSDK configuration
 * @returns Generated index content
 */
export async function generateIndex(
  modelNames: string[],
  resourceNames: string[],
  config: PlainSDKConfig
): Promise<string> {
  // Format model names according to configured style
  const formattedModels = modelNames;
  
  // Format resource names according to configured style
  const formattedResources = resourceNames.map(name => 
    formatResourceName(name, config.naming.resourceStyle)
  );
  
  return `/**
 * ${config.name}
 * ${config.description || ''}
 */

// Export core types
export * from './core';

// Export models
export * from './models';

// Export API clients
export * from './api';

// Export main client
export * from './client';

// Version
export const VERSION = '${config.version}';
`;
}

/**
 * Generate TypeScript package.json file
 * 
 * @param config - PlainSDK configuration
 * @returns Generated package.json content
 */
export async function generatePackageJson(
  config: PlainSDKConfig
): Promise<string> {
  const packageJson = {
    name: config.name,
    version: config.version,
    description: config.description || `TypeScript SDK for ${config.name}`,
    main: 'dist/index.js',
    types: 'dist/index.d.ts',
    scripts: {
      build: 'tsc',
      prepare: 'npm run build',
      test: 'jest',
      lint: 'eslint src --ext .ts',
      format: 'prettier --write "src/**/*.ts"'
    },
    dependencies: {
      axios: '^0.27.2'
    },
    devDependencies: {
      '@types/jest': '^28.1.6',
      '@types/node': '^18.6.3',
      '@typescript-eslint/eslint-plugin': '^5.32.0',
      '@typescript-eslint/parser': '^5.32.0',
      'eslint': '^8.21.0',
      'jest': '^28.1.3',
      'prettier': '^2.7.1',
      'ts-jest': '^28.0.7',
      'typescript': '^4.7.4'
    },
    files: [
      'dist',
      'src',
      'LICENSE',
      'README.md'
    ],
    keywords: [
      'api',
      'sdk',
      'typescript'
    ],
    license: 'MIT'
  };
  
  return JSON.stringify(packageJson, null, 2);
}

/**
 * Generate TypeScript configuration file (tsconfig.json)
 * 
 * @returns Generated tsconfig.json content
 */
export async function generateTsConfig(): Promise<string> {
  const tsConfig = {
    compilerOptions: {
      target: 'es2017',
      module: 'commonjs',
      declaration: true,
      outDir: './dist',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true
    },
    include: [
      'src/**/*'
    ],
    exclude: [
      'node_modules',
      'dist',
      '**/*.test.ts'
    ]
  };
  
  return JSON.stringify(tsConfig, null, 2);
}


