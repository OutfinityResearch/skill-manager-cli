/**
 * find-skill - Search for files with validated flags
 *
 * Uses bash-style coloring:
 *   Bold Blue  = directory
 *   Bold Green = executable
 *   Cyan       = symbolic link
 *   Normal     = regular file
 */

import { lstat, access, constants } from 'node:fs/promises';
import { validatePath, validateFlags, parseInput } from '../_shared/validation.mjs';
import { executeWithPermission } from '../_shared/executor.mjs';

const ALLOWED_FLAGS = ['-name', '-type', '-mtime', '-size', '-maxdepth'];

// ANSI color codes (bash-style)
const COLORS = {
    boldBlue: '\x1b[1;34m',    // directories
    boldGreen: '\x1b[1;32m',   // executables
    boldCyan: '\x1b[1;36m',    // symbolic links
    reset: '\x1b[0m',
};

/**
 * Check if a file is executable
 */
async function isExecutable(filePath) {
    try {
        await access(filePath, constants.X_OK);
        return true;
    } catch {
        return false;
    }
}

/**
 * Add bash-style coloring to each path in the find output
 */
async function colorizeOutput(output) {
    if (!output || !output.trim()) {
        return output;
    }

    const paths = output.trim().split('\n');
    const results = await Promise.all(
        paths.map(async (filePath) => {
            if (!filePath.trim()) return '';
            try {
                // Use lstat to not follow symlinks
                const stats = await lstat(filePath);

                if (stats.isSymbolicLink()) {
                    return `${COLORS.boldCyan}${filePath}${COLORS.reset}`;
                } else if (stats.isDirectory()) {
                    return `${COLORS.boldBlue}${filePath}${COLORS.reset}`;
                } else if (stats.isFile()) {
                    // Check if executable
                    if (await isExecutable(filePath)) {
                        return `${COLORS.boldGreen}${filePath}${COLORS.reset}`;
                    }
                    return filePath; // Regular file, no color
                }
                return filePath;
            } catch {
                return filePath;
            }
        })
    );

    return results.filter(Boolean).join('\n');
}

export async function action(agent, prompt) {
    const { path, flags = [], flagArgs = {} } = parseInput(prompt);

    // Validate path
    const pathCheck = validatePath(path);
    if (!pathCheck.valid) {
        return `Error: ${pathCheck.error}`;
    }

    // Validate flags
    const allFlags = [...flags, ...Object.keys(flagArgs)];
    const flagCheck = validateFlags(allFlags, ALLOWED_FLAGS);
    if (!flagCheck.valid) {
        return `Error: ${flagCheck.error}`;
    }

    // Validate flag arguments
    for (const [flag, value] of Object.entries(flagArgs)) {
        if (!value || typeof value !== 'string') {
            return `Error: ${flag} requires a value`;
        }

        // Block dangerous patterns in values
        if (/[;&|`$]/.test(value)) {
            return `Error: Invalid characters in ${flag} value`;
        }

        // Validate -type values
        if (flag === '-type' && !['f', 'd', 'l', 'b', 'c', 'p', 's'].includes(value)) {
            return `Error: -type must be one of: f, d, l, b, c, p, s`;
        }

        // Validate -maxdepth is a number
        if (flag === '-maxdepth') {
            const num = parseInt(value, 10);
            if (isNaN(num) || num < 0) {
                return `Error: -maxdepth requires a non-negative number`;
            }
        }
    }

    // Build arguments: path first, then flags with args
    const args = [pathCheck.path];
    for (const [flag, value] of Object.entries(flagArgs)) {
        args.push(flag, value);
    }

    const context = agent?.context || {};
    const result = await executeWithPermission('find', args, agent, { context });

    if (result.denied) {
        return `Execution denied: ${result.error}`;
    }

    if (!result.success) {
        return `Error: ${result.error}`;
    }

    if (!result.output) {
        return 'No files found';
    }

    // Add bash-style coloring to each result
    const colorizedOutput = await colorizeOutput(result.output);
    return colorizedOutput || 'No files found';
}

export default action;
