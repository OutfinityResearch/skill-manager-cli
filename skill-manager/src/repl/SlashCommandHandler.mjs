/**
 * SlashCommandHandler - Manages slash command definitions and execution.
 *
 * Extracted from SkillManagerCli to reduce file size and improve modularity.
 */

import { formatSlashResult } from '../ui/ResultFormatter.mjs';
import { showHelp, getQuickReference } from '../ui/HelpSystem.mjs';

/**
 * SlashCommandHandler class for managing slash commands in the CLI.
 */
export class SlashCommandHandler {
    /**
     * Slash command definitions.
     * Maps command names to skill names and provides help text.
     */
    static COMMANDS = {
        'ls': {
            skill: 'list-skills',
            usage: '/ls [all] [--repo <name>]',
            description: 'List skills (all=include built-in, --repo=filter by repo)',
            args: 'optional',
            needsSkillArg: false,
        },
        'list': {
            skill: 'list-skills',
            usage: '/list [all] [--repo <name>]',
            description: 'List skills (all=include built-in, --repo=filter by repo)',
            args: 'optional',
            needsSkillArg: false,
        },
        'read': {
            skill: 'read-skill',
            usage: '/read <skill-name>',
            description: 'Read a skill definition file',
            args: 'required',
            needsSkillArg: true,
        },
        'write': {
            skill: 'write-skill',
            usage: '/write <skill-name> [type]',
            description: 'Create or update a skill file',
            args: 'required',
            needsSkillArg: true,
        },
        'delete': {
            skill: 'delete-skill',
            usage: '/delete <skill-name>',
            description: 'Delete a skill directory',
            args: 'required',
            needsSkillArg: true,
        },
        'validate': {
            skill: 'validate-skill',
            usage: '/validate <skill-name>',
            description: 'Validate skill against schema',
            args: 'required',
            needsSkillArg: true,
        },
        'template': {
            skill: 'get-template',
            usage: '/template <type>',
            description: 'Get blank template (tskill, cskill, cgskill, etc.)',
            args: 'required',
            needsSkillArg: false, // Takes type, not skill name
        },
        'generate': {
            skill: 'generate-code',
            usage: '/generate <skill-name>',
            description: 'Generate .mjs code from tskill',
            args: 'required',
            needsSkillArg: true,
        },
        'test': {
            skill: null, // Special handling - shows picker if no args, runs test-code if skill specified
            usage: '/test [skill-name]',
            description: 'Test skill code (shows picker if no skill specified)',
            args: 'optional',
            needsSkillArg: false,
        },
        'run-tests': {
            skill: 'run-tests',
            usage: '/run-tests [skill-name|all]',
            description: 'Run .tests.mjs files (all = run all tests)',
            args: 'optional',
            needsSkillArg: false,
        },
        'refine': {
            skill: 'skill-refiner',
            usage: '/refine <skill-name>',
            description: 'Iteratively improve skill until tests pass',
            args: 'required',
            needsSkillArg: true,
        },
        'update': {
            skill: 'update-section',
            usage: '/update <skill-name> <section>',
            description: 'Update a specific section of a skill',
            args: 'required',
            needsSkillArg: true,
        },
        // Note: 'preview-changes' skill exists but requires programmatic input
        // (skillName, fileName, newContent as JSON). It's called by other skills,
        // not directly via slash command.
        'exec': {
            skill: null, // Dynamic - uses the argument as skill name
            usage: '/exec <skill-name> [input]',
            description: 'Execute any skill directly',
            args: 'required',
            needsSkillArg: true,
        },
        'specs': {
            skill: 'read-specs',
            usage: '/specs <skill-name>',
            description: 'Read a skill\'s .specs.md file',
            args: 'required',
            needsSkillArg: true,
        },
        'specs-write': {
            skill: 'write-specs',
            usage: '/specs-write <skill-name> [content]',
            description: 'Create/update a skill\'s .specs.md file',
            args: 'required',
            needsSkillArg: true,
        },
        'write-tests': {
            skill: 'write-tests',
            usage: '/write-tests <skill-name>',
            description: 'Generate test file for a skill',
            args: 'required',
            needsSkillArg: true,
        },
        // Repository management commands
        'repos': {
            skill: null,
            usage: '/repos',
            description: 'List configured skill repositories',
            args: 'none',
            needsSkillArg: false,
        },
        'add-repo': {
            skill: null,
            usage: '/add-repo <git-url|path> [name] [--editable]',
            description: 'Add an external skill repository (--editable allows managing its skills)',
            args: 'required',
            needsSkillArg: false,
        },
        'remove-repo': {
            skill: null,
            usage: '/remove-repo <name> [--delete]',
            description: 'Remove a repository (--delete removes cloned files)',
            args: 'required',
            needsSkillArg: false,
        },
        'update-repo': {
            skill: null,
            usage: '/update-repo [name|all]',
            description: 'Update repository (git pull)',
            args: 'optional',
            needsSkillArg: false,
        },
        'enable-repo': {
            skill: null,
            usage: '/enable-repo <name>',
            description: 'Enable a disabled repository',
            args: 'required',
            needsSkillArg: false,
        },
        'disable-repo': {
            skill: null,
            usage: '/disable-repo <name>',
            description: 'Disable a repository (keeps config)',
            args: 'required',
            needsSkillArg: false,
        },
        'edit-repo': {
            skill: null,
            usage: '/edit-repo <name>',
            description: 'Toggle whether a repo\'s skills can be listed/read/modified',
            args: 'required',
            needsSkillArg: false,
        },
    };

