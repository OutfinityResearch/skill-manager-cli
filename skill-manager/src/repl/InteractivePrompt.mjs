/**
 * InteractivePrompt - Handles interactive input with command/skill selectors.
 *
 * Extracted from REPLSession to improve modularity and reduce file size.
 */

import readline from 'node:readline';
import { LineEditor } from '../ui/LineEditor.mjs';
import { showCommandSelector, showSkillSelector } from '../ui/CommandSelector.mjs';
import { SlashCommandHandler } from './SlashCommandHandler.mjs';

/**
 * InteractivePrompt class for handling user input with interactive features.
 */
export class InteractivePrompt {
    /**
     * Create a new InteractivePrompt.
     *
     * @param {Object} options - Prompt options
     * @param {HistoryManager} options.historyManager - Command history manager
     * @param {SlashCommandHandler} options.slashHandler - Slash command handler
     * @param {Array} options.commandList - List of available commands
     * @param {Function} options.getUserSkills - Callback to get user skills
     * @param {string} [options.prompt='SkillManager> '] - Prompt string
     */
    constructor(options) {
        this.historyManager = options.historyManager;
        this.slashHandler = options.slashHandler;
        this.commandList = options.commandList;
        this.getUserSkills = options.getUserSkills;
        this.promptString = options.prompt || 'SkillManager> ';

        // ANSI escape codes for hint display
        this.HINT_COLOR = '\x1b[90m'; // dim gray
        this.RESET_COLOR = '\x1b[0m';

        // Track current hint for cleanup
        this.currentHintLines = 0;
    }

    /**
     * Get input from user with interactive selector support.
     * @returns {Promise<string>} The user's input
     */
    async prompt() {
        if (!process.stdin.isTTY) {
            return this._promptOnce();
        }
        return this._promptWithSelector();
    }

