/**
 * NaturalLanguageProcessor - Handles LLM processing with abort capability.
 *
 * Extracted from REPLSession to improve modularity and reduce file size.
 */

import readline from 'node:readline';
import { ActionReporter } from 'achilles-agent-lib/utils/ActionReporter.mjs';
import { createSpinner } from '../ui/spinner.mjs';
import { renderMarkdown } from '../ui/MarkdownRenderer.mjs';

/**
 * NaturalLanguageProcessor class for handling LLM interactions.
 */
export class NaturalLanguageProcessor {
    /**
     * Create a new NaturalLanguageProcessor.
     *
     * @param {Object} options - Processor options
     * @param {Object} options.agent - The RecursiveSkilledAgent instance
     * @param {Function} options.processPrompt - Callback to process prompts
     * @param {HistoryManager} options.historyManager - Command history manager
     * @param {Function} options.isMarkdownEnabled - Callback to check markdown state
     */
    constructor(options) {
        this.agent = options.agent;
        this.processPrompt = options.processPrompt;
        this.historyManager = options.historyManager;
        this.isMarkdownEnabled = options.isMarkdownEnabled || (() => true);
    }

    /**
     * Process a natural language prompt through the LLM.
     * @param {string} input - The user input
     */
    async process(input) {
        // Create AbortController for ESC cancellation
        const abortController = new AbortController();
        let wasInterrupted = false;

        // Create ActionReporter for real-time feedback (Claude Code style)
        const actionReporter = new ActionReporter({
            mode: 'spinner',
            spinnerFactory: createSpinner,  // Inject spinner implementation
            showInterruptHint: true,
        });
        this.agent.setActionReporter(actionReporter);

        // Set up ESC key listener
        const handleKeypress = (key) => {
            // ESC key
            if (key === '\x1b' || key === '\u001b') {
                wasInterrupted = true;
                abortController.abort();
            }
        };

        // Enable raw mode to capture individual keypresses
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(true);
            process.stdin.resume();
            process.stdin.on('data', handleKeypress);
        }

        // Set up a prompt reader that pauses the reporter during user input
        this.agent.promptReader = async (prompt) => {
            // Pause the action reporter while waiting for user input
            actionReporter.pause();

            // Temporarily disable raw mode for readline
            if (process.stdin.isTTY) {
                process.stdin.setRawMode(false);
                process.stdin.removeListener('data', handleKeypress);
            }

            return new Promise((resolve) => {
                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout,
                });
                rl.question(prompt, (answer) => {
                    rl.close();
                    // Re-enable raw mode and ESC listener
                    if (process.stdin.isTTY) {
                        process.stdin.setRawMode(true);
                        process.stdin.on('data', handleKeypress);
                    }
                    // Resume the action reporter after user responds
                    actionReporter.resume();
                    resolve(answer);
                });
            });
        };

        // Start with initial "Thinking" action
        actionReporter.thinking();

        try {
            const result = await this.processPrompt(input, {
                signal: abortController.signal,
            });

            // Show actual model used
            const lastInvocation = this.agent.llmAgent.invokerStrategy?.getLastInvocationDetails?.();
            const modelInfo = lastInvocation?.model ? ` [${lastInvocation.model}]` : '';

            // Complete any remaining actions and show final status
            actionReporter.reset();
            const elapsed = actionReporter.history.length > 0
                ? actionReporter.history[actionReporter.history.length - 1]?.duration
                : null;
            const durationInfo = elapsed ? ` (${(elapsed / 1000).toFixed(1)}s)` : '';
            console.log(`✓ Done${modelInfo}${durationInfo}`);

            console.log('-'.repeat(60));
            console.log(this.isMarkdownEnabled() ? renderMarkdown(result) : result);
            console.log('-'.repeat(60) + '\n');
        } catch (error) {
            if (wasInterrupted || error.name === 'AbortError') {
                actionReporter.interrupted('Operation cancelled');
                console.log('');
            } else {
                const lastInvocation = this.agent.llmAgent.invokerStrategy?.getLastInvocationDetails?.();
                const modelInfo = lastInvocation?.model ? ` [${lastInvocation.model}]` : '';
                actionReporter.failAction(error);
                console.error(`\n${error.message}\n`);
            }
        } finally {
            // Clean up ESC listener
            if (process.stdin.isTTY) {
                process.stdin.setRawMode(false);
                process.stdin.removeListener('data', handleKeypress);
            }

            // Clean up reporter and prompt reader
            this.agent.setActionReporter(null);
            this.agent.promptReader = null;

            // Save command to history (unless interrupted)
            if (!wasInterrupted) {
                this.historyManager.add(input);
            }
        }
    }
}

export default NaturalLanguageProcessor;
