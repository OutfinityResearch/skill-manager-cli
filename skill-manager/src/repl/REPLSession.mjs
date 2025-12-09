/**
 * REPLSession - Manages the interactive REPL session for RecursiveSkilledAgent.
 *
 * Coordinates between InteractivePrompt, QuickCommands, and NaturalLanguageProcessor
 * to provide a complete interactive CLI experience.
 */

import path from 'node:path';
import { createSpinner } from '../ui/spinner.mjs';
import { buildCommandList, showTestSelector, showHelpSelector } from '../ui/CommandSelector.mjs';
import { SlashCommandHandler } from './SlashCommandHandler.mjs';
import { summarizeResult } from '../ui/ResultFormatter.mjs';
import { HistoryManager } from './HistoryManager.mjs';
import { renderMarkdown } from '../ui/MarkdownRenderer.mjs';
import { InteractivePrompt } from './InteractivePrompt.mjs';
import { QuickCommands } from './QuickCommands.mjs';
import { NaturalLanguageProcessor } from './NaturalLanguageProcessor.mjs';
import { discoverSkillTests, runTestFile, runTestSuite } from '../lib/testDiscovery.mjs';
import { formatTestResult, formatSuiteResults } from '../ui/TestResultFormatter.mjs';
import { showHelp, getHelpTopics, getCommandHelp } from '../ui/HelpSystem.mjs';

/**
 * REPLSession class for managing interactive CLI sessions.
 */
export class REPLSession {
    /**
     * Create a new REPLSession.
     *
     * @param {RecursiveSkilledAgent} agent - The RecursiveSkilledAgent instance
     * @param {Object} options - Session options
     * @param {string} options.workingDir - Working directory path
     * @param {string} [options.skillsDir] - Skills directory path (defaults to workingDir/.AchillesSkills)
     * @param {string} [options.builtInSkillsDir] - Built-in skills directory (for filtering user skills)
     * @param {HistoryManager} [options.historyManager] - Command history manager (created if not provided)
     * @param {boolean} [options.debug] - Enable debug mode
     */
    constructor(agent, options = {}) {
        this.agent = agent;
        this.options = options;

        // Configuration
        this.workingDir = options.workingDir || agent.startDir;
        this.skillsDir = options.skillsDir || path.join(this.workingDir, '.AchillesSkills');
        this.builtInSkillsDir = options.builtInSkillsDir || null;
        this.debug = options.debug || false;

        // History manager
        this.historyManager = options.historyManager || new HistoryManager({
            workingDir: this.workingDir,
        });

        // Context for skill execution
        this.context = {
            workingDir: this.workingDir,
            skillsDir: this.skillsDir,
            skilledAgent: agent,
            llmAgent: agent.llmAgent,
            logger: agent.logger,
        };

        // Create slash command handler with callbacks
        this.slashHandler = new SlashCommandHandler({
            executeSkill: (skillName, input, opts) => this._executeSkill(skillName, input, opts),
            getUserSkills: () => this.getUserSkills(),
            getSkills: () => agent.getSkills(),
        });

        // Build command list for interactive selector
        this.commandList = buildCommandList(SlashCommandHandler.COMMANDS);

        // Markdown rendering toggle (default: enabled)
        this.markdownEnabled = options.renderMarkdown !== false;

        // Initialize sub-modules
        this.inputPrompt = new InteractivePrompt({
            historyManager: this.historyManager,
            slashHandler: this.slashHandler,
            commandList: this.commandList,
            getUserSkills: () => this.getUserSkills(),
            prompt: 'SkillManager> ',
        });

        this.quickCommands = new QuickCommands({
            getUserSkills: () => this.getUserSkills(),
            getAllSkills: () => agent.getSkills(),
            reloadSkills: () => this.reloadSkills(),
            historyManager: this.historyManager,
            builtInSkillsDir: this.builtInSkillsDir,
        });

        this.nlProcessor = new NaturalLanguageProcessor({
            agent: this.agent,
            processPrompt: (input, opts) => this.processPrompt(input, opts),
            historyManager: this.historyManager,
            isMarkdownEnabled: () => this.markdownEnabled,
        });
    }