    /**
     * Create a new SlashCommandHandler.
     *
     * @param {Object} options
     * @param {Function} options.executeSkill - Function to execute a skill: (skillName, input, options) => Promise
     * @param {Function} options.getUserSkills - Function to get user skills: () => Array
     * @param {Function} options.getSkills - Function to get all skills: () => Array
     * @param {Function} [options.getRepositories] - Function to get configured repos: () => Array
     */
    constructor({ executeSkill, getUserSkills, getSkills, getRepositories }) {
        this.executeSkill = executeSkill;
        this.getUserSkills = getUserSkills;
        this.getSkills = getSkills;
        this.getRepositories = getRepositories || (() => []);
    }

    /**
     * Sync agent's skill roots with current RepoManager configuration.
     * This ensures newly added/removed repos are reflected in the agent.
     * @param {Object} agent - The RecursiveSkilledAgent instance
     * @param {Object} repoManager - The RepoManager instance
     * @param {Object} [options] - Additional options
     * @param {string} [options.removedSkillsPath] - Path of a just-removed repo to clean up
     * @private
     */
    _syncAgentSkillRoots(agent, repoManager, options = {}) {
        if (!agent || !repoManager) return;
        if (typeof agent.getAdditionalSkillRoots !== 'function') return;

        const agentRoots = agent.getAdditionalSkillRoots();
        const repoRoots = repoManager.getEnabledSkillRoots();

        // Collect all paths that should be removed:
        // 1. Disabled repos (in config but not enabled)
        // 2. Just-removed repo (passed via options)
        const pathsToRemove = new Set();

        // Add disabled repo paths
        for (const repo of repoManager.listRepositories()) {
            if (!repo.enabled && repo.skillsPath) {
                pathsToRemove.add(repo.skillsPath);
            }
        }

        // Add just-removed repo path if provided
        if (options.removedSkillsPath) {
            pathsToRemove.add(options.removedSkillsPath);
        }

        // Add new roots from repos that aren't in agent
        for (const root of repoRoots) {
            if (!agentRoots.includes(root)) {
                agentRoots.push(root);
            }
        }

        // Remove paths that should no longer be active
        for (let i = agentRoots.length - 1; i >= 0; i--) {
            if (pathsToRemove.has(agentRoots[i])) {
                agentRoots.splice(i, 1);
            }
        }
    }

    /**
     * Check if input is a slash command.
     * @param {string} input - User input
     * @returns {boolean}
     */
    isSlashCommand(input) {
        return input.startsWith('/');
    }

