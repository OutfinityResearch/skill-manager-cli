#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';
import { RecursiveSkilledAgent } from 'achillesAgentLib/RecursiveSkilledAgents';
import { LLMAgent } from 'achillesAgentLib/LLMAgents';
import { HistoryManager } from './repl/HistoryManager.mjs';
import { CommandSelector, showCommandSelector, showSkillSelector, buildCommandList } from './ui/CommandSelector.mjs';
import { SlashCommandHandler } from './repl/SlashCommandHandler.mjs';
import { REPLSession } from './repl/REPLSession.mjs';
import { summarizeResult, formatSlashResult } from './ui/ResultFormatter.mjs';
import { printHelp as printREPLHelp, showHistory, searchHistory } from './ui/HelpPrinter.mjs';
import { RepoManager } from './lib/RepoManager.mjs';
import { UIContext } from './ui/UIContext.mjs';
import { createProvider, getProviderNames } from './ui/providers/index.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to built-in skills bundled with this module
const builtInSkillsDir = path.join(__dirname, '.AchillesSkills');

// Path to bash command skills (bundled with this repo)
const bashSkillsDir = path.join(__dirname, '../../bash-skills/.AchillesSkills');

// Re-export classes and functions for library usage
export {
    // Core agent (from achillesAgentLib)
    RecursiveSkilledAgent,
    LLMAgent,
    // REPL components
    REPLSession,
    SlashCommandHandler,
    // UI components
    CommandSelector,
    showCommandSelector,
    showSkillSelector,
    buildCommandList,
    // History
    HistoryManager,
    // Repository management
    RepoManager,
    // Utilities
    summarizeResult,
    formatSlashResult,
    printREPLHelp,
    showHistory,
    searchHistory,
    // Constants
    builtInSkillsDir,
};