    /**
     * Execute a skill directly
     * @private
     */
    async _executeSkill(skillName, input, opts = {}) {
        return this.agent.executePrompt(input, {
            skillName,
            context: this.context,
            ...opts,
        });
    }

    /**
     * Get user skills (exclude built-in skills)
     */
    getUserSkills() {
        const skills = this.agent.getSkills();
        if (!this.builtInSkillsDir) {
            return skills;
        }
        return skills.filter(s => !s.skillDir?.startsWith(this.builtInSkillsDir));
    }

    /**
     * Reload skills from disk
     */
    reloadSkills() {
        return this.agent.reloadSkills();
    }

    /**
     * Process a prompt through the skills-orchestrator
     */
    async processPrompt(userPrompt, opts = {}) {
        const { skillName = 'skills-orchestrator', ...restOptions } = opts;

        let result = await this.agent.executePrompt(userPrompt, {
            skillName,
            context: this.context,
            ...restOptions,
        });

        // If result is a JSON string, parse it to get the object
        if (typeof result === 'string') {
            try {
                const parsed = JSON.parse(result);
                if (parsed && (parsed.executions || parsed.type === 'orchestrator')) {
                    result = parsed;
                } else {
                    return result;
                }
            } catch {
                return result;
            }
        }

        // In debug mode, show full JSON
        if (this.debug) {
            if (result?.result) {
                return typeof result.result === 'string'
                    ? result.result
                    : JSON.stringify(result.result, null, 2);
            }
            if (result?.output) {
                return result.output;
            }
            return JSON.stringify(result, null, 2);
        }

        // Non-debug mode: show summarized output
        return summarizeResult(result);
    }

    /**
     * Show the startup banner.
     * @private
     */
    _showBanner() {
        const userSkills = this.getUserSkills();

        console.log('\n╔══════════════════════════════════════════════════════════╗');
        console.log('║           Skill Manager Agent - Interactive CLI          ║');
        console.log('╚══════════════════════════════════════════════════════════╝\n');
        console.log(`Working directory: ${this.workingDir}`);
        console.log(`Skills directory: ${this.skillsDir}`);

        // Show LLM model info
        try {
            const description = this.agent.llmAgent.invokerStrategy?.describe?.();
            if (description) {
                const orchestratorMode = process.env.ACHILLES_ORCHESTRATOR_MODE || 'fast';
                const models = orchestratorMode === 'deep' ? description.deepModels : description.fastModels;
                const primaryModel = models?.[0]?.name || 'unknown';
                const fallbacks = models?.slice(1, 3).map(m => m.name).join(', ');
                const fallbackInfo = fallbacks ? ` (fallbacks: ${fallbacks})` : '';
                console.log(`LLM: ${primaryModel}${fallbackInfo} [${orchestratorMode} mode]`);
            }
        } catch (e) {
            // Ignore errors getting model info
        }

        if (userSkills.length > 0) {
            console.log(`Loaded ${userSkills.length} skill(s):`);
            userSkills.forEach(s => console.log(`  • [${s.type}] ${s.shortName || s.name}`));
        } else {
            console.log('No user skills found. Create one with "create a skill" to get started.');
        }

        // Show history info
        if (this.historyManager.length > 0) {
            console.log(`Command history: ${this.historyManager.length} entries (use ↑/↓ to navigate, "history" to view)`);
        }

        console.log('\nCommands: "exit" to quit, type "/" to see all commands, or type any instruction.\n');
    }