    /**
     * Parse a slash command into command name and arguments.
     * @param {string} input - User input starting with /
     * @returns {{command: string, args: string}|null}
     */
    parseSlashCommand(input) {
        const match = input.match(/^\/(\S+)(?:\s+(.*))?$/);
        if (!match) return null;
        return {
            command: match[1].toLowerCase(),
            args: match[2]?.trim() || '',
        };
    }

    /**
     * Execute a slash command.
     * @param {string} command - Command name (without /)
     * @param {string} args - Command arguments
     * @param {Object} options - Execution options
     * @returns {Promise<{handled: boolean, result?: string, error?: string}>}
     */
    async executeSlashCommand(command, args, options = {}) {
        // Handle /help [topic] - show topic-based help or picker
        if (command === 'help' || command === '?') {
            if (!args) {
                // No args - show interactive help picker
                return {
                    handled: true,
                    showHelpPicker: true,
                };
            }
            // Args provided - show help for specific topic
            const helpText = showHelp(args);
            console.log(helpText);
            return { handled: true };
        }

        // Handle /commands to list all available commands
        if (command === 'commands') {
            const helpText = showHelp('commands');
            console.log(helpText);
            return { handled: true };
        }

        // Handle /raw - toggle markdown rendering (handled by REPLSession)
        if (command === 'raw') {
            return { handled: true, toggleMarkdown: true };
        }

        // Handle /quit and /exit - exit the REPL (handled by REPLSession)
        if (command === 'quit' || command === 'exit' || command === 'q') {
            return { handled: true, exitRepl: true };
        }

        const cmdDef = SlashCommandHandler.COMMANDS[command];
        if (!cmdDef) {
            return {
                handled: false,
                error: `Unknown command: /${command}. Type /help for available commands.`,
            };
        }

        // Check required args
        if (cmdDef.args === 'required' && !args) {
            return {
                handled: true,
                error: `Usage: ${cmdDef.usage}\n  ${cmdDef.description}`,
            };
        }

        // Handle /test specially - shows picker if no args, runs test-code if skill specified
        if (command === 'test') {
            if (!args) {
                // No args - show interactive test picker
                // Return special signal for REPLSession to handle the picker
                return {
                    handled: true,
                    showTestPicker: true,
                };
            }

            // Args provided - run test-code for the specified skill
            try {
                const result = await this.executeSkill('test-code', args, options);
                return {
                    handled: true,
                    result: formatSlashResult(result),
                };
            } catch (error) {
                return {
                    handled: true,
                    error: error.message,
                };
            }
        }

        // Handle /exec specially - it executes any skill
        if (command === 'exec') {
            const parts = args.split(/\s+/);
            const skillName = parts[0];
            const skillInput = parts.slice(1).join(' ') || skillName;

            try {
                const result = await this.executeSkill(skillName, skillInput, options);
                return {
                    handled: true,
                    result: formatSlashResult(result),
                };
            } catch (error) {
                return {
                    handled: true,
                    error: error.message,
                };
            }
        }

        // Handle /run-tests specially - shows picker if no args
        if (command === 'run-tests') {
            if (!args) {
                // No args - show interactive test picker
                return {
                    handled: true,
                    showRunTestsPicker: true,
                };
            }

            // Args provided - run tests for the specified skill or "all"
            try {
                const result = await this.executeSkill('run-tests', args, options);
                return {
                    handled: true,
                    result: formatSlashResult(result),
                };
            } catch (error) {
                return {
                    handled: true,
                    error: error.message,
                };
            }
        }

        // Handle repository management commands
        const repoManager = options.context?.repoManager;

        // Handle /repos - list repositories
        if (command === 'repos') {
            if (!repoManager) {
                return { handled: true, error: 'Repository manager not available' };
            }
            const repos = repoManager.listRepositories();
            if (repos.length === 0) {
                return {
                    handled: true,
                    result: 'No external repositories configured.\n\nUse /add-repo <git-url|path> [--editable] to add one.',
                };
            }
            const lines = ['## Configured Repositories\n'];
            for (const repo of repos) {
                const status = repo.enabled ? '✓' : '✗';
                const type = repo.type === 'git' ? '🔗' : '📁';
                const editableLabel = repo.editable ? '(editable)' : '(read-only)';
                lines.push(`${status} ${type} **${repo.name}** ${editableLabel}`);
                lines.push(`   Source: ${repo.source}`);
                lines.push(`   Path: ${repo.localPath}`);
                const statusParts = [repo.enabled ? 'enabled' : 'disabled'];
                if (repo.editable) statusParts.push('editable');
                lines.push(`   Status: ${statusParts.join(', ')}`);
                lines.push('');
            }
            lines.push('_Use /edit-repo <name> to toggle editability_');
            return { handled: true, result: lines.join('\n') };
        }

        // Handle /add-repo <source> [name] [--editable] [--force]
        if (command === 'add-repo') {
            if (!repoManager) {
                return { handled: true, error: 'Repository manager not available' };
            }
            const parts = args.split(/\s+/);
            // Filter out flags to get source and name
            const nonFlagParts = parts.filter(p => !p.startsWith('-'));
            const source = nonFlagParts[0];
            const name = nonFlagParts[1] || undefined;
            const force = parts.includes('--force') || parts.includes('-f');
            const editable = parts.includes('--editable') || parts.includes('-e');

            try {
                const result = await repoManager.addRepository({ source, name, force, editable });
                // Update agent's skill roots and reload
                const agent = options.context?.skilledAgent;
                this._syncAgentSkillRoots(agent, repoManager);
                if (agent && typeof agent.reloadSkills === 'function') {
                    agent.reloadSkills();
                }
                return {
                    handled: true,
                    result: `✓ ${result.message}\n\nSkills have been reloaded.`,
                };
            } catch (error) {
                return { handled: true, error: error.message };
            }
        }

        // Handle /remove-repo <name> [--delete]
        if (command === 'remove-repo') {
            if (!repoManager) {
                return { handled: true, error: 'Repository manager not available' };
            }
            const parts = args.split(/\s+/);
            const name = parts[0];
            const deleteFiles = parts.includes('--delete') || parts.includes('-d');

            try {
                // Get the repo's skillsPath BEFORE removing it (for cleanup)
                const repos = repoManager.listRepositories();
                const repoToRemove = repos.find(r => r.name === name);
                const removedSkillsPath = repoToRemove?.skillsPath;

                const result = repoManager.removeRepository(name, deleteFiles);
                // Update agent's skill roots and reload
                const agent = options.context?.skilledAgent;
                this._syncAgentSkillRoots(agent, repoManager, { removedSkillsPath });
                if (agent && typeof agent.reloadSkills === 'function') {
                    agent.reloadSkills();
                }
                return {
                    handled: true,
                    result: `✓ ${result.message}\n\nSkills have been reloaded.`,
                };
            } catch (error) {
                return { handled: true, error: error.message };
            }
        }

        // Handle /update-repo [name|all]
        if (command === 'update-repo') {
            if (!repoManager) {
                return { handled: true, error: 'Repository manager not available' };
            }
            const name = args || 'all';

            try {
                const result = await repoManager.updateRepository(name);
                // Reload skills after updating repository
                const agent = options.context?.skilledAgent;
                if (agent && typeof agent.reloadSkills === 'function') {
                    agent.reloadSkills();
                }

                let message = `✓ ${result.message}`;
                if (result.results) {
                    message += '\n\n';
                    for (const r of result.results) {
                        message += r.success ? `  ✓ ${r.name}\n` : `  ✗ ${r.name}: ${r.error}\n`;
                    }
                }
                message += '\nSkills have been reloaded.';
                return { handled: true, result: message };
            } catch (error) {
                return { handled: true, error: error.message };
            }
        }

        // Handle /enable-repo <name>
        if (command === 'enable-repo') {
            if (!repoManager) {
                return { handled: true, error: 'Repository manager not available' };
            }
            try {
                const result = repoManager.setRepositoryEnabled(args, true);
                // Update agent's skill roots and reload
                const agent = options.context?.skilledAgent;
                this._syncAgentSkillRoots(agent, repoManager);
                if (agent && typeof agent.reloadSkills === 'function') {
                    agent.reloadSkills();
                }
                return {
                    handled: true,
                    result: `✓ ${result.message}\n\nSkills have been reloaded.`,
                };
            } catch (error) {
                return { handled: true, error: error.message };
            }
        }

        // Handle /disable-repo <name>
        if (command === 'disable-repo') {
            if (!repoManager) {
                return { handled: true, error: 'Repository manager not available' };
            }
            try {
                const result = repoManager.setRepositoryEnabled(args, false);
                // Update agent's skill roots and reload
                const agent = options.context?.skilledAgent;
                this._syncAgentSkillRoots(agent, repoManager);
                if (agent && typeof agent.reloadSkills === 'function') {
                    agent.reloadSkills();
                }
                return {
                    handled: true,
                    result: `✓ ${result.message}\n\nSkills have been reloaded.`,
                };
            } catch (error) {
                return { handled: true, error: error.message };
            }
        }

        // Handle /edit-repo <name> - toggle editable status
        if (command === 'edit-repo') {
            if (!repoManager) {
                return { handled: true, error: 'Repository manager not available' };
            }
            try {
                // Get current editable status and toggle it
                const repos = repoManager.listRepositories();
                const repo = repos.find(r => r.name === args);
                if (!repo) {
                    const available = repos.map(r => r.name).join(', ') || 'none';
                    return { handled: true, error: `Repository "${args}" not found. Available: ${available}` };
                }
                const newEditable = !repo.editable;
                const result = repoManager.setRepositoryEditable(args, newEditable);
                return {
                    handled: true,
                    result: `✓ ${result.message}`,
                };
            } catch (error) {
                return { handled: true, error: error.message };
            }
        }

        // Handle /ls --repo <name> - filter skills by repository
        if ((command === 'ls' || command === 'list') && args && args.includes('--repo')) {
            const repoManager = options.context?.repoManager;
            if (!repoManager) {
                return { handled: true, error: 'Repository manager not available' };
            }

            // Parse args: could be "all --repo name" or "--repo name" or "--repo name all"
            const parts = args.split(/\s+/);
            const repoIndex = parts.indexOf('--repo');
            const repoName = parts[repoIndex + 1];
            const showAll = parts.includes('all');

            if (!repoName || repoName === 'all') {
                return { handled: true, error: 'Usage: /ls --repo <name> [all]' };
            }

            // Find the repository
            const repos = repoManager.listRepositories();
            const repo = repos.find(r => r.name === repoName);
            if (!repo) {
                const available = repos.map(r => r.name).join(', ') || 'none';
                return { handled: true, error: `Repository "${repoName}" not found. Available: ${available}` };
            }

            if (!repo.enabled) {
                return { handled: true, error: `Repository "${repoName}" is disabled. Use /enable-repo ${repoName} first.` };
            }

            // Get skills and filter by repo path
            const allSkills = showAll ? this.getSkills() : this.getUserSkills();
            const repoSkillsPath = repo.skillsPath || `${repo.localPath}/.AchillesSkills`;
            const filteredSkills = allSkills.filter(s => s.skillDir?.startsWith(repoSkillsPath));

            if (filteredSkills.length === 0) {
                return {
                    handled: true,
                    result: `No skills found in repository "${repoName}".\n\nPath: ${repoSkillsPath}`,
                };
            }

            // Format output
            const lines = [`## Skills in "${repoName}" (${filteredSkills.length})\n`];
            for (const skill of filteredSkills) {
                const name = skill.shortName || skill.name;
                const type = skill.type || 'unknown';
                const summary = skill.summary || skill.description || '';
                lines.push(`**[${type}] ${name}**`);
                if (summary) {
                    lines.push(`   ${summary}`);
                }
                lines.push('');
            }
            return { handled: true, result: lines.join('\n') };
        }

        // Execute the mapped skill
        try {
            // For list-skills, use 'list' as default input since the skill requires non-empty input
            let input = args || '';
            if (!input && (command === 'ls' || command === 'list')) {
                input = 'list';
            }
            const result = await this.executeSkill(cmdDef.skill, input, options);
            return {
                handled: true,
                result: formatSlashResult(result),
            };
        } catch (error) {
            return {
                handled: true,
                error: error.message,
            };
        }
    }

