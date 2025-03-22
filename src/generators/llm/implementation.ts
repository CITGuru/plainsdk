import fs from 'fs/promises';
import path from 'path';
import { PlainSDKConfig, LLMConfig, Language } from '../../types';
import { loadOpenAPISpec } from '../../utils/loader';
import { mergeWithExisting } from '../../utils/merge';
import { trackFile, cacheGeneratedContent } from '../../generator';
import axios from 'axios';
import { generatePrompt } from './prompt';
import { postProcessGeneratedCode } from './post-processor';
import chalk from 'chalk';
import ora from 'ora';
import { generateReadme, generateSDKStats, validateSDKStructure } from './utils';

/**
 * Generate SDK for a specific language
 */
export async function generateSDKForLanguage(
    config: PlainSDKConfig,
    language: Language,
    llmConfig: LLMConfig,
    verbose: boolean
  ): Promise<void> {
    console.log(chalk.blue(`\nGenerating ${language} SDK...`));
    const spinner = ora(`Starting generation process`).start();
    
    try {
      // Generate SDK using LLM
      await generateSDKWithLLM(config, language, llmConfig);
      spinner.succeed(`Generated ${language} SDK code`);
      
      // Validate SDK structure
      spinner.text = 'Validating SDK structure...';
      spinner.start();
      const outputDir = path.resolve(process.cwd(), config.outputDir, language);
      const validation = await validateSDKStructure(outputDir, language);
      
      if (validation.valid) {
        spinner.succeed('SDK structure validated successfully');
      } else {
        spinner.warn('SDK structure validation found issues');
        if (verbose) {
          console.log(chalk.yellow('Missing critical files:'));
          validation.missingCriticalFiles.forEach(file => {
            console.log(chalk.yellow(`  - ${file}`));
          });
        }
      }
      
      // Generate SDK statistics
      spinner.text = 'Generating SDK statistics...';
      spinner.start();
      const stats = await generateSDKStats(outputDir, language);
      spinner.succeed('Generated SDK statistics');
      
      if (verbose) {
        console.log(chalk.blue('SDK Statistics:'));
        console.log(`  Files: ${stats.fileCount}`);
        console.log(`  Lines of Code: ${stats.totalLinesOfCode}`);
        console.log(`  API Resources: ${stats.resourceCount}`);
      }
      
      // Generate README
      spinner.text = 'Generating README...';
      spinner.start();
      const readme = generateReadme(config, language, stats);
      await fs.writeFile(path.join(outputDir, 'README.md'), readme, 'utf-8');
      spinner.succeed('Generated README for the SDK');
      
    } catch (error) {
      spinner.fail(`Failed to generate ${language} SDK: ${(error as Error).message}`);
      if (verbose && error instanceof Error) {
        console.error(error.stack);
      }
      throw error;
    }
  }



/**
 * Generate SDK using Language Model API
 * 
 * @param config - PlainSDK configuration
 * @param language - Target programming language
 * @param llmConfig - LLM configuration
 */
export async function generateSDKWithLLM(
  config: PlainSDKConfig,
  language: Language,
  llmConfig: LLMConfig
): Promise<void> {
  if (!llmConfig) {
    throw new Error("LLM configuration is missing");
  }
  
  console.log(`Generating ${language} SDK using ${llmConfig.provider}...`);

  try {
    const sourceOpenAPI = config.basePath + '/' + config.sourceOpenAPI

    // Load OpenAPI spec
    const openApiSpec = await loadOpenAPISpec(sourceOpenAPI);

    // Create output directory
    const outputDir = path.resolve(process.cwd(), config.outputDir, language);
    await fs.mkdir(outputDir, { recursive: true });

    // Create prompt for the LLM
    const prompt = await generatePrompt(config, language, openApiSpec);

    // Call LLM service to generate code
    const generatedCode = await callLLMService(prompt, llmConfig);

    // Parse the generated code into separate files
    let files = parseGeneratedCode(generatedCode, language);

    // Apply post-processing for consistency if enabled
    if (config.llm?.applyConsistencyRules !== false) {
      files = postProcessGeneratedCode(files, language, config);
    }

    // Write files to disk
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

      // Write file
      await fs.writeFile(fullPath, finalContent, 'utf-8');

      // Track file for future merges
      await trackFile(path.join(language, filePath));

      // Cache generated content
      await cacheGeneratedContent(path.join(language, filePath), content);
    }

    console.log(`${language} SDK generation complete!`);
    console.log(`Generated ${Object.keys(files).length} files in ${outputDir}`);
    
  } catch (error: any) {
    console.error(`Error generating ${language} SDK:`);
    if (error.response?.data) {
      console.error(error.response.data);
    } else {
      console.error(error);
    }
    throw error;
  }
}

/**
 * Call LLM service to generate code
 */
