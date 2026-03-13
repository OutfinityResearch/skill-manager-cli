/**
 * REPLSession - Manages the interactive REPL session for RecursiveSkilledAgent.
 *
 * Coordinates between InteractivePrompt, QuickCommands, and NaturalLanguageProcessor
 * to provide a complete interactive CLI experience.
 */

import path from 'node:path';
import readline from 'node:readline';
import { LineEditor } from '../ui/LineEditor.mjs';
import { createSpinner } from '../ui/spinner.mjs';
import { buildCommandList, showTestSelector, showHelpSelector, showTierSelector, showModelSelector } from '../ui/CommandSelector.mjs';
import { SlashCommandHandler } from './SlashCommandHandler.mjs';
import { summarizeResult } from '../ui/ResultFormatter.mjs';
import { HistoryManager } from './HistoryManager.mjs';
import { renderMarkdown } from '../ui/MarkdownRenderer.mjs';
import { InteractivePrompt } from './InteractivePrompt.mjs';
import { QuickCommands } from './QuickCommands.mjs';
import { NaturalLanguageProcessor } from './NaturalLanguageProcessor.mjs';
import { discoverSkillTests, runTestFile, runTestSuite } from '../lib/testDiscovery.mjs';
import { TIERS } from '../lib/constants.mjs';
import { formatTestResult, formatSuiteResults } from '../ui/TestResultFormatter.mjs';
import { showHelp, getHelpTopics, getCommandHelp } from '../ui/HelpSystem.mjs';
import { UIContext } from '../ui/UIContext.mjs';
import { BUILT_IN_SKILLS } from '../lib/constants.mjs';

