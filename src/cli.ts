import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as dotenv from 'dotenv';
import { AIService } from './AIService/AIService.js';
import { Configuration } from './Configuration.js';
import { DirectoryTraversal } from './DirectoryTraversal.js';
import { DocumentationGenerator } from './DocumentationGenerator.js';
import { GitManager } from './GitManager.js';
import { JsDocAnalyzer } from './JsDocAnalyzer.js';
import { JsDocGenerator } from './JsDocGenerator.js';
import { TypeScriptParser } from './TypeScriptParser.js';

// Get the directory of the current module to locate the .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Configure dotenv to load the .env file from the package's root directory
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const main = async () => {
  const args = process.argv.slice(2);
  const targetPath = args.find((arg) => !arg.startsWith('--'));
  const dryRun = args.includes('--dry-run');
  const excludeArg = args.find((arg) => arg.startsWith('--exclude='));
  const excludePatterns = excludeArg ? excludeArg.split('=')[1].split(',') : [];

  if (!targetPath) {
    console.error('Please provide a path to the project you want to document.');
    process.exit(1);
  }

  const absolutePath = path.resolve(targetPath);

  console.log(`Generating documentation for project at: ${absolutePath}`);
  if (dryRun) {
    console.log('--- DRY RUN MODE ---');
  }

  try {
    // 1. Setup Configuration
    const configuration = new Configuration(absolutePath, dryRun, excludePatterns);

    // 2. Initialize Services and Managers
    const aiService = new AIService(configuration);
    // const gitManager = new GitManager(configuration.repository); // No longer needed for local mode

    // 3. Setup Core Components
    const typeScriptParser = new TypeScriptParser();
    const directoryTraversal = new DirectoryTraversal(configuration);
    const jsDocGenerator = new JsDocGenerator(aiService);
    const jsDocAnalyzer = new JsDocAnalyzer(typeScriptParser);

    // 4. Instantiate the main generator
    const docGenerator = new DocumentationGenerator(
      directoryTraversal,
      typeScriptParser,
      jsDocAnalyzer,
      jsDocGenerator,
      undefined, // Pass undefined for gitManager
      configuration,
      aiService,
    );

    // 5. Run the generator
    console.log('Starting documentation generation...');
    const result = await docGenerator.generate();
    console.log(`Processing complete. Found ${result.documentedItems.length} items to document.`);

    console.log('Documentation generation completed successfully!');
  } catch (error) {
    console.error('An error occurred during documentation generation:', error);
    process.exit(1);
  }
};

main().catch((error) => {
  console.error('An unexpected error occurred:', error);
  process.exit(1);
}); 