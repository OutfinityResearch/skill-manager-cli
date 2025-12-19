/**
 * tree-skill - Display directory tree with validated flags
 *
 * Uses bash-style coloring (-C flag):
 *   Bold Blue  = directory
 *   Bold Green = executable
 *   Cyan       = symbolic link
 *   Normal     = regular file
 *
 * Also uses -F flag for type indicators (/, *, @)
 */

import { validatePath, validateFlags, parseInput } from '../_shared/validation.mjs';
import { executeWithPermission, buildArgs } from '../_shared/executor.mjs';

const ALLOWED_FLAGS = ['-L', '-d', '-a', '-I', '-f', '-F', '-C'];

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
        if (flag === '-L') {
            const num = parseInt(value, 10);
            if (isNaN(num) || num <= 0) {
                return `Error: -L requires a positive number`;
            }
        }

        if (flag === '-I') {
            // Block dangerous patterns
            if (/[;&|`$]/.test(value)) {
                return `Error: Invalid characters in -I pattern`;
            }
        }
    }

    // Always add -F flag to differentiate files from directories
    const effectiveFlags = [...flags];
    if (!effectiveFlags.includes('-F')) {
        effectiveFlags.push('-F');
    }

    // Always add -C flag for bash-style coloring
    if (!effectiveFlags.includes('-C')) {
        effectiveFlags.push('-C');
    }

    // Build arguments and execute with permission
    const args = buildArgs(effectiveFlags, flagArgs, pathCheck.path);
    const context = agent?.context || {};
    const result = await executeWithPermission('tree', args, agent, { context });

    if (result.denied) {
        return `Execution denied: ${result.error}`;
    }

    if (!result.success) {
        // tree might not be installed
        if (result.error?.includes('not found')) {
            return 'Error: tree command not found. Install with: apt install tree (or equivalent)';
        }
        return `Error: ${result.error}`;
    }

    return result.output;
}

export default action;