    /**
     * Start the interactive REPL session.
     * @returns {Promise<void>}
     */
    async start() {
        this._showBanner();

        // Main REPL loop
        while (true) {
            const input = (await this.inputPrompt.prompt()).trim();

            if (!input) continue;

            // Exit commands
            if (['exit', 'quit', 'q'].includes(input.toLowerCase())) {
                console.log('\nGoodbye!\n');
                break;
            }

            // Quick commands (no LLM needed)
            if (this.quickCommands.isQuickCommand(input)) {
                this.quickCommands.execute(input);
                continue;
            }

            // Slash commands (direct skill execution)
            if (this.slashHandler.isSlashCommand(input)) {
                const shouldExit = await this._handleSlashCommand(input);
                if (shouldExit) break;
                continue;
            }

            // Natural language prompt - process via LLM
            await this.nlProcessor.process(input);
        }
    }

    /**
     * Handle a slash command.
     * @param {string} input - The slash command input
     * @returns {Promise<boolean>} True if REPL should exit
     * @private
     */
    async _handleSlashCommand(input) {
        const parsed = this.slashHandler.parseSlashCommand(input);
        if (!parsed) return false;

        // Create spinner for slash command execution
        const spinner = createSpinner(`Running /${parsed.command}...`);

        try {
            const result = await this.slashHandler.executeSlashCommand(parsed.command, parsed.args, {
                context: this.context,
            });

            if (result.handled) {
                // Handle /quit and /exit commands
                if (result.exitRepl) {
                    spinner.stop();
                    console.log('\nGoodbye!\n');
                    return true; // Signal to exit the REPL
                }
                // Handle /raw toggle command
                if (result.toggleMarkdown) {
                    this.markdownEnabled = !this.markdownEnabled;
                    spinner.succeed(`Markdown rendering ${this.markdownEnabled ? 'enabled' : 'disabled'}`);
                // Handle /test with no args - show interactive picker
                } else if (result.showTestPicker) {
                    spinner.stop();
                    await this._handleTestPicker();
                // Handle /run-tests with no args - show interactive picker
                } else if (result.showRunTestsPicker) {
                    spinner.stop();
                    await this._handleRunTestsPicker();
                // Handle /help with no args - show interactive help picker
                } else if (result.showHelpPicker) {
                    spinner.stop();
                    await this._handleHelpPicker();
                } else if (result.error) {
                    spinner.fail(result.error);
                } else if (result.result) {
                    spinner.succeed(`/${parsed.command} complete`);
                    console.log('-'.repeat(60));
                    console.log(this.markdownEnabled ? renderMarkdown(result.result) : result.result);
                    console.log('-'.repeat(60) + '\n');
                } else {
                    spinner.stop();
                }
                // Save successful slash commands to history
                if (!result.error) {
                    this.historyManager.add(input);
                }
            } else {
                spinner.fail(result.error || `Unknown command: /${parsed.command}`);
            }
        } catch (error) {
            spinner.fail(error.message);
        }

        return false;
    }

    /**
     * Handle interactive test picker when /test is called without args.
     * @private
     */
    async _handleTestPicker() {
        // Discover available tests
        const tests = discoverSkillTests(this.agent);

        if (tests.length === 0) {
            console.log('\nNo tests found. Create .tests.mjs files in skill directories to add tests.\n');
            return;
        }

        console.log(`\nFound ${tests.length} test(s). Select one to run:\n`);

        // Show interactive test selector
        const selected = await showTestSelector(tests, {
            prompt: 'Select test> ',
            maxVisible: 10,
        });

        if (!selected) {
            console.log('\nTest selection cancelled.\n');
            return;
        }

        // Run the selected test
        const spinner = createSpinner(`Running tests for ${selected.skillName}...`);

        try {
            const testResult = await runTestFile(selected.testFile, {
                timeout: 30000,
                verbose: false,
            });

            // Add skill info to result
            const fullResult = {
                ...selected,
                ...testResult,
            };

            spinner.succeed(`Tests for ${selected.skillName} complete`);
            console.log('-'.repeat(60));
            console.log(formatTestResult(fullResult));
            console.log('-'.repeat(60) + '\n');

            // Save to history
            this.historyManager.add(`/test ${selected.skillName}`);
        } catch (error) {
            spinner.fail(`Test error: ${error.message}`);
        }
    }

