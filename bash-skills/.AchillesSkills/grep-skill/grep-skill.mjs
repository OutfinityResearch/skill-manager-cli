/**
 * grep-skill - Search for patterns in files with validated flags
 */

import { validatePath, validateFlags, parseInput } from '../_shared/validation.mjs';
import { executeWithPermission } from '../_shared/executor.mjs';

const ALLOWED_FLAGS = ['-i', '-n', '-r', '-l', '-c', '-v', '-E', '-w', '-H', '-h', '-rn', '-ri', '-rni', '-rin'];

export async function action(agent, prompt) {
    const { path, pattern, flags = [] } = parseInput(prompt);

    // Validate pattern
    if (!pattern || typeof pattern !== 'string') {
        return 'Error: Search pattern is required';
    }

    // Block dangerous pattern characters
    if (/[|;&$`]/.test(pattern)) {
        return 'Error: Pattern contains forbidden characters';
    }

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

    // Build arguments: flags, then pattern, then path
    const args = [...flags, pattern, pathCheck.path];
    const context = agent?.context || {};
    const result = await executeWithPermission('grep', args, agent, { context });

    if (result.denied) {
        return `Execution denied: ${result.error}`;
    }

    // grep returns exit code 1 when no matches found - this is not an error
    if (!result.success && result.exitCode === 1) {
        return 'No matches found';
    }

    if (!result.success) {
        return `Error: ${result.error}`;
    }

    return result.output;
}

export default action;
