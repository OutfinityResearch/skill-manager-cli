/**
 * Risk classification for bash commands
 */

export const RISK_LEVELS = {
    BLOCKED: 'blocked',     // Never execute
    DANGEROUS: 'dangerous', // Red warning, explicit "yes"
    CAUTION: 'caution',     // Yellow warning
    NORMAL: 'normal'        // Standard permission
};

// Commands that are always blocked
const BLOCKED_COMMANDS = ['mkfs', 'fdisk', 'parted', 'shred'];

// Patterns that are always blocked (checked against full command)
const BLOCKED_PATTERNS = [
    /rm\s+(-[rf]+\s+)*\/\s*$/,           // rm -rf /
    /rm\s+(-[rf]+\s+)*\/\*\s*$/,         // rm -rf /*
    /:\s*\(\s*\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/, // fork bomb
    /dd\s+.*if=\/dev\/(zero|random)/,    // dd wipe
    />\s*\/dev\/sd[a-z]/,                // write to disk device
    /chmod\s+777\s+\//,                  // chmod 777 /
];

// Dangerous commands (require explicit confirmation)
const DANGEROUS_COMMANDS = new Set([
    'rm', 'rmdir', 'chmod', 'chown', 'chgrp',
    'kill', 'pkill', 'killall',
    'shutdown', 'reboot', 'halt',
    'userdel', 'groupdel',
]);

// Caution commands (yellow warning)
const CAUTION_COMMANDS = new Set([
    'mv', 'cp',
    'truncate',
    'useradd', 'groupadd', 'usermod',
]);

// Caution flags/patterns
const CAUTION_FLAGS = ['-i', '--in-place'];  // in-place editing (sed -i)
const CAUTION_PATTERNS = [/>\s+/, /\|\s+tee/];  // output redirection

export function classifyRisk(command, args, raw) {
    const cmd = command.toLowerCase();
    const fullCmd = raw.toLowerCase();

    // Check blocked patterns first
    for (const pattern of BLOCKED_PATTERNS) {
        if (pattern.test(fullCmd)) {
            return {
                level: RISK_LEVELS.BLOCKED,
                reason: 'Matches blocked dangerous pattern'
            };
        }
    }

    // Check blocked commands
    if (BLOCKED_COMMANDS.includes(cmd)) {
        return {
            level: RISK_LEVELS.BLOCKED,
            reason: `Command '${cmd}' is blocked for safety`
        };
    }

    // Check dangerous commands
    if (DANGEROUS_COMMANDS.has(cmd)) {
        return {
            level: RISK_LEVELS.DANGEROUS,
            reason: `'${cmd}' can permanently modify or delete data`,
            command: cmd
        };
    }

    // Check caution commands
    if (CAUTION_COMMANDS.has(cmd)) {
        return {
            level: RISK_LEVELS.CAUTION,
            reason: `'${cmd}' modifies files`,
            command: cmd
        };
    }

    // Check caution flags
    for (const flag of CAUTION_FLAGS) {
        if (args.includes(flag)) {
            return {
                level: RISK_LEVELS.CAUTION,
                reason: `Flag '${flag}' modifies files in-place`,
                command: cmd
            };
        }
    }

    // Check caution patterns (redirection)
    for (const pattern of CAUTION_PATTERNS) {
        if (pattern.test(fullCmd)) {
            return {
                level: RISK_LEVELS.CAUTION,
                reason: 'Output redirection can overwrite files',
                command: cmd
            };
        }
    }

    return {
        level: RISK_LEVELS.NORMAL,
        reason: null,
        command: cmd
    };
}