async function callLLMService(prompt: string, config: LLMConfig): Promise<string> {
  switch (config.provider) {
    case 'anthropic':
      return callAnthropic(prompt, config);
    case 'openai':
      return callOpenAI(prompt, config);
    case 'custom':
      return callCustomLLM(prompt, config);
    default:
      throw new Error(`Unsupported LLM provider: ${config.provider}`);
  }
}

/**
 * Call Anthropic API (Claude)
 */
async function callAnthropic(prompt: string, config: LLMConfig): Promise<string> {
  console.log(`Calling Anthropic API with model ${config.model || 'claude-3-opus-20240229'}...`);
  
  const response = await axios.post(
    config.endpoint || 'https://api.anthropic.com/v1/messages',
    {
      model: config.model || 'claude-3-opus-20240229',
      max_tokens: config.maxTokens || 100000,
      temperature: config.temperature || 0.2,
      messages: [
        { role: 'user', content: prompt }
      ]
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01'
      }
    }
  );

  return response.data.content[0].text;
}

/**
 * Call OpenAI API (GPT-4)
 */
async function callOpenAI(prompt: string, config: LLMConfig): Promise<string> {
  console.log(`Calling OpenAI API with model ${config.model || 'gpt-4'}...`);
  
  const response = await axios.post(
    config.endpoint || 'https://api.openai.com/v1/chat/completions',
    {
      model: config.model || 'gpt-4',
      max_tokens: config.maxTokens || 8192,
      temperature: config.temperature || 0.2,
      messages: [
        { role: 'system', content: 'You are an expert SDK generator that produces clean, idiomatic code.' },
        { role: 'user', content: prompt }
      ]
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      }
    }
  );

  return response.data.choices[0].message.content;
}

/**
 * Call custom LLM API
 */
async function callCustomLLM(prompt: string, config: LLMConfig): Promise<string> {
  if (!config.endpoint) {
    throw new Error('Custom LLM requires an endpoint URL');
  }

  console.log(`Calling custom LLM API at ${config.endpoint}...`);
  
  const response = await axios.post(
    config.endpoint,
    {
      prompt,
      max_tokens: config.maxTokens || 8192,
      temperature: config.temperature || 0.2
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      }
    }
  );

  return response.data.text || response.data.content || response.data.completion;
}

/**
 * Parse generated code into separate files
 */
function parseGeneratedCode(generatedCode: string, language: string): Record<string, string> {
  const files: Record<string, string> = {};

  // Regular expression to match file blocks
  // Matches patterns like: # path/to/file.ext followed by ```language code ```
  const fileBlockPattern = /#+\s*([^\n]+)\n```(?:[a-z]+)?\n([\s\S]*?)```/g;

  let match;
  while ((match = fileBlockPattern.exec(generatedCode)) !== null) {
    let [_, filePath, fileContent] = match;

    // Clean up file path
    filePath = filePath.trim();

    // Extract file content
    fileContent = fileContent.trim();

    // Add to files
    files[filePath] = fileContent;
  }

  // If no files were parsed, try to identify language-specific patterns
  if (Object.keys(files).length === 0) {
    const languagePatterns: Record<string, RegExp> = {
      typescript: /(?:\/\/\s*([a-zA-Z0-9\/_.-]+\.ts))\n([\s\S]*?)(?=\/\/\s*[a-zA-Z0-9\/_.-]+\.ts|$)/g,
      python: /(?:#\s*([a-zA-Z0-9\/_.-]+\.py))\n([\s\S]*?)(?=#\s*[a-zA-Z0-9\/_.-]+\.py|$)/g,
      java: /(?:\/\/\s*([a-zA-Z0-9\/_.-]+\.java))\n([\s\S]*?)(?=\/\/\s*[a-zA-Z0-9\/_.-]+\.java|$)/g,
      go: /(?:\/\/\s*([a-zA-Z0-9\/_.-]+\.go))\n([\s\S]*?)(?=\/\/\s*[a-zA-Z0-9\/_.-]+\.go|$)/g,
      ruby: /(?:#\s*([a-zA-Z0-9\/_.-]+\.rb))\n([\s\S]*?)(?=#\s*[a-zA-Z0-9\/_.-]+\.rb|$)/g,
    };

    const pattern = languagePatterns[language];
    if (pattern) {
      while ((match = pattern.exec(generatedCode)) !== null) {
        let [_, filePath, fileContent] = match;
        files[filePath.trim()] = fileContent.trim();
      }
    }
  }

  // If still no files were parsed, create a single file with all the code
  if (Object.keys(files).length === 0) {
    const extensions: Record<string, string> = {
      typescript: 'ts',
      python: 'py',
      java: 'java',
      ruby: 'rb',
      go: 'go',
      csharp: 'cs',
      php: 'php'
    };

    const ext = extensions[language] || 'txt';
    files[`sdk.${ext}`] = generatedCode;
  }

  return files;
}