// CLI entry point when run directly
async function main() {
    const args = process.argv.slice(2);

    // Parse options
    let workingDir = process.cwd();
    let prompt = null;
    let verbose = false;
    let debug = false;
    let mode = 'deep';
    let renderMarkdown = true;
    let uiStyle = process.env.SKILL_MANAGER_UI || 'claude-code'; // Default UI style
    const cliSkillRoots = []; // Skill roots from --skill-root flags

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--dir' || arg === '-d') {
            workingDir = path.resolve(args[i + 1] || process.cwd());
            i += 1;
        } else if (arg === '--skill-root' || arg === '-r') {
            const rootPath = args[i + 1];
            if (rootPath && !rootPath.startsWith('-')) {
                cliSkillRoots.push(path.resolve(rootPath));
                i += 1;
            }
        } else if (arg.startsWith('--skill-root=')) {
            const rootPath = arg.split('=')[1];
            if (rootPath) {
                cliSkillRoots.push(path.resolve(rootPath));
            }
        } else if (arg === '--help' || arg === '-h') {
            printHelp();
            process.exit(0);
        } else if (arg === '--verbose' || arg === '-v') {
            verbose = true;
        } else if (arg === '--debug') {
            debug = true;
        } else if (arg === '--fast') {
            mode = 'fast';
        } else if (arg === '--deep') {
            mode = 'deep';
        } else if (arg === '--no-markdown' || arg === '--raw') {
            renderMarkdown = false;
        } else if (arg === '--ui-minimal') {
            uiStyle = 'minimal';
        } else if (arg === '--ui-claude-code') {
            uiStyle = 'claude-code';
        } else if (arg === '--ui' || arg === '--ui-style') {
            uiStyle = args[i + 1] || 'claude-code';
            i += 1;
        } else if (arg.startsWith('--ui=') || arg.startsWith('--ui-style=')) {
            uiStyle = arg.split('=')[1] || 'claude-code';
        } else if (arg === '--version') {
            console.log('skill-manager v3.0.0');
            process.exit(0);
        } else if (!arg.startsWith('-')) {
            // Collect remaining args as the prompt
            prompt = args.slice(i).join(' ');
            break;
        }
    }

    // Configure logger based on verbose flag
    const logger = {
        log: verbose ? (msg) => console.log(`[LOG] ${msg}`) : () => {},
        warn: (msg) => console.warn(`[WARN] ${msg}`),
        error: (msg) => console.error(`[ERROR] ${msg}`),
    };

    // Ensure user's .AchillesSkills directory exists
    const skillsDir = path.join(workingDir, '.AchillesSkills');
    if (!fs.existsSync(skillsDir)) {
        fs.mkdirSync(skillsDir, { recursive: true });
        logger.log?.(`Created .AchillesSkills directory at ${skillsDir}`);
    }

    // Initialize RepoManager for external skill repositories
    const globalReposDir = path.join(os.homedir(), '.skill-manager', 'repos');
    const repoManager = new RepoManager({ workingDir, globalReposDir, logger });
    const configSkillRoots = repoManager.getEnabledSkillRoots();

    // Merge all skill roots: built-in + bash-skills + CLI flags + config file repos
    const allSkillRoots = [
        builtInSkillsDir,
        // Add bash-skills if the directory exists
        ...(fs.existsSync(bashSkillsDir) ? [bashSkillsDir] : []),
        ...cliSkillRoots,
        ...configSkillRoots,
    ];

    if (verbose && (cliSkillRoots.length > 0 || configSkillRoots.length > 0)) {
        logger.log(`Additional skill roots: ${[...cliSkillRoots, ...configSkillRoots].join(', ')}`);
    }

    // Initialize LLM Agent
    const llmAgent = new LLMAgent({
        name: 'skill-manager-agent',
    });

    // Initialize RecursiveSkilledAgent with all skill roots
    const agent = new RecursiveSkilledAgent({
        llmAgent,
        startDir: workingDir,
        additionalSkillRoots: allSkillRoots,
        logger,
    });

    // Attach repoManager to agent so skills can access it for editability checks
    agent.repoManager = repoManager;

    // Initialize UI provider based on selected style
    try {
        const uiProvider = createProvider(uiStyle);
        UIContext.setProvider(uiProvider);
        if (verbose) {
            logger.log(`UI style: ${uiStyle}`);
        }
    } catch (error) {
        console.error(`Error: Invalid UI style '${uiStyle}'. Available: ${getProviderNames().join(', ')}`);
        process.exit(1);
    }

    if (prompt) {
        // Single-shot mode: execute prompt and exit
        try {
            if (verbose) {
                console.log(`Processing: "${prompt}"\n`);
            }
            // Create context for skill execution
            const context = {
                workingDir,
                skillsDir,
                skilledAgent: agent,
                llmAgent,
                logger,
                repoManager,
            };

            let result = await agent.executePrompt(prompt, {
                skillName: 'skills-orchestrator',
                context,
                mode,
            });

            // Format result
            if (typeof result === 'string') {
                try {
                    const parsed = JSON.parse(result);
                    if (parsed && (parsed.executions || parsed.type === 'orchestrator')) {
                        result = debug ? JSON.stringify(parsed, null, 2) : summarizeResult(parsed);
                    }
                } catch {
                    // Not JSON, use as-is
                }
            } else if (!debug) {
                result = summarizeResult(result);
            } else {
                result = JSON.stringify(result, null, 2);
            }

            console.log(result);
        } catch (error) {
            console.error('Error:', error.message);
            if (verbose) {
                console.error(error.stack);
            }
            process.exit(1);
        }
    } else {
        // REPL mode - first await any pending skill preparations
        if (agent.pendingPreparations && agent.pendingPreparations.length > 0) {
            const count = agent.pendingPreparations.length;
            if (verbose) {
                console.log(`Waiting for ${count} skill preparation(s) to complete...`);
            }
            await Promise.all(agent.pendingPreparations);
            agent.pendingPreparations.length = 0; // Clear the array
        }

        const session = new REPLSession(agent, {
            workingDir,
            skillsDir,
            builtInSkillsDir,
            debug,
            renderMarkdown,
            repoManager,
        });
        await session.start();
    }
}

