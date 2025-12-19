/**
 * sort-skill - Sort lines with validated flags
 */

import { validatePath, validateFlags, parseInput } from '../_shared/validation.mjs';
import { executeWithPermission, buildArgs } from '../_shared/executor.mjs';

const ALLOWED_FLAGS = ['-n', '-r', '-u', '-k', '-t', '-f'];

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

        // Block dangerous characters
        if (/[;&|`$]/.test(value)) {
            return `Error: Invalid characters in ${flag} value`;
        }

        // -k should be a field spec like "2" or "2,3"
        if (flag === '-k' && !/^\d+(,\d+)?$/.test(value)) {
            return 'Error: -k requires a field number (e.g., "2" or "2,3")';
        }

        // -t should be a single character
        if (flag === '-t' && value.length > 1) {
            return 'Error: -t requires a single character delimiter';
        }
    }

    // Build arguments and execute with permission
    const args = buildArgs(flags, flagArgs, pathCheck.path);
    const context = agent?.context || {};
    const result = await executeWithPermission('sort', args, agent, { context });

    if (result.denied) {
        return `Execution denied: ${result.error}`;
    }

    if (!result.success) {
        return `Error: ${result.error}`;
    }

    return result.output;
}

export default action;
