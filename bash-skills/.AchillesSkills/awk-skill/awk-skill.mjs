/**
 * awk-skill - Text processing with validated flags
 */

import { validatePath, validateFlags, parseInput } from '../_shared/validation.mjs';
import { executeWithPermission, buildArgs } from '../_shared/executor.mjs';

const ALLOWED_FLAGS = ['-F'];

// Dangerous AWK patterns to block
const DANGEROUS_PATTERNS = [
    /system\s*\(/i,      // system() calls
    /getline/i,          // getline can read files
    /\|/,                // pipes
    />/,                 // output redirection
    /</,                 // input redirection
    /`/,                 // backticks
    /\$\(/,              // command substitution
];

export async function action(agent, prompt) {
    const { path, pattern, flags = [], flagArgs = {} } = parseInput(prompt);

    // Validate pattern
    if (!pattern || typeof pattern !== 'string') {
        return 'Error: AWK pattern is required';
    }

    // Check for dangerous patterns
    for (const dangerous of DANGEROUS_PATTERNS) {
        if (dangerous.test(pattern)) {
            return 'Error: AWK pattern contains forbidden constructs';
        }
    }

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

    // Validate -F separator
    if (flagArgs['-F']) {
        const sep = flagArgs['-F'];
        if (typeof sep !== 'string' || sep.length > 10) {
            return 'Error: -F separator must be a short string';
        }
    }

    // Build arguments: flags, pattern, then path
    const args = buildArgs(flags, flagArgs, []);
    args.push(pattern, pathCheck.path);

    const context = agent?.context || {};
    const result = await executeWithPermission('awk', args, agent, { context });

    if (result.denied) {
        return `Execution denied: ${result.error}`;
    }

    if (!result.success) {
        return `Error: ${result.error}`;
    }

    return result.output;
}

export default action;
