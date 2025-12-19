/**
 * ls-skill - List directory contents with validated flags
 *
 * Uses bash-style coloring:
 *   Bold Blue  = directory
 *   Bold Green = executable
 *   Cyan       = symbolic link
 *   Normal     = regular file
 */

import { validatePath, validateFlags, parseInput } from '../_shared/validation.mjs';
import { executeWithPermission, buildArgs } from '../_shared/executor.mjs';

const ALLOWED_FLAGS = ['-l', '-a', '-h', '-R', '-t', '-S', '-1', '-d', '-F', '-la', '-lh', '-lah', '-laF', '-lF', '--color'];

export async function action(agent, prompt) {
    const { path, flags = [] } = parseInput(prompt);

    // Validate path
    const pathCheck = validatePath(path);
    if (!pathCheck.valid) {
        return `Error: ${pathCheck.error}`;
    }

    // Validate flags
    const flagCheck = validateFlags(flags, ALLOWED_FLAGS);
    if (!flagCheck.valid) {
        return `Error: ${flagCheck.error}`;
    }

    // Always add -F flag to differentiate files from directories
    // -F appends: / for dirs, * for executables, @ for symlinks
    const effectiveFlags = [...flags];
    if (!effectiveFlags.some(f => f.includes('F'))) {
        effectiveFlags.push('-F');
    }

    // Always add --color=always for bash-style coloring
    if (!effectiveFlags.some(f => f.includes('color'))) {
        effectiveFlags.push('--color=always');
    }

    // Build arguments and execute with permission
    const args = buildArgs(effectiveFlags, {}, pathCheck.path);
    const context = agent?.context || {};
    const result = await executeWithPermission('ls', args, agent, { context });

    if (result.denied) {
        return `Execution denied: ${result.error}`;
    }

    if (!result.success) {
        return `Error: ${result.error}`;
    }

    return result.output;
}

export default action;