    /**
     * Get autocomplete suggestions for slash commands.
     * @param {string} line - Current input line
     * @returns {[string[], string]} - [completions, original line]
     */
    getCompletions(line) {
        const completions = [];

        // If line starts with /, provide slash command completions
        if (line.startsWith('/')) {
            const parsed = this.parseSlashCommand(line);
            if (!parsed) {
                // Just "/" typed - show all commands
                const allCmds = Object.keys(SlashCommandHandler.COMMANDS)
                    .filter((cmd, idx, arr) => arr.indexOf(cmd) === idx) // unique
                    .map(cmd => `/${cmd}`);
                allCmds.push('/help', '/commands');
                return [allCmds, line];
            }

            const { command, args } = parsed;

            // Check if we're completing the command name or arguments
            if (!args && !line.includes(' ')) {
                // Completing command name
                const cmdPrefix = command.toLowerCase();
                const matchingCmds = Object.keys(SlashCommandHandler.COMMANDS)
                    .filter(cmd => cmd.startsWith(cmdPrefix))
                    .map(cmd => `/${cmd}`);

                // Add built-in commands
                if ('help'.startsWith(cmdPrefix)) matchingCmds.push('/help');
                if ('commands'.startsWith(cmdPrefix)) matchingCmds.push('/commands');
                if ('raw'.startsWith(cmdPrefix)) matchingCmds.push('/raw');
                if ('quit'.startsWith(cmdPrefix)) matchingCmds.push('/quit');
                if ('exit'.startsWith(cmdPrefix)) matchingCmds.push('/exit');

                return [matchingCmds, line];
            }

            // Completing arguments - suggest skill names for relevant commands
            const cmdDef = SlashCommandHandler.COMMANDS[command];
            if (cmdDef) {
                const argPrefix = args.toLowerCase();

                // For commands that take skill names, suggest user skills
                if (['read', 'delete', 'validate', 'generate', 'test', 'refine', 'update', 'specs', 'specs-write', 'write-tests'].includes(command)) {
                    const skills = this.getUserSkills();
                    const matchingSkills = skills
                        .map(s => s.shortName || s.name)
                        .filter(name => name.toLowerCase().startsWith(argPrefix))
                        .map(name => `/${command} ${name}`);
                    return [matchingSkills, line];
                }

                // For /template, suggest skill types
                if (command === 'template') {
                    const types = ['tskill', 'cskill', 'cgskill', 'iskill', 'oskill', 'mskill'];
                    const matchingTypes = types
                        .filter(t => t.startsWith(argPrefix))
                        .map(t => `/${command} ${t}`);
                    return [matchingTypes, line];
                }

                // For /exec, suggest all skills including built-in
                if (command === 'exec') {
                    const skills = this.getSkills();
                    const matchingSkills = skills
                        .map(s => s.shortName || s.name)
                        .filter(name => name.toLowerCase().startsWith(argPrefix))
                        .map(name => `/${command} ${name}`);
                    return [matchingSkills, line];
                }

                // For /write, suggest skill types as second argument
                if (command === 'write' && args.includes(' ')) {
                    const parts = args.split(/\s+/);
                    const typePrefix = parts[1]?.toLowerCase() || '';
                    const types = ['tskill', 'cskill', 'cgskill', 'iskill', 'oskill', 'mskill'];
                    const matchingTypes = types
                        .filter(t => t.startsWith(typePrefix))
                        .map(t => `/${command} ${parts[0]} ${t}`);
                    return [matchingTypes, line];
                }

                // For repository commands that take repo names, suggest configured repos
                if (['remove-repo', 'update-repo', 'enable-repo', 'disable-repo', 'edit-repo'].includes(command)) {
                    const repos = this.getRepositories();
                    const matchingRepos = repos
                        .map(r => r.name)
                        .filter(name => name.toLowerCase().startsWith(argPrefix))
                        .map(name => `/${command} ${name}`);
                    // For update-repo, also suggest "all"
                    if (command === 'update-repo' && 'all'.startsWith(argPrefix)) {
                        matchingRepos.unshift(`/${command} all`);
                    }
                    return [matchingRepos, line];
                }

                // For /ls and /list with --repo, suggest repo names
                if ((command === 'ls' || command === 'list') && args.includes('--repo')) {
                    const repos = this.getRepositories();
                    const parts = args.split(/\s+/);
                    const repoIndex = parts.indexOf('--repo');
                    const repoPrefix = (parts[repoIndex + 1] || '').toLowerCase();

                    // Only complete if we're after --repo
                    if (repoIndex >= 0 && (parts.length === repoIndex + 1 || parts.length === repoIndex + 2)) {
                        const matchingRepos = repos
                            .filter(r => r.enabled)
                            .map(r => r.name)
                            .filter(name => name.toLowerCase().startsWith(repoPrefix))
                            .map(name => {
                                const prefix = parts.slice(0, repoIndex + 1).join(' ');
                                return `/${command} ${prefix} ${name}`;
                            });
                        return [matchingRepos, line];
                    }
                }

                // For /ls and /list, suggest "all" and "--repo"
                if ((command === 'ls' || command === 'list') && !args.includes('--repo')) {
                    const suggestions = [];
                    if ('all'.startsWith(argPrefix)) {
                        suggestions.push(`/${command} all`);
                    }
                    if ('--repo'.startsWith(argPrefix)) {
                        suggestions.push(`/${command} --repo`);
                    }
                    if (args === 'all ' || (args === 'all' && line.endsWith(' '))) {
                        suggestions.push(`/${command} all --repo`);
                    }
                    if (suggestions.length > 0) {
                        return [suggestions, line];
                    }
                }
            }
        }

        // For non-slash commands, provide basic command completions
        const basicCmds = ['help', 'reload', 'list', 'list all', 'history', 'exit'];
        const matches = basicCmds.filter(cmd => cmd.startsWith(line.toLowerCase()));
        return [matches, line];
    }

