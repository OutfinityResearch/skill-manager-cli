#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to built-in skills bundled with this module
const builtInSkillsDir = path.join(__dirname, '.AchillesSkills');

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

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--dir' || arg === '-d') {
            workingDir = path.resolve(args[i + 1] || process.cwd());
            i += 1;
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

    // Initialize LLM Agent
    const llmAgent = new LLMAgent({
        name: 'skill-manager-agent',
    });

    // Initialize RecursiveSkilledAgent with built-in skills
    const agent = new RecursiveSkilledAgent({
        llmAgent,
        startDir: workingDir,
        additionalSkillRoots: [builtInSkillsDir],
        logger,
    });

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
  -d, --dir <path>   Working directory containing .AchillesSkills (default: cwd)
  -v, --verbose      Enable verbose logging
  --debug            Show full JSON output (orchestrator plans, executions)
  --fast             Use fast LLM mode (cheaper, quicker)
  --deep             Use deep LLM mode (default, more capable)
  --no-markdown      Disable markdown rendering in output (use /raw to toggle)
  -h, --help         Show this help message
  --version          Show version

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

ENVIRONMENT:
  ANTHROPIC_API_KEY    API key for Claude (required)
  OPENAI_API_KEY       Alternative: API key for OpenAI

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
