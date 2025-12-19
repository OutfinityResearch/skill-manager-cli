/**
 * sed-skill - Stream editor with validated flags
 */

import { validatePath, validateFlags, parseInput } from '../_shared/validation.mjs';
import { executeWithPermission } from '../_shared/executor.mjs';

const ALLOWED_FLAGS = ['-n', '-e'];

// Dangerous SED patterns to block
const DANGEROUS_PATTERNS = [
    /\bw\s+\S/,          // w command (write to file)
    /\be\b/,             // e command (execute)
    /\br\s+\S/,          // r command (read file)
    /`/,                 // backticks
    /\$\(/,              // command substitution
];

export async function action(agent, prompt) {
    const { path, pattern, flags = [] } = parseInput(prompt);

    // Validate pattern
    if (!pattern || typeof pattern !== 'string') {
        return 'Error: SED pattern is required';
    }

    // Check for dangerous patterns
    for (const dangerous of DANGEROUS_PATTERNS) {
        if (dangerous.test(pattern)) {
            return 'Error: SED pattern contains forbidden constructs';
        }
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
    // Note: -i (in-place editing) is intentionally not allowed
    const args = [...flags, pattern, pathCheck.path];

    const context = agent?.context || {};
    const result = await executeWithPermission('sed', args, agent, { context });

    if (result.denied) {
        return `Execution denied: ${result.error}`;
    }

    if (!result.success) {
        return `Error: ${result.error}`;
    }

    return result.output;
}

export default action;