    /**
     * Get hint text for current input.
     * @param {string} line - Current input line
     * @returns {string|null} - Hint text or null
     */
    getInputHint(line) {
        if (!line.startsWith('/')) return null;

        const parsed = this.parseSlashCommand(line);
        if (!parsed) {
            return 'Type a command name (Tab to complete)';
        }

        const { command, args } = parsed;

        // Check for built-in help commands
        if (command === 'help' || command === '?' || command === 'commands') {
            return 'Show available slash commands';
        }

        // Check for /raw command
        if (command === 'raw') {
            return 'Toggle raw output (disable markdown rendering)';
        }

        // Check for /quit and /exit commands
        if (command === 'quit' || command === 'exit' || command === 'q') {
            return 'Exit the REPL';
        }

        const cmdDef = SlashCommandHandler.COMMANDS[command];
        if (!cmdDef) {
            // Check for partial matches
            const partialMatches = Object.keys(SlashCommandHandler.COMMANDS)
                .filter(cmd => cmd.startsWith(command));
            if (partialMatches.length > 0) {
                return `Did you mean: ${partialMatches.map(c => '/' + c).join(', ')}?`;
            }
            return 'Unknown command. Type /help for available commands.';
        }

        // Show usage hint if no args provided for required args command
        if (cmdDef.args === 'required' && !args) {
            return `${cmdDef.description} — ${cmdDef.usage}`;
        }

        // Show description when args are provided
        return cmdDef.description;
    }

    /**
     * Print slash command help.
     * Delegates to HelpSystem for comprehensive help.
     */
    printHelp() {
        const helpText = showHelp('commands');
        console.log(helpText);
    }
}

export default SlashCommandHandler;
