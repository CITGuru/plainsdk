#!/usr/bin/env node

/**
 * PlainSDK CLI
 * Command-line interface for PlainSDK
 */

const { program } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const path = require('path');
const fs = require('fs');
const {
  initializeConfig,
  validateConfig,
  generateSDK,
  checkSourceOpenAPI
} = require('../../dist');

const dotenv = require("dotenv")
dotenv.config()

// Set up the CLI program
program
  .name('plainsdk')
  .description('Generate idiomatic SDKs from OpenAPI specifications')
  .version(require('../../package.json').version);

// Init command
program
  .command('init')
  .description('Initialize a new PlainSDK configuration')
  .option('-o, --output <path>', 'output directory for the config file', '.')
  .option('-s, --spec <path>', 'path to OpenAPI specification')
  .action(async (options) => {
    const spinner = ora('Initializing PlainSDK configuration').start();
    try {
      const outputPath = path.resolve(process.cwd(), options.output);
      const configPath = path.join(outputPath, 'plainsdk.config.js');

      if (fs.existsSync(configPath)) {
        spinner.fail(`Configuration already exists at ${configPath}`);
        return;
      }

      await initializeConfig(options.spec, outputPath);
      spinner.succeed(`PlainSDK configuration created at ${configPath}`);
      console.log(chalk.green('\nNext steps:'));
      console.log('1. Edit the configuration to customize your SDK');
      console.log('2. Run ' + chalk.cyan('plainsdk generate') + ' to generate your SDK');
    } catch (error) {
      spinner.fail('Failed to initialize configuration');
      console.error(chalk.red(error.message));
    }
  });

// Generate command
program
  .command('generate')
  .description('Generate SDKs based on configuration')
  .option('-c, --config <path>', 'path to PlainSDK configuration', './plainsdk.config.js')
  .option('-l, --language <language>', 'specific language to generate (optional)')
  .option('--llm', 'use LLM to generate the SDK')
  .option('--llm-provider <provider>', 'LLM provider (openai, anthropic, custom)')
  .option('--llm-key <apiKey>', 'API key for LLM service')
  .option('--llm-model <model>', 'model name for LLM')
  .option('--consistency <level>', 'Consistency level (strict, balanced, flexible)')
  .option('--no-examples', 'Disable example code in prompts')
  .option('--no-post-processing', 'Disable post-processing for consistency')
  .option('--verbose', 'Enable verbose output')
  .action(async (options) => {
    const spinner = ora('Validating configuration').start();
    try {
      const configPath = path.resolve(process.cwd(), options.config);

      if (!fs.existsSync(configPath)) {
        spinner.fail(`Configuration not found at ${configPath}`);
        console.log(`Create a configuration with ${chalk.cyan('plainsdk init')}`);
        return;
      }

      // Load configuration
      const configModule = require(configPath);
      const paths = configPath.split("/")
      const basePath = paths.slice(0, paths.length - 1).join("/")
      const config = configModule.default || configModule;

      config.basePath = basePath

      // Validate configuration
      const validationResult = validateConfig(config);
      if (!validationResult.valid) {
        spinner.fail('Configuration validation failed');
        console.error(chalk.red(validationResult.errors.join('\n')));
        return;
      }

      spinner.succeed('Configuration validated');


      // LLM configuration if given
      if (options.llm) {
        config.llm = config.llm || {};
        config.llm.useForGeneration = true;

        if (options.llmProvider) {
          config.llm.provider = options.llmProvider;
        }

        if (options.llmKey) {
          config.llm.apiKey = options.llmKey;
        }

        if (options.llmModel) {
          config.llm.model = options.llmModel;
        }

        // If API key is not provided via options or config, try environment variable
        if (!config.llm.apiKey) {
          const envVar = config.llm.provider === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY';
          config.llm.apiKey = process.env[envVar];

          if (!config.llm.apiKey) {
            spinner.fail(`No API key provided for ${config.llm.provider || 'LLM'}`);
            console.log(`Please provide an API key using --llm-key or set the ${envVar} environment variable`);
            return;
          }
        }


      if (options.consistency) config.llm.consistencyLevel = options.consistency;
      if (options.examples === false) config.llm.includeExamples = false;
      if (options.postProcessing === false) config.llm.applyConsistencyRules = false;

      }

      // Filter languages if specified
      if (options.language) {
        if (!config.languages.includes(options.language)) {
          console.error(chalk.red(`Language '${options.language}' not found in configuration`));
          return;
        }
        config.languages = [options.language];
      }

      // Generate SDKs for each language
      for (const language of config.languages) {
        const genSpinner = ora(`Generating ${language} SDK \n`).start();
        try {
          await generateSDK(config, language);
          genSpinner.succeed(`${language} SDK generated successfully  \n`);
        } catch (error) {
          genSpinner.fail(`Failed to generate ${language} SDK  \n`);
          console.error(chalk.red(error.message));
        }
      }

      console.log(chalk.green('\nSDK generation complete!'));
      console.log(`Output directory: ${chalk.cyan(path.resolve(process.cwd(), config.outputDir))}`);
    } catch (error) {
      spinner.fail('Generation failed');
      console.error(chalk.red(error.message));
    }
  });

// Validate command
program
  .command('validate')
  .description('Validate OpenAPI specification')
  .option('-s, --spec <path>', 'path to OpenAPI specification')
  .action(async (options) => {
    const spinner = ora('Validating OpenAPI specification').start();
    try {
      if (!options.spec) {
        spinner.fail('Please provide a path to an OpenAPI specification');
        console.log(`Example: ${chalk.cyan('plainsdk validate -s ./openapi.yaml')}`);
        return;
      }

      const specPath = path.resolve(process.cwd(), options.spec);

      if (!await checkSourceOpenAPI(options.spec)) {
        spinner.fail(`OpenAPI specification not found at ${specPath}`);
        return;
      }

      spinner.succeed('OpenAPI specification is valid');
    } catch (error) {
      spinner.fail('Validation failed');
      console.error(chalk.red(error.message));
    }
  });

// Parse command-line arguments
program.parse();