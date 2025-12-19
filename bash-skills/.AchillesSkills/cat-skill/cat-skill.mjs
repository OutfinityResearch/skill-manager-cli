/**
 * cat-skill - Display file contents with validated flags
 */

import { validatePath, validateFlags, parseInput } from '../_shared/validation.mjs';
import { executeWithPermission, buildArgs } from '../_shared/executor.mjs';

const ALLOWED_FLAGS = ['-n', '-b', '-s', '-A', '-E', '-T'];

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

    // Build arguments and execute with permission
    const args = buildArgs(flags, {}, pathCheck.path);
    const context = agent?.context || {};
    const result = await executeWithPermission('cat', args, agent, { context });

    if (result.denied) {
        return `Execution denied: ${result.error}`;
    }

    if (!result.success) {
        return `Error: ${result.error}`;
    }

    return result.output;
}

export default action;
