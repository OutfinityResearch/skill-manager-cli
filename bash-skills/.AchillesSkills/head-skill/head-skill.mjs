/**
 * head-skill - Display first lines of a file with validated flags
 */

import { validatePath, validateFlags, parseInput } from '../_shared/validation.mjs';
import { executeWithPermission, buildArgs } from '../_shared/executor.mjs';

const ALLOWED_FLAGS = ['-n', '-c', '-q'];

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

    // Validate flag arguments are numbers
    for (const [flag, value] of Object.entries(flagArgs)) {
        if (flag === '-n' || flag === '-c') {
            const num = parseInt(value, 10);
            if (isNaN(num) || num <= 0) {
                return `Error: ${flag} requires a positive number`;
            }
        }
    }

    // Build arguments and execute with permission
    const args = buildArgs(flags, flagArgs, pathCheck.path);
    const context = agent?.context || {};
    const result = await executeWithPermission('head', args, agent, { context });

    if (result.denied) {
        return `Execution denied: ${result.error}`;
    }

    if (!result.success) {
        return `Error: ${result.error}`;
    }

    return result.output;
}

export default action;