    /**
     * Prompt with interactive command selector support.
     * When user types just "/" it shows an interactive picker.
     * @returns {Promise<string>}
     * @private
     */
    async _promptWithSelector() {
        const self = this;

        return new Promise((resolve) => {
            // Set up raw mode to detect "/" key immediately
            if (!process.stdin.isTTY) {
                // Fallback for non-TTY
                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout,
                });
                rl.question(self.promptString, (answer) => {
                    rl.close();
                    resolve(answer);
                });
                return;
            }

            // LineEditor handles buffer and cursor position
            const editor = new LineEditor({ prompt: self.promptString });
            let showingSelector = false;
            let savedBuffer = ''; // Save current input when navigating history
            let historyIndex = -1; // -1 means "new input", 0+ means history index from end
            const history = self.historyManager.getAll();

            // Helper to set buffer content (for history navigation)
            const rewriteLine = (newContent) => {
                editor.setBuffer(newContent);
                editor.render();
            };

            // Initial prompt render
            editor.render();

            process.stdin.setRawMode(true);
            process.stdin.resume();
            LineEditor.enableBracketedPaste();

            const cleanup = () => {
                LineEditor.disableBracketedPaste();
                process.stdin.setRawMode(false);
                process.stdin.removeListener('data', handleKey);
            };

            // Track bracketed paste state
            let inBracketedPaste = false;
            let pasteBuffer = '';

            const handleKey = async (key) => {
                const keyStr = key.toString();

                // Handle bracketed paste mode
                const PASTE_START = '\x1b[200~';
                const PASTE_END = '\x1b[201~';

                // Check for paste start marker
                if (keyStr.includes(PASTE_START)) {
                    inBracketedPaste = true;
                    // Extract content after the start marker
                    const startIdx = keyStr.indexOf(PASTE_START) + PASTE_START.length;
                    const endIdx = keyStr.indexOf(PASTE_END);
                    if (endIdx !== -1) {
                        // Complete paste in one chunk
                        const pastedText = keyStr.substring(startIdx, endIdx);
                        editor.handleBracketedPaste(pastedText);
                        editor.render();
                        inBracketedPaste = false;
                    } else {
                        // Paste continues in next chunk
                        pasteBuffer = keyStr.substring(startIdx);
                    }
                    return;
                }

                // Check for paste end marker (multi-chunk paste)
                if (inBracketedPaste) {
                    const endIdx = keyStr.indexOf(PASTE_END);
                    if (endIdx !== -1) {
                        pasteBuffer += keyStr.substring(0, endIdx);
                        editor.handleBracketedPaste(pasteBuffer);
                        editor.render();
                        pasteBuffer = '';
                        inBracketedPaste = false;
                    } else {
                        pasteBuffer += keyStr;
                    }
                    return;
                }

                // Handle Ctrl+C
                if (keyStr === '\x03') {
                    cleanup();
                    process.stdout.write('\n');
                    process.exit(0);
                }

                // Handle Enter
                if (keyStr === '\r' || keyStr === '\n') {
                    cleanup();
                    process.stdout.write('\n');
                    resolve(editor.getBuffer());
                    return;
                }

                // Handle "/" - show interactive selector (only when buffer is empty)
                if (keyStr === '/' && editor.getBuffer() === '') {
                    if (showingSelector) return;
                    showingSelector = true;

                    // Remove the raw mode listener temporarily
                    process.stdin.removeListener('data', handleKey);
                    process.stdin.setRawMode(false);

                    // Show interactive command selector
                    const selected = await showCommandSelector(self.commandList, {
                        prompt: `${self.promptString}/`,
                        initialFilter: '',
                    });

                    if (selected) {
                        // Check if selected command needs a skill argument
                        if (selected.needsSkillArg) {
                            // Show skill selector
                            process.stdout.write(`${selected.name} `);

                            // Get list of skills - use user skills only for skill-operating commands
                            const userSkills = self.getUserSkills();
                            if (userSkills.length === 0) {
                                cleanup();
                                process.stdout.write('\n');
                                console.log('\x1b[33mNo user skills found. Create one first.\x1b[0m');
                                resolve(''); // Return empty to re-prompt
                                return;
                            }

                            const selectedSkill = await showSkillSelector(userSkills, {
                                prompt: `${selected.name} `,
                                initialFilter: '',
                            });

                            if (selectedSkill) {
                                // Commands that should wait for additional input after skill selection
                                const commandsNeedingInput = ['/exec', '/refine', '/update'];
                                const commandName = selected.name;

                                if (commandsNeedingInput.includes(commandName)) {
                                    await self._handleSkillInputFlow(commandName, selectedSkill, userSkills, resolve, cleanup);
                                } else {
                                    // Other commands - execute immediately with skill name
                                    cleanup();
                                    const fullCommand = `${selected.name} ${selectedSkill.name}`;
                                    process.stdout.write(`${selectedSkill.name}\n`);
                                    resolve(fullCommand);
                                }
                            } else {
                                // User cancelled skill selection - return to prompt
                                showingSelector = false;
                                editor.clear();
                                editor.render();
                                process.stdin.setRawMode(true);
                                process.stdin.on('data', handleKey);
                            }
                        } else {
                            // Command doesn't need skill arg - execute directly
                            cleanup();
                            process.stdout.write(`${selected.name}\n`);
                            resolve(selected.name);
                        }
                    } else {
                        // User cancelled - return to normal prompt
                        showingSelector = false;
                        editor.clear();
                        editor.render();
                        process.stdin.setRawMode(true);
                        process.stdin.on('data', handleKey);
                    }
                    return;
                }

                // Handle Escape
                if (keyStr === '\x1b') {
                    // Could be escape key or start of arrow sequence
                    // For now, just ignore standalone escape
                    return;
                }

                // Handle arrow keys (history navigation)
                if (keyStr === '\x1b[A') {
                    // Up arrow - go to previous (older) command
                    if (history.length === 0) return;

                    if (historyIndex === -1) {
                        // First time pressing up - save current input
                        savedBuffer = editor.getBuffer();
                    }

                    if (historyIndex < history.length - 1) {
                        historyIndex++;
                        // History is stored oldest-first, so we read from the end
                        const historyEntry = history[history.length - 1 - historyIndex];
                        rewriteLine(historyEntry);
                    }
                    return;
                }

                if (keyStr === '\x1b[B') {
                    // Down arrow - go to next (newer) command
                    if (historyIndex === -1) return; // Already at newest

                    historyIndex--;
                    if (historyIndex === -1) {
                        // Back to current input
                        rewriteLine(savedBuffer);
                    } else {
                        const historyEntry = history[history.length - 1 - historyIndex];
                        rewriteLine(historyEntry);
                    }
                    return;
                }

                // Helper to check if buffer is a command needing skill arg
                const getCommandNeedingSkillArg = () => {
                    const buf = editor.getBuffer();
                    if (!buf.startsWith('/')) return null;
                    const parsed = self.slashHandler.parseSlashCommand(buf);
                    if (!parsed) return null;
                    const { command, args } = parsed;
                    // Only trigger if no args yet (just the command)
                    if (args && args.trim()) return null;
                    const cmdDef = SlashCommandHandler.COMMANDS[command];
                    if (cmdDef && cmdDef.needsSkillArg) {
                        return { command, cmdDef };
                    }
                    return null;
                };

                // Helper to show skill selector for current command
                const showSkillSelectorForCommand = async (command) => {
                    if (showingSelector) return;
                    showingSelector = true;

                    process.stdin.removeListener('data', handleKey);
                    process.stdin.setRawMode(false);

                    // Clear the line and rewrite with space
                    process.stdout.write(` `);

                    // Use user skills only for skill-operating commands
                    const userSkills = self.getUserSkills();
                    if (userSkills.length === 0) {
                        cleanup();
                        process.stdout.write('\n');
                        console.log('\x1b[33mNo user skills found. Create one first.\x1b[0m');
                        resolve(''); // Return empty to re-prompt
                        return;
                    }

                    const selectedSkill = await showSkillSelector(userSkills, {
                        prompt: `/${command} `,
                        initialFilter: '',
                    });

                    if (selectedSkill) {
                        // Commands that should wait for additional input after skill selection
                        const commandsNeedingInput = ['exec', 'refine', 'update'];

                        if (commandsNeedingInput.includes(command)) {
                            await self._handleSkillInputFlowForCommand(command, selectedSkill, userSkills, resolve, cleanup);
                        } else {
                            // Other commands - execute immediately
                            cleanup();
                            const fullCommand = `/${command} ${selectedSkill.name}`;
                            process.stdout.write(`${selectedSkill.name}\n`);
                            resolve(fullCommand);
                        }
                    } else {
                        // User cancelled - return to prompt with buffer intact
                        showingSelector = false;
                        editor.render();
                        process.stdin.setRawMode(true);
                        process.stdin.on('data', handleKey);
                    }
                };

                // Handle Tab - show skill selector if command needs skill arg
                if (keyStr === '\t') {
                    const cmdInfo = getCommandNeedingSkillArg();
                    if (cmdInfo) {
                        await showSkillSelectorForCommand(cmdInfo.command);
                        return;
                    }
                    // Otherwise ignore Tab
                    return;
                }

                // Handle Space after command that needs skill arg
                if (keyStr === ' ') {
                    const cmdInfo = getCommandNeedingSkillArg();
                    if (cmdInfo) {
                        await showSkillSelectorForCommand(cmdInfo.command);
                        return;
                    }
                    // Fall through to LineEditor for regular space
                }

                // Delegate to LineEditor for cursor movement, editing, and character input
                const action = editor.processKey(keyStr);
                if (action === 'modified') {
                    // Reset history navigation when user edits
                    if (historyIndex !== -1) {
                        historyIndex = -1;
                        savedBuffer = '';
                    }
                    editor.render();
                    return;
                }
                if (action === 'cursor') {
                    editor.render();
                    return;
                }
                // 'none' or 'unhandled' - ignore
            };

            process.stdin.on('data', handleKey);
        });
    }

    /**
     * Handle skill input flow when command is selected with /prefix (e.g., /exec)
     * @private
     */
    async _handleSkillInputFlow(commandName, selectedSkill, userSkills, resolve, cleanup) {
        // Show hint about the skill and prompt for input
        const skillInfo = userSkills.find(s => (s.shortName || s.name) === selectedSkill.name);
        const hint = skillInfo?.description || skillInfo?.summary || '';
        const skillType = skillInfo?.type || 'skill';

        // Clear line and show skill info
        process.stdout.write(`${selectedSkill.name}\n`);
        process.stdout.write('\x1b[90m' + '─'.repeat(50) + '\x1b[0m\n');

        // Show skill type and description
        process.stdout.write(`\x1b[36m  Skill:\x1b[0m ${selectedSkill.name} \x1b[90m[${skillType}]\x1b[0m\n`);
        if (hint) {
            process.stdout.write(`\x1b[36m  About:\x1b[0m ${hint}\n`);
        }

        // Show command-specific input guidance
        if (commandName === '/exec') {
            if (skillType === 'code') {
                process.stdout.write(`\x1b[36m  Input:\x1b[0m Type your request in natural language\n`);
            } else if (skillType === 'interactive') {
                process.stdout.write(`\x1b[36m  Input:\x1b[0m Provide any initial context or press Enter to start\n`);
            } else {
                process.stdout.write(`\x1b[36m  Input:\x1b[0m Type your input or press Enter to execute\n`);
            }
        } else if (commandName === '/refine') {
            process.stdout.write(`\x1b[36m  Input:\x1b[0m Describe what to improve or requirements to meet\n`);
        } else if (commandName === '/update') {
            process.stdout.write(`\x1b[36m  Input:\x1b[0m Specify section name and new content\n`);
        }

        process.stdout.write('\x1b[90m  Ctrl+C to cancel\x1b[0m\n');
        process.stdout.write('\x1b[90m' + '─'.repeat(50) + '\x1b[0m\n');

        // Prompt for input using readline
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        let answered = false;

        // Handle Ctrl+C to cancel
        rl.on('SIGINT', () => {
            if (answered) return;
            answered = true;
            rl.close();
            process.stdout.write('\n\x1b[33mCancelled\x1b[0m\n');
            // Resolve with empty string to return to main loop
            resolve('');
        });

        rl.question(`${commandName} ${selectedSkill.name} `, (input) => {
            if (answered) return;
            answered = true;
            rl.close();
            cleanup();
            const fullCommand = `${commandName} ${selectedSkill.name} ${input}`.trim();
            resolve(fullCommand);
        });
    }

    /**
     * Handle skill input flow when command is typed without /prefix (e.g., exec)
     * @private
     */
    async _handleSkillInputFlowForCommand(command, selectedSkill, userSkills, resolve, cleanup) {
        // Show hint about the skill and prompt for input
        const skillInfo = userSkills.find(s => (s.shortName || s.name) === selectedSkill.name);
        const hint = skillInfo?.description || skillInfo?.summary || '';
        const skillType = skillInfo?.type || 'skill';

        // Clear line and show skill info
        process.stdout.write(`${selectedSkill.name}\n`);
        process.stdout.write('\x1b[90m' + '─'.repeat(50) + '\x1b[0m\n');

        // Show skill type and description
        process.stdout.write(`\x1b[36m  Skill:\x1b[0m ${selectedSkill.name} \x1b[90m[${skillType}]\x1b[0m\n`);
        if (hint) {
            process.stdout.write(`\x1b[36m  About:\x1b[0m ${hint}\n`);
        }

        // Show command-specific input guidance
        if (command === 'exec') {
            if (skillType === 'code') {
                process.stdout.write(`\x1b[36m  Input:\x1b[0m Type your request in natural language\n`);
            } else if (skillType === 'interactive') {
                process.stdout.write(`\x1b[36m  Input:\x1b[0m Provide any initial context or press Enter to start\n`);
            } else {
                process.stdout.write(`\x1b[36m  Input:\x1b[0m Type your input or press Enter to execute\n`);
            }
        } else if (command === 'refine') {
            process.stdout.write(`\x1b[36m  Input:\x1b[0m Describe what to improve or requirements to meet\n`);
        } else if (command === 'update') {
            process.stdout.write(`\x1b[36m  Input:\x1b[0m Specify section name and new content\n`);
        }

        process.stdout.write('\x1b[90m  Ctrl+C to cancel\x1b[0m\n');
        process.stdout.write('\x1b[90m' + '─'.repeat(50) + '\x1b[0m\n');

        // Prompt for input using readline
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        let answered = false;

        // Handle Ctrl+C to cancel
        rl.on('SIGINT', () => {
            if (answered) return;
            answered = true;
            rl.close();
            process.stdout.write('\n\x1b[33mCancelled\x1b[0m\n');
            // Resolve with empty string to return to main loop
            resolve('');
        });

        rl.question(`/${command} ${selectedSkill.name} `, (input) => {
            if (answered) return;
            answered = true;
            rl.close();
            cleanup();
            const fullCommand = `/${command} ${selectedSkill.name} ${input}`.trim();
            resolve(fullCommand);
        });
    }

    /**
     * Standard readline prompt (used for non-TTY or as fallback).
     * @returns {Promise<string>}
     * @private
     */
    async _promptOnce() {
        return new Promise((resolve) => {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
                history: this.historyManager.getAll().reverse(),
                historySize: this.historyManager.maxEntries,
                terminal: true,
                completer: (line) => this.slashHandler.getCompletions(line),
            });

            // Clear any previous hint
            const clearHint = () => {
                if (this.currentHintLines > 0) {
                    // Move down, clear line, move back up
                    process.stdout.write('\n\x1b[K\x1b[A');
                    this.currentHintLines = 0;
                }
            };

            // Display hint below the input line
            const showHint = (line) => {
                const hint = this.slashHandler.getInputHint(line);
                if (hint) {
                    // Save cursor position, move to next line, show hint, restore cursor
                    process.stdout.write('\x1b[s'); // Save cursor
                    process.stdout.write('\n\x1b[K'); // New line, clear it
                    process.stdout.write(`${this.HINT_COLOR}  ${hint}${this.RESET_COLOR}`);
                    process.stdout.write('\x1b[u'); // Restore cursor
                    this.currentHintLines = 1;
                } else {
                    clearHint();
                }
            };

            // Listen for line changes to update hints
            let lastLine = '';
            const lineHandler = () => {
                const currentLine = rl.line || '';
                if (currentLine !== lastLine) {
                    lastLine = currentLine;
                    if (currentLine.startsWith('/')) {
                        showHint(currentLine);
                    } else {
                        clearHint();
                    }
                }
            };

            // Poll for line changes (readline doesn't have a direct 'input' event)
            const hintInterval = setInterval(lineHandler, 100);

            rl.question(this.promptString, (answer) => {
                clearInterval(hintInterval);
                clearHint();
                rl.close();
                resolve(answer);
            });

            // Also clear hint on close
            rl.on('close', () => {
                clearInterval(hintInterval);
                clearHint();
            });
        });
    }
}

export default InteractivePrompt;
