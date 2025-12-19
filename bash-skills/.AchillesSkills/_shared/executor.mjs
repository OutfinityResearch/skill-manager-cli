/**
 * Shared command execution utilities for bash command skills
 */

import { spawnSync } from 'node:child_process';
import { permissionManager } from './permissions.mjs';

const DEFAULT_TIMEOUT = 30000; // 30 seconds
const MAX_OUTPUT_SIZE = 1024 * 1024; // 1MB

/**
 * Execute a command with arguments safely
 * @param {string} command - The command to execute
 * @param {string[]} args - Array of command arguments
 * @param {Object} options - Execution options
 * @param {number} options.timeout - Timeout in milliseconds
 * @param {string} options.cwd - Working directory
 * @returns {{success: boolean, output?: string, error?: string, exitCode?: number}}
 */
export function executeCommand(command, args, options = {}) {
    const { timeout = DEFAULT_TIMEOUT, cwd } = options;

    try {
        const result = spawnSync(command, args, {
            encoding: 'utf-8',
            timeout,
            cwd,
            maxBuffer: MAX_OUTPUT_SIZE,
            shell: false, // IMPORTANT: no shell to prevent injection
        });

        if (result.error) {
            // Handle spawn errors (e.g., command not found)
            if (result.error.code === 'ENOENT') {
                return { success: false, error: `Command not found: ${command}` };
            }
            if (result.error.code === 'ETIMEDOUT') {
                return { success: false, error: `Command timed out after ${timeout}ms` };
            }
            return { success: false, error: result.error.message };
        }

        if (result.status !== 0) {
            // Command executed but returned non-zero
            const errorMsg = result.stderr?.trim() || `Exit code: ${result.status}`;
            return {
                success: false,
                error: errorMsg,
                exitCode: result.status,
                output: result.stdout?.trim(), // Include stdout even on error for some commands
            };
        }

        return {
            success: true,
            output: result.stdout?.trim() || '',
            exitCode: 0,
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Build command arguments from flags and flag arguments
 * @param {string[]} flags - Simple flags like ['-l', '-a']
 * @param {Object} flagArgs - Flags with arguments like {'-n': '10'}
 * @param {string|string[]} paths - Path(s) to append at the end
 * @returns {string[]} Combined argument array
 */
export function buildArgs(flags = [], flagArgs = {}, paths = []) {
    const args = [...flags];

    // Add flags with arguments
    for (const [flag, value] of Object.entries(flagArgs)) {
        args.push(flag);
        if (value !== true && value !== null) {
            args.push(String(value));
        }
    }

    // Add paths at the end
    if (Array.isArray(paths)) {
        args.push(...paths);
    } else if (paths) {
        args.push(paths);
    }

    return args;
}

/**
 * Format command output for display
 * @param {string} output - Command output
 * @param {Object} options - Formatting options
 * @param {number} options.maxLines - Maximum lines to return
 * @param {boolean} options.trim - Whether to trim whitespace
 * @returns {string} Formatted output
 */
export function formatOutput(output, options = {}) {
    const { maxLines = 0, trim = true } = options;

    if (!output) return '';

    let result = trim ? output.trim() : output;

    if (maxLines > 0) {
        const lines = result.split('\n');
        if (lines.length > maxLines) {
            result = lines.slice(0, maxLines).join('\n');
            result += `\n... (${lines.length - maxLines} more lines)`;
        }
    }

    return result;
}

/**
 * Execute a command with permission checking
 *
 * Prompts user for permission before executing. Supports:
 * - Allow once (y)
 * - Allow all of this command type (a)
 * - Deny (n)
 *
 * Skip permissions with:
 * - SKIP_BASH_PERMISSIONS=true environment variable
 * - skipBashPermissions: true in context
 *
 * @param {string} command - The command to execute
 * @param {string[]} args - Array of command arguments
 * @param {Object} agent - The agent (with promptReader for interactive prompts)
 * @param {Object} options - Execution options
 * @param {Object} options.context - Context with potential skip flags
 * @param {number} options.timeout - Timeout in milliseconds
 * @param {string} options.cwd - Working directory
 * @returns {Promise<{success: boolean, output?: string, error?: string, denied?: boolean}>}
 */
export async function executeWithPermission(command, args, agent, options = {}) {
    const { context, timeout, cwd } = options;

    // Check permission before executing
    const permission = await permissionManager.checkPermission(
        command,
        args,
        agent,
        context
    );

    if (!permission.allowed) {
        return {
            success: false,
            error: `Command denied: ${permission.reason}`,
            denied: true,
        };
    }

    // Execute if permission granted
    return executeCommand(command, args, { timeout, cwd });
}
