// Configuration.ts
import fs from 'node:fs';
import path from 'node:path';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as yaml from 'yaml';
import type { Repository } from './types/index.js';

const getRepoRoot = () => {
  if (process.env.GITHUB_WORKSPACE) {
    return process.env.GITHUB_WORKSPACE;
  }
  // Fallback for local testing
  return process.cwd();
};

/**
 * Interface representing configuration data for a project.
 * @interface ConfigurationData
 * @property {Object} rootDirectory - Information about the root directory.
 * @property {string} rootDirectory.absolute - Full path from the filesystem root.
 * @property {string} rootDirectory.relative - Path relative to the repository root.
 * @property {string[]} excludedDirectories - An array of directories to be excluded.
 * @property {Repository} repository - Information about the repository.
 * @property {string} commitMessage - The message to use for commits.
 * @property {string} pullRequestTitle - Title for pull requests.
 * @property {string} pullRequestDescription - Description for pull requests.
 * @property {string[]} pullRequestLabels - Labels to assign to pull requests.
 * @property {string[]} pullRequestReviewers - Users to request reviews from for pull requests.
 * @property {string[]} excludedFiles - An array of files to be excluded.
 * @property {boolean} generateJsDoc - Flag indicating if JSDoc should be generated.
 * @property {boolean} generateReadme - Flag indicating if a README file should be generated.
 */
interface ConfigurationData {
  rootDirectory: {
    absolute: string; // Full path from filesystem root
    relative: string; // Path relative to repository root
  };
  excludedDirectories: string[];
  repository: Repository;
  commitMessage: string;
  pullRequestTitle: string;
  pullRequestDescription: string;
  pullRequestLabels: string[];
  pullRequestReviewers: string[];
  excludedFiles: string[];
  generateJsDoc: boolean;
  generateReadme: boolean;
}

/**
 * Represents a configuration object that holds various settings for a project.
 * Handles both absolute and relative paths for different operations.
 */
/**
 * Represents the configuration settings for JSDoc generation.
 * @class Configuration
 */

export class Configuration implements Omit<ConfigurationData, 'rootDirectory'> {
  private _rootDirectory!: ConfigurationData['rootDirectory'];
  private readonly repoRoot: string;
  private _branch = 'develop';
  private _generateJsDoc = true;
  private _generateReadme = false;

  public useGit = true;

  public excludedDirectories: string[] = [];
  public repository: Repository = {
    owner: '',
    name: '',
    pullNumber: undefined,
  };
  public commitMessage = 'Generated JSDoc comments';
  public pullRequestTitle = 'JSDoc Generation';
  public pullRequestDescription = 'Automated JSDoc generation for the codebase';
  public pullRequestLabels: string[] = ['documentation', 'automated-pr'];
  public pullRequestReviewers: string[] = [];
  public excludedFiles: string[] = ['index.d.ts'];

  constructor() {
    this.repoRoot = getRepoRoot();
    this.loadConfiguration();
  }

  get generateJsDoc(): boolean {
    return this._generateJsDoc;
  }

  get generateReadme(): boolean {
    return this._generateReadme;
  }

  get rootDirectory(): ConfigurationData['rootDirectory'] {
    return this._rootDirectory;
  }

  get absolutePath(): string {
    return this._rootDirectory.absolute;
  }

  get relativePath(): string {
    return this._rootDirectory.relative;
  }

  public toRelativePath(absolutePath: string): string {
    return path.relative(this.repoRoot, absolutePath);
  }

  public toAbsolutePath(relativePath: string): string {
    return path.resolve(this.repoRoot, relativePath);
  }

  get branch(): string {
    return this._branch;
  }

  set branch(value: string) {
    this._branch = value;
  }

  private loadConfiguration(): void {
    // First try to get from environment variables
    const rootDirectory = process.env.INPUT_ROOT_DIRECTORY;
    this._generateJsDoc = process.env.INPUT_JSDOC
      ? process.env.INPUT_JSDOC.toUpperCase() === 'T'
      : true; // Default from workflow
    this._generateReadme = process.env.INPUT_README
      ? process.env.INPUT_README.toUpperCase() === 'T'
      : true; // Default from workflow

    console.log('Documentation flags:', {
      generateJsDoc: this._generateJsDoc,
      generateReadme: this._generateReadme,
    });

    let _inputs;

    console.log('Environment variables:', {
      rootDirectory: process.env.INPUT_ROOT_DIRECTORY,
      pullNumber: process.env.INPUT_PULL_NUMBER,
      excludedDirs: process.env.INPUT_EXCLUDED_DIRECTORIES,
      reviewers: process.env.INPUT_REVIEWERS,
    });

    if (rootDirectory) {
      console.log('Using root directory from environment variable:', rootDirectory);
      this._rootDirectory = {
        absolute: path.resolve(this.repoRoot, rootDirectory),
        relative: rootDirectory.replace(/^\/+/, ''),
      };
    } else {
      console.log('Falling back to workflow file configuration');
      const workflowPath = join(this.repoRoot, '.github/workflows/jsdoc-automation.yml');
      if (!fs.existsSync(workflowPath)) {
        throw new Error(`Workflow file not found at ${workflowPath}`);
      }
      const workflowContent = fs.readFileSync(workflowPath, 'utf8');
      const workflow = yaml.parse(workflowContent);
      const inputs = workflow.on.workflow_dispatch.inputs;

      if (!inputs?.root_directory?.default) {
        throw new Error('No root directory default found in workflow configuration');
      }

      const targetDir = inputs.root_directory.default;
      console.log('Using default root directory from workflow:', targetDir);
      this._rootDirectory = {
        absolute: path.resolve(this.repoRoot, targetDir),
        relative: targetDir.replace(/^\/+/, ''),
      };
    }

    console.log('Final root directory configuration:', {
      absolute: this._rootDirectory.absolute,
      relative: this._rootDirectory.relative,
    });

    // Handle other inputs
    if (process.env.GITHUB_REPOSITORY) {
      const [owner, name] = process.env.GITHUB_REPOSITORY.split('/');
      this.repository.owner = owner;
      this.repository.name = name;
      console.log(`Repository detected: ${owner}/${name}`);
    } else {
      console.warn(
        'GITHUB_REPOSITORY env var not set. Using default repository.',
      );
      // Fallback to a default or handle as an error if needed
      this.repository.owner = 'nydiokar';
      this.repository.name = 'sova';
    }
    if (process.env.INPUT_PULL_NUMBER) {
      console.log('Setting pull number from env:', process.env.INPUT_PULL_NUMBER);
      this.repository.pullNumber = Number.parseInt(process.env.INPUT_PULL_NUMBER);
    }

    this.excludedDirectories = this.parseCommaSeparatedInput(
      process.env.INPUT_EXCLUDED_DIRECTORIES,
      ['node_modules', 'dist', 'test']
    );

    this.pullRequestReviewers = this.parseCommaSeparatedInput(process.env.INPUT_REVIEWERS, []);

    this._branch = process.env.INPUT_BRANCH || 'develop';
    console.log('Using branch:', this._branch);
  }

  private parseCommaSeparatedInput(input: string | undefined, defaultValue: string[]): string[] {
    if (!input) return defaultValue;
    return input
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
}
