import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Language, LLMConfig, PlainSDKConfig } from './types';
import { generateTypeScriptSDK } from './generators/typescript';
import { generatePythonSDK } from './generators/python';
import { getLLMConfig, generateSDKForLanguage, generateSDKWithLLMv1 } from './generators/llm';

const execAsync = promisify(exec);

/**
 * Generate SDKs based on configuration
 * 
 * @param config - PlainSDK configuration
 * @param language - Specific language to generate (optional)
 */
export async function generateSDK(
  config: PlainSDKConfig,
  language?: Language,
): Promise<void> {
  // Create output directory
  const outputDir = path.resolve(process.cwd(), config.outputDir);
  await fs.mkdir(outputDir, { recursive: true });

  // Run pre-generation hook if configured
  if (config.hooks?.preGenerate) {
    await runHook(config.hooks.preGenerate, config);
  }

  // Filter languages if specified
  const languages = language ? [language] : config.languages;

  const llmConfig: LLMConfig | null = getLLMConfig(config);
  const useLLM = llmConfig && llmConfig.apiKey

  // Generate SDKs for each language
  for (const lang of languages) {
    try {
      // Check if this language should use LLM
      const useLLMForThisLanguage = useLLM &&
        (!llmConfig.languages || llmConfig.languages.includes(lang));

      if (useLLMForThisLanguage && llmConfig) {
        console.log("\n Using LLM to generate SDK..... \n")
        // Use LLM-based generation
        await generateSDKWithLLMv1(config, lang, llmConfig);
      } else {

        console.log("Generating code the cracked way..... ")


        switch (lang) {
          case 'typescript':
            await generateTypeScriptSDK(config);
            break;
          case 'python':
            await generatePythonSDK(config);
            break;
          // Additional language generators will be added here
          default:
            console.warn(`Language '${lang}' is not currently supported`);
        }

      }
    } catch (error) {
      console.error(`Error generating ${lang} SDK:`, error);
      throw error;
    }
  }

  // Run post-generation hook if configured
  if (config.hooks?.postGenerate) {
    await runHook(config.hooks.postGenerate, config);
  }
}





/**
 * Run a hook script
 * 
 * @param scriptPath - Path to the hook script
 * @param config - PlainSDK configuration
 */
async function runHook(scriptPath: string, config: PlainSDKConfig): Promise<void> {
  const fullPath = path.resolve(process.cwd(), scriptPath);

  try {
    // Check if script exists
    await fs.access(fullPath);

    // Check file extension to determine how to run it
    const ext = path.extname(fullPath);

    if (ext === '.js') {
      // For JS files, require and run
      const hookModule = require(fullPath);
      if (typeof hookModule === 'function') {
        await hookModule(config);
      } else if (typeof hookModule.default === 'function') {
        await hookModule.default(config);
      } else {
        throw new Error(`Hook script at ${scriptPath} does not export a function`);
      }
    } else {
      // For other files, execute as a shell script
      const configParam = JSON.stringify(config).replace(/"/g, '\\"');
      await execAsync(`${fullPath} "${configParam}"`);
    }
  } catch (error) {
    console.error(`Error running hook script ${scriptPath}:`, error);
    throw error;
  }
}

/**
 * Get tracking information for generated files
 */
export async function getTrackedFiles(): Promise<string[]> {
  try {
    const trackingFile = path.join(process.cwd(), '.plainsdk', 'tracked-files.json');
    const content = await fs.readFile(trackingFile, 'utf-8');
    const data = JSON.parse(content);

    return data.files || [];
  } catch (error) {
    // If tracking file doesn't exist or is invalid, return empty array
    return [];
  }
}

/**
 * Add a file to tracking
 */
export async function trackFile(filePath: string): Promise<void> {
  try {
    const trackingDir = path.join(process.cwd(), '.plainsdk');
    const trackingFile = path.join(trackingDir, 'tracked-files.json');

    // Create tracking directory if it doesn't exist
    await fs.mkdir(trackingDir, { recursive: true });

    // Read existing tracking data or create new
    let data: { files: string[] };

    try {
      const content = await fs.readFile(trackingFile, 'utf-8');
      data = JSON.parse(content);
    } catch (error) {
      data = { files: [] };
    }

    // Add file if not already tracked
    if (!data.files.includes(filePath)) {
      data.files.push(filePath);
      await fs.writeFile(trackingFile, JSON.stringify(data, null, 2), 'utf-8');
    }
  } catch (error) {
    console.error('Error tracking file:', error);
  }
}

/**
 * Remove a file from tracking
 */
export async function untrackFile(filePath: string): Promise<void> {
  try {
    const trackingFile = path.join(process.cwd(), '.plainsdk', 'tracked-files.json');

    // Read existing tracking data
    const content = await fs.readFile(trackingFile, 'utf-8');
    const data = JSON.parse(content);

    // Remove file from tracking
    data.files = data.files.filter((file: string) => file !== filePath);

    // Write updated tracking data
    await fs.writeFile(trackingFile, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error untracking file:', error);
  }
}

/**
 * Cache the generated content for a file
 */
export async function cacheGeneratedContent(
  filePath: string,
  content: string
): Promise<void> {
  try {
    const cacheDir = path.join(process.cwd(), '.plainsdk', 'cache');
    await fs.mkdir(cacheDir, { recursive: true });

    // Use hash of file path as cache key
    const cacheKey = Buffer.from(filePath).toString('base64').replace(/[/+=]/g, '_');
    const cachePath = path.join(cacheDir, cacheKey);

    await fs.writeFile(cachePath, content, 'utf-8');
  } catch (error) {
    console.error('Error caching generated content:', error);
  }
}

/**
 * Get cached generated content for a file
 */
export async function getCachedContent(filePath: string): Promise<string | null> {
  try {
    const cacheDir = path.join(process.cwd(), '.plainsdk', 'cache');
    const cacheKey = Buffer.from(filePath).toString('base64').replace(/[/+=]/g, '_');
    const cachePath = path.join(cacheDir, cacheKey);

    const content = await fs.readFile(cachePath, 'utf-8');
    return content;
  } catch (error) {
    // If cache doesn't exist, return null
    return null;
  }
}