// Import tier/model utilities from achillesAgentLib (direct path — not re-exported from index)
let _listTiersFromCache = null;
let _listModelsFromCache = null;
try {
    const llmClient = await import('achillesAgentLib/utils/LLMClient.mjs');
    _listTiersFromCache = llmClient.listTiersFromCache;
    _listModelsFromCache = llmClient.listModelsFromCache;
} catch {
    // achillesAgentLib not available — tier commands will show an error
}

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
     * @param {string} [options.skillsDir] - Skills directory path (defaults to workingDir/skills)
     * @param {string} [options.builtInSkillsDir] - Built-in skills directory (for filtering user skills)
     * @param {HistoryManager} [options.historyManager] - Command history manager (created if not provided)
     * @param {boolean} [options.debug] - Enable debug mode
     * @param {string} [options.tier] - Initial LLM tier (default: 'fast')
     */
    constructor(agent, options = {}) {
        this.agent = agent;
        this.options = options;

        // Configuration
        this.workingDir = options.workingDir || agent.startDir;
        this.skillsDir = options.skillsDir || path.join(this.workingDir, 'skills');
        this.builtInSkillsDir = options.builtInSkillsDir || null;
        this.debug = options.debug || false;

        // Active LLM tier for all prompt executions
        this.activeTier = options.tier || TIERS.FAST;

        // Pinned model (bypasses tier cascade when set)
        this.pinnedModel = null;

        // History manager
        this.historyManager = options.historyManager || new HistoryManager({
            workingDir: this.workingDir,
        });

        // Skip bash permissions flag
        this.skipBashPermissions = options.skipBashPermissions || false;

        // Context for skill execution
        this.context = {
            workingDir: this.workingDir,
            skillsDir: this.skillsDir,
            skilledAgent: agent,
            llmAgent: agent.llmAgent,
            logger: agent.logger,
            skipBashPermissions: this.skipBashPermissions,
        };

        // Attach context directly to agent for skills that access agent.context
        agent.context = this.context;

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
            getAllSkills: () => agent.getSkills(),
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

        this._activeSpinner = null;
        this._activeSpinnerMessage = '';
        this._registerLLMIO();
    }

    _setActiveSpinner(spinner) {
        this._activeSpinner = spinner;
        this._activeSpinnerMessage = spinner?.message || '';
    }

    _registerLLMIO() {
        const llmAgent = this.agent?.llmAgent;
        if (!llmAgent) {
            return;
        }

        const { colors } = UIContext.getTheme();

        llmAgent.setInputReader({
            read: async (prompt = '> ') => {
                if (!process.stdin.isTTY) {
                    throw new Error('Interactive input requested but stdin is not a TTY.');
                }

                const spinner = this._activeSpinner;
                const previousMessage = this._activeSpinnerMessage;
                if (spinner) {
                    spinner.update?.('Awaiting Input...');
                    spinner.pause?.();
                }

                const answer = await this._promptWithBox(prompt, colors);

                if (spinner) {
                    spinner.update?.(previousMessage || spinner.message || 'Running...');
                    spinner.resume?.();
                }

                return answer;
            },
        });

        llmAgent.setOutputWriter({
            write: async (message) => {
                if (message === null || message === undefined) {
                    return;
                }
                const text = typeof message === 'string'
                    ? message
                    : JSON.stringify(message, null, 2);
                console.log(text);
            },
        });
    }

    /**
     * Execute a skill directly
     * @private
     */
    async _executeSkill(skillName, input, opts = {}) {
        this._logEnvSnapshot(`execute-skill:${skillName}`);
        const execOpts = {
            skillName,
            context: this.context,
            tier: this.activeTier,
            ...opts,
        };
        if (this.pinnedModel) {
            execOpts.model = this.pinnedModel;
        }
        return this.agent.executePrompt(input, execOpts);
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
        const { skillName = BUILT_IN_SKILLS.ORCHESTRATOR, ...restOptions } = opts;

        this._logEnvSnapshot(`process-prompt:${skillName}`);
        const execOpts = {
            skillName,
            context: this.context,
            tier: this.activeTier,
            ...restOptions,
        };
        if (this.pinnedModel) {
            execOpts.model = this.pinnedModel;
        }
        let result = await this.agent.executePrompt(userPrompt, execOpts);

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
        const theme = UIContext.getTheme();
        const { colors, icons } = theme;

        // Helper to apply style
        const style = (text, ...styles) => {
            const styleStr = styles.map(s => colors[s] || s).join('');
            return `${styleStr}${text}${colors.reset}`;
        };

        // Helper to create header bar
        const headerBar = (title, width = 50) => {
            const padding = Math.floor((width - title.length - 2) / 2);
            const leftPad = '─'.repeat(padding);
            const rightPad = '─'.repeat(width - title.length - 2 - padding);
            return `${colors.cyan}${leftPad} ${colors.bold}${title}${colors.reset}${colors.cyan} ${rightPad}${colors.reset}`;
        };

        // Minimal header
        console.log('');
        console.log(headerBar('Skill Manager', 50));
        console.log('');

        // Session info as key-value pairs
        const shortWorkDir = this.workingDir.replace(process.env.HOME, '~');
        console.log(`  ${style('cwd', 'cyan')}  ${shortWorkDir}`);

        // Show LLM tier and model info
        try {
            if (this.pinnedModel) {
                console.log(`  ${style('llm', 'cyan')}  ${this.pinnedModel} ${style('[pinned]', 'yellow')}`);
            } else {
                const tierModels = _listTiersFromCache?.();
                const tierModelList = tierModels?.[this.activeTier];
                const primaryModel = tierModelList?.[0] || 'unknown';
                const tierColor = [TIERS.DEEP, TIERS.ULTRA].includes(this.activeTier) ? 'magenta' : 'green';
                console.log(`  ${style('llm', 'cyan')}  ${primaryModel} ${style(`[${this.activeTier}]`, tierColor)}`);
            }
        } catch (e) {
            // Fallback to legacy mode display
            try {
                const description = this.agent.llmAgent.invokerStrategy?.describe?.();
                if (description) {
                    const models = this.activeTier === TIERS.DEEP ? description.deepModels : description.fastModels;
                    const primaryModel = models?.[0]?.name || 'unknown';
                    console.log(`  ${style('llm', 'cyan')}  ${primaryModel} ${style(`[${this.activeTier}]`, 'green')}`);
                }
            } catch {
                // Ignore
            }
        }

        // Skills summary
        if (userSkills.length > 0) {
            console.log('');
            console.log(`  ${style(icons.bullet, 'green')} ${userSkills.length} skill(s) loaded`);

            // Group skills by type
            const byType = {};
            for (const s of userSkills) {
                const type = s.type || 'unknown';
                if (!byType[type]) byType[type] = [];
                byType[type].push(s.shortName || s.name);
            }

            // Show grouped skills (max 4 per type, then ellipsis)
            for (const [type, names] of Object.entries(byType)) {
                const displayNames = names.slice(0, 4);
                const more = names.length > 4 ? ` ${style(`+${names.length - 4} more`, 'dim')}` : '';
                console.log(`    ${style(type, 'dim')} ${displayNames.join(', ')}${more}`);
            }
        } else {
            console.log('');
            console.log(`  ${style(icons.hollowBullet, 'yellow')} No skills found`);
        }

        // History hint
        if (this.historyManager.length > 0) {
            console.log('');
            console.log(`  ${style(icons.bullet, 'dim')} ${this.historyManager.length} history entries ${style('(↑/↓ to navigate)', 'dim')}`);
        }

        // Commands hint
        console.log('');
        console.log(`  ${style('Type "/" for commands, or describe what you need', 'dim')}`);
        console.log('');
    }

    _logEnvSnapshot(reason) {
        const prefixes = [
            'ACHILLES_',
            'LLM_',
            'OPENAI_',
            'OPENROUTER_',
            'ANTHROPIC_',
            'GEMINI_',
            'XAI_',
            'MISTRAL_',
            'HUGGINGFACE_',
            'OPENCODE_',
            'AXIOLOGIC_',
        ];

        const isSensitive = (key) => /KEY|TOKEN|SECRET|PASSWORD/i.test(key);
        const entries = Object.entries(process.env)
            .filter(([key]) => prefixes.some((prefix) => key.startsWith(prefix)))
            .sort(([a], [b]) => a.localeCompare(b));

        console.info(`[SkillManager] Env snapshot (${reason})`);
        if (!entries.length) {
            console.info('[SkillManager]   (no matching env vars found)');
            return;
        }

        for (const [key, value] of entries) {
            const displayValue = isSensitive(key)
                ? (value ? '[set]' : '')
                : (value ?? '');
            console.info(`[SkillManager]   ${key}=${displayValue}`);
        }
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
        this._setActiveSpinner(spinner);

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
                // Handle /tier command
                if (result.tierChange) {
                    this.activeTier = result.tierChange;
                    this.pinnedModel = null; // Clear model pin on tier switch
                    const tierModels = _listTiersFromCache?.() || {};
                    const models = tierModels[this.activeTier] || [];
                    const primaryModel = models[0] || 'unknown';
                    spinner.succeed(`Tier: ${this.activeTier} → ${primaryModel}${models.length > 1 ? ` (+${models.length - 1} fallback${models.length > 2 ? 's' : ''})` : ''}`);
                } else if (result.showTierPicker) {
                    spinner.stop();
                    await this._handleTierPicker();
                // Handle /model command
                } else if (result.showModelPicker) {
                    spinner.stop();
                    await this._handleModelPicker();
                } else if (result.hasOwnProperty('modelChange')) {
                    this.pinnedModel = result.modelChange;
                    if (this.pinnedModel) {
                        spinner.succeed(`Model pinned: ${this.pinnedModel}`);
                    } else {
                        spinner.succeed('Model pin cleared — using tier-based selection');
                    }
                // Handle /raw toggle command
                } else if (result.toggleMarkdown) {
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

        this._setActiveSpinner(null);

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
            theme: UIContext.getTheme(),
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
                theme: UIContext.getTheme(),
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
                theme: UIContext.getTheme(),
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

    /**
     * Handle interactive tier picker when /tier is called without args.
     * @private
     */
    async _handleTierPicker() {
        const tiers = _listTiersFromCache?.();
        if (!tiers || Object.keys(tiers).length === 0) {
            console.log('\nNo tiers available.\n');
            return;
        }

        const selected = await showTierSelector(tiers, this.activeTier, {
            theme: UIContext.getTheme(),
        });

        if (!selected) {
            return;
        }

        this.activeTier = selected.name;
        this.pinnedModel = null; // Clear model pin on tier switch

        const models = tiers[this.activeTier] || [];
        const primaryModel = models[0] || 'unknown';
        console.log(`Tier: ${this.activeTier} → ${primaryModel}${models.length > 1 ? ` (+${models.length - 1} fallback${models.length > 2 ? 's' : ''})` : ''}`);

        this.historyManager.add(`/tier ${this.activeTier}`);
    }

    /**
     * Handle interactive model picker when /model is called without args.
     * @private
     */
    async _handleModelPicker() {
        const tiers = _listTiersFromCache?.();
        if (!tiers || Object.keys(tiers).length === 0) {
            console.log('\nNo models available.\n');
            return;
        }

        const selected = await showModelSelector(tiers, {
            theme: UIContext.getTheme(),
        });

        if (!selected) {
            return;
        }

        this.pinnedModel = selected.name;
        console.log(`Model pinned: ${this.pinnedModel}`);

        this.historyManager.add(`/model ${this.pinnedModel}`);
    }

    async _promptWithBox(prompt, colors) {
        const question = typeof prompt === 'string' && prompt.trim()
            ? prompt.trim()
            : 'Please provide the missing details.';

        if (!process.stdin.isTTY) {
            return new Promise((resolve) => {
                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout,
                });
                let answered = false;
                const finalize = (answer = '') => {
                    if (answered) return;
                    answered = true;
                    rl.close();
                    resolve(answer);
                };
                rl.on('SIGINT', () => finalize(''));
                rl.question(`${question}\n> `, (answer) => finalize(answer));
            });
        }

        process.stdout.write(`\n${colors.dim}${question}${colors.reset}\n`);

        return new Promise((resolve) => {
            const editor = new LineEditor({
                prompt: `${colors.cyan}${colors.bold}>${colors.reset} `,
                rightHint: `${colors.dim}↵ send${colors.reset}`,
                boxed: true,
            });

            editor.render();
            process.stdin.setRawMode(true);
            process.stdin.resume();
            LineEditor.enableBracketedPaste();

            const cleanup = () => {
                if (editor.boxed) {
                    editor.drawBottomBorder();
                }
                LineEditor.disableBracketedPaste();
                process.stdin.setRawMode(false);
                process.stdin.removeListener('data', handleKey);
            };

            const handleKey = (key) => {
                const keyStr = key.toString();

                if (keyStr === '\x03') {
                    cleanup();
                    process.stdout.write('\n');
                    resolve('');
                    return;
                }

                if (keyStr === '\r' || keyStr === '\n') {
                    const value = editor.getBuffer();
                    cleanup();
                    process.stdout.write('\n');
                    resolve(value);
                    return;
                }

                const action = editor.processKey(keyStr);
                if (action === 'modified' || action === 'cursor') {
                    editor.render();
                }
            };

            process.stdin.on('data', handleKey);
        });
    }
}

export default REPLSession;
