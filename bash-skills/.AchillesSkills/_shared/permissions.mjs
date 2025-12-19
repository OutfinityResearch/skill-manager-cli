/**
 * Permission Manager for Bash Command Skills
 *
 * Prompts users before executing bash commands, similar to Claude Code's permission model.
 *
 * User options:
 * - y/yes: Allow once
 * - a/all: Allow all commands of this type for the session
 * - n/no: Deny execution
 *
 * Skip permissions:
 * - SKIP_BASH_PERMISSIONS=true environment variable
 * - skipBashPermissions: true in context
 */

// ANSI color codes for styling
const c = {
    reset: '\x1b[0m',
    dim: '\x1b[2m',
    cyan: '\x1b[36m',
    yellow: '\x1b[33m',
    green: '\x1b[32m',
    red: '\x1b[31m',
};

// Box-drawing characters
const box = {
    topLeft: '╭',
    topRight: '╮',
    bottomLeft: '╰',
    bottomRight: '╯',
    horizontal: '─',
    vertical: '│',
};

/**
 * PermissionManager tracks allowed/denied commands per session
 */
class PermissionManager {
    constructor() {
        // Commands that user has chosen "allow all" for
        this.allowedCommands = new Set();
        // Commands that user has chosen "deny all" for
        this.deniedCommands = new Set();
    }

    /**
     * Check if permission checks should be skipped
     * @param {Object} context - Context object with potential skip flags
     * @returns {boolean}
     */
    isSkipEnabled(context) {
        // Check environment variable
        if (process.env.SKIP_BASH_PERMISSIONS === 'true') {
            return true;
        }
        // Check context flag (from CLI --dangerously-skip-permissions)
        if (context?.skipBashPermissions === true) {
            return true;
        }
        return false;
    }

    /**
     * Check permission for a command and prompt if necessary
     * @param {string} command - The bash command (e.g., 'ls', 'cat')
     * @param {string[]} args - Command arguments
     * @param {Object} agent - The agent with promptReader
     * @param {Object} context - Context object
     * @returns {Promise<{allowed: boolean, reason: string}>}
     */
    async checkPermission(command, args, agent, context) {
        // 1. Check if skip is enabled
        if (this.isSkipEnabled(context)) {
            return { allowed: true, reason: 'skip_enabled' };
        }

        // 2. Check "allow all" list
        if (this.allowedCommands.has(command)) {
            return { allowed: true, reason: 'always_allowed' };
        }

        // 3. Check "deny all" list
        if (this.deniedCommands.has(command)) {
            return { allowed: false, reason: 'always_denied' };
        }

        // 4. Prompt user for permission
        return this.promptUser(command, args, agent);
    }

    /**
     * Prompt user for permission to execute command
     * @param {string} command - The bash command
     * @param {string[]} args - Command arguments
     * @param {Object} agent - The agent with promptReader
     * @returns {Promise<{allowed: boolean, reason: string}>}
     */
    async promptUser(command, args, agent) {
        const cmdString = [command, ...args].join(' ');
        const promptReader = agent?.promptReader;

        // Non-interactive mode - deny by default for safety
        if (!promptReader) {
            console.log(`\n${c.yellow}● Permission Required${c.reset} ${cmdString}`);
            console.log(`${c.red}✗ Denied${c.reset} ${c.dim}No interactive prompt available. Set SKIP_BASH_PERMISSIONS=true to allow.${c.reset}`);
            return { allowed: false, reason: 'non_interactive' };
        }

        // Display command in a styled box
        const boxWidth = 60;
        const cmdDisplay = cmdString.length > boxWidth - 4
            ? cmdString.substring(0, boxWidth - 7) + '...'
            : cmdString;

        const title = ' Bash ';
        const topLine = `${box.topLeft}${box.horizontal}${c.cyan}${title}${c.reset}${box.horizontal.repeat(boxWidth - title.length - 2)}${box.topRight}`;
        const bottomLine = `${box.bottomLeft}${box.horizontal.repeat(boxWidth)}${box.bottomRight}`;

        console.log('');
        console.log(topLine);
        console.log(`${box.vertical} ${c.cyan}${cmdDisplay.padEnd(boxWidth - 2)}${c.reset}${box.vertical}`);
        console.log(bottomLine);

        try {
            const answer = await promptReader(
                `${c.dim}Allow?${c.reset} [${c.green}y${c.reset}]es / [${c.cyan}a${c.reset}]lways / [${c.red}n${c.reset}]o: `
            );

            const normalizedAnswer = (answer || '').toLowerCase().trim();

            switch (normalizedAnswer) {
                case 'y':
                case 'yes':
                    return { allowed: true, reason: 'once' };

                case 'a':
                case 'all':
                case 'always':
                    this.allowedCommands.add(command);
                    console.log(`${c.green}✓${c.reset} ${c.dim}All '${command}' commands auto-approved this session${c.reset}`);
                    return { allowed: true, reason: 'always_allowed' };

                case 'd':
                case 'deny':
                    this.deniedCommands.add(command);
                    console.log(`${c.red}✗${c.reset} ${c.dim}All '${command}' commands auto-denied this session${c.reset}`);
                    return { allowed: false, reason: 'always_denied' };

                case 'n':
                case 'no':
                default:
                    return { allowed: false, reason: 'denied' };
            }
        } catch (error) {
            // If prompting fails, deny for safety
            console.log(`${c.red}✗ Error${c.reset} Failed to get permission: ${error.message}`);
            return { allowed: false, reason: 'prompt_error' };
        }
    }

    /**
     * Reset all permissions (useful for testing)
     */
    reset() {
        this.allowedCommands.clear();
        this.deniedCommands.clear();
    }

    /**
     * Get current permission state (for debugging)
     * @returns {{allowed: string[], denied: string[]}}
     */
    getState() {
        return {
            allowed: Array.from(this.allowedCommands),
            denied: Array.from(this.deniedCommands),
        };
    }
}

// Singleton instance for the session
export const permissionManager = new PermissionManager();

// Also export the class for testing
export { PermissionManager };