function printHelp() {
    console.log(`
╔══════════════════════════════════════════════════════════════════════╗
║                    Skill Manager Agent CLI v3.0                       ║
║        Manage, generate, and test skill definition files              ║
╚══════════════════════════════════════════════════════════════════════╝

USAGE:
  skill-manager [options] [prompt]

OPTIONS:
  -d, --dir <path>       Working directory containing .AchillesSkills (default: cwd)
  -r, --skill-root <path>  Add additional skill root (can be used multiple times)
  -v, --verbose          Enable verbose logging
  --debug                Show full JSON output (orchestrator plans, executions)
  --fast                 Use fast LLM mode (cheaper, quicker)
  --deep                 Use deep LLM mode (default, more capable)
  --no-markdown          Disable markdown rendering in output (use /raw to toggle)
  --ui <style>           UI style: claude-code (default), minimal
  --ui-minimal           Use minimal UI (no colors, simple prompts)
  --ui-claude-code       Use Claude Code style UI (boxed input, animations)
  -h, --help             Show this help message
  --version              Show version

MODES:
  REPL Mode          Run without a prompt to enter interactive mode
  Single-shot Mode   Pass a prompt as arguments to execute and exit

HISTORY:
  Command history is stored per working directory in .skill-manager-history
  Use ↑/↓ arrows to navigate history, "history" command to view/search

BUILT-IN SKILLS:
  list-skills        List all registered skills
  read-skill         Read a skill definition file
  write-skill        Create or update a skill file
  delete-skill       Remove a skill directory
  validate-skill     Validate skill against schema
  get-template       Get blank template for skill type
  update-section     Update a specific section
  preview-changes    Show diff before applying
  generate-code      Generate .mjs from tskill
  test-code          Test generated code
  skills-orchestrator  Orchestrator for routing requests
  skill-refiner      Iterative improvement loop

SKILL TYPES:
  tskill   Database table (fields, validators, presenters)
  cskill   Code skill (LLM-generated code execution)
  iskill   Interactive (commands, user prompts)
  oskill   Orchestrator (routes to other skills)
  mskill   MCP tool integration

EXTERNAL REPOSITORIES:
  Add external skill repositories via REPL commands:
    /add-repo <git-url|path>   Add git repo or local path
    /repos                     List configured repositories
    /update-repo [name|all]    Update git repositories
    /remove-repo <name>        Remove a repository

  Or via CLI flags for session-only skill roots:
    skill-manager -r /path/to/skills -r /another/path

EXAMPLES:
  # Start interactive REPL
  skill-manager
  skill-manager --dir /path/to/project

  # Single-shot commands
  skill-manager "list all skills"
  skill-manager "read the equipment skill"
  skill-manager "create a tskill called inventory for tracking stock"
  skill-manager "validate the area skill"
  skill-manager "generate code for equipment"
  skill-manager "test the generated code for equipment"
  skill-manager "refine equipment until all tests pass"
  skill-manager --fast "list skills"

  # With additional skill roots
  skill-manager -r ~/shared-skills "list all skills"

ENVIRONMENT:
  ANTHROPIC_API_KEY    API key for Claude (required)
  OPENAI_API_KEY       Alternative: API key for OpenAI
  SKILL_MANAGER_UI     Default UI style (claude-code, minimal)

For more information, see the README.md in the SkillManagerAgent directory.
`);
}

/**
 * Check if this module is being run directly (cross-platform safe)
 */
function isRunDirectly() {
    try {
        const scriptPath = realpathSync(process.argv[1]);
        const modulePath = realpathSync(fileURLToPath(import.meta.url));
        return scriptPath === modulePath;
    } catch {
        // Fallback for edge cases
        return import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
    }
}

// Run if executed directly
if (isRunDirectly()) {
    main().catch((error) => {
        console.error('Fatal error:', error.message);
        process.exit(1);
    });
}