    /**
     * Handle interactive test picker when /run-tests is called without args.
     * Shows an option to run all tests plus individual test options.
     * @private
     */
    async _handleRunTestsPicker() {
        // Discover available tests
        const tests = discoverSkillTests(this.agent);

        if (tests.length === 0) {
            console.log('\nNo tests found. Create .tests.mjs files in skill directories to add tests.\n');
            return;
        }

        // Add "Run All Tests" as first option
        const options = [
            { skillName: 'all', shortName: 'all', skillType: 'all', testFile: null, description: `Run all ${tests.length} test(s)` },
            ...tests,
        ];

        console.log(`\nFound ${tests.length} test(s). Select one to run:\n`);

        // Show interactive test selector
        let selected;
        try {
            selected = await showTestSelector(options, {
                prompt: 'Select test> ',
                maxVisible: 10,
            });
        } catch (error) {
            console.error(`\nError showing test selector: ${error.message}\n`);
            return;
        }

        if (!selected) {
            console.log('\nTest selection cancelled.\n');
            return;
        }

        // Run all tests or selected test
        if (selected.skillName === 'all') {
            const spinner = createSpinner(`Running all ${tests.length} test(s)...`);

            try {
                const suiteResult = await runTestSuite(tests, {
                    timeout: 30000,
                    verbose: false,
                });

                spinner.succeed('Test suite complete');
                console.log('-'.repeat(60));
                console.log(formatSuiteResults(suiteResult));
                console.log('-'.repeat(60) + '\n');

                // Save to history
                this.historyManager.add('/run-tests all');
            } catch (error) {
                spinner.fail(`Test suite error: ${error.message}`);
            }
        } else {
            const spinner = createSpinner(`Running tests for ${selected.skillName}...`);

            try {
                const testResult = await runTestFile(selected.testFile, {
                    timeout: 30000,
                    verbose: false,
                });

                // Add skill info to result
                const fullResult = {
                    ...selected,
                    ...testResult,
                };

                spinner.succeed(`Tests for ${selected.skillName} complete`);
                console.log('-'.repeat(60));
                console.log(formatTestResult(fullResult));
                console.log('-'.repeat(60) + '\n');

                // Save to history
                this.historyManager.add(`/run-tests ${selected.skillName}`);
            } catch (error) {
                spinner.fail(`Test error: ${error.message}`);
            }
        }
    }

    /**
     * Handle interactive help picker when /help is called without args.
     * Shows available help topics and commands for user to select.
     * @private
     */
    async _handleHelpPicker() {
        // Build help topics list
        const topics = getHelpTopics();
        const commands = getCommandHelp();

        // Combine topics and commands into a single list
        const helpItems = [
            // Topics first (grouped)
            ...topics.map(t => ({
                name: t.name,
                title: t.title,
                description: t.title,
                type: 'topic',
            })),
            // Then individual commands
            ...commands.map(c => ({
                name: `/${c.name}`,
                title: c.title,
                description: c.title,
                type: 'command',
            })),
        ];

        console.log(`\nSelect a help topic or command:\n`);

        // Show interactive help selector
        let selected;
        try {
            selected = await showHelpSelector(helpItems, {
                prompt: 'Help> ',
                maxVisible: 12,
            });
        } catch (error) {
            console.error(`\nError showing help selector: ${error.message}\n`);
            return;
        }

        if (!selected) {
            console.log('\nHelp selection cancelled.\n');
            return;
        }

        // Display the selected help topic
        const topicName = selected.type === 'command'
            ? selected.name.slice(1) // Remove leading /
            : selected.name;

        const helpText = showHelp(topicName);
        console.log(helpText);

        // Save to history
        this.historyManager.add(`/help ${topicName}`);
    }
}

export default REPLSession;
