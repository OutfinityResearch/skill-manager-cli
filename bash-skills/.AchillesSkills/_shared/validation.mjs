/**
 * Shared validation utilities for bash command skills
 */

/**
 * Validate a path to prevent directory traversal attacks
 * @param {string} path - The path to validate
 * @returns {{valid: boolean, path?: string, error?: string}}
 */
export function validatePath(path) {
    if (!path || typeof path !== 'string') {
        return { valid: false, error: 'Path is required' };
    }

    const trimmed = path.trim();
    if (trimmed.length === 0) {
        return { valid: false, error: 'Path cannot be empty' };
    }

    // Check for dangerous patterns
    if (trimmed.includes('..')) {
        return { valid: false, error: 'Path traversal (..) not allowed' };
    }

    // Block shell expansion patterns
    if (/\$\(|`|\$\{/.test(trimmed)) {
        return { valid: false, error: 'Shell expansion not allowed' };
    }

    // Block pipes and redirects
    if (/[|><]/.test(trimmed)) {
        return { valid: false, error: 'Pipes and redirects not allowed' };
    }

    // Block command chaining
    if (/[;&]/.test(trimmed)) {
        return { valid: false, error: 'Command chaining not allowed' };
    }

    return { valid: true, path: trimmed };
}

/**
 * Validate flags against an allowlist
 * @param {string[]} flags - Array of flags to validate
 * @param {string[]} allowlist - Array of allowed flags
 * @returns {{valid: boolean, error?: string}}
 */
export function validateFlags(flags, allowlist) {
    if (!Array.isArray(flags)) {
        return { valid: false, error: 'Flags must be an array' };
    }

    const invalid = flags.filter(f => !allowlist.includes(f));
    if (invalid.length > 0) {
        return {
            valid: false,
            error: `Invalid flags: ${invalid.join(', ')}. Allowed: ${allowlist.join(', ')}`
        };
    }

    return { valid: true };
}

/**
 * Validate flag arguments (e.g., -n 10)
 * @param {Object} flagArgs - Map of flag to argument value
 * @param {Object} allowedArgs - Map of flag to validation function
 * @returns {{valid: boolean, error?: string}}
 */
export function validateFlagArgs(flagArgs, allowedArgs) {
    if (!flagArgs || typeof flagArgs !== 'object') {
        return { valid: true }; // No args to validate
    }

    for (const [flag, value] of Object.entries(flagArgs)) {
        const validator = allowedArgs[flag];
        if (!validator) {
            return { valid: false, error: `Flag ${flag} does not accept arguments` };
        }

        const result = validator(value);
        if (!result.valid) {
            return { valid: false, error: `Invalid argument for ${flag}: ${result.error}` };
        }
    }

    return { valid: true };
}

/**
 * Parse input prompt to extract path and flags
 * @param {string|Object} prompt - Input prompt
 * @returns {{path: string|null, flags: string[], flagArgs: Object, pattern?: string}}
 */
export function parseInput(prompt) {
    if (!prompt) {
        return { path: null, flags: [], flagArgs: {} };
    }

    // Handle JSON input
    if (typeof prompt === 'string') {
        try {
            const parsed = JSON.parse(prompt);
            return {
                path: parsed.path || null,
                flags: parsed.flags || [],
                flagArgs: parsed.flagArgs || {},
                pattern: parsed.pattern || null,
            };
        } catch {
            // Not JSON, treat as path
            return { path: prompt.trim(), flags: [], flagArgs: {} };
        }
    }

    // Handle object input
    return {
        path: prompt.path || null,
        flags: prompt.flags || [],
        flagArgs: prompt.flagArgs || {},
        pattern: prompt.pattern || null,
    };
}
