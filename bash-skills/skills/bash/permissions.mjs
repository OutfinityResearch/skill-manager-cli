/**
 * Tiered permission system for bash commands
 */
import { spawnSync } from 'node:child_process';

const c = {
    reset: '\x1b[0m',
    dim: '\x1b[2m',
    cyan: '\x1b[36m',
    yellow: '\x1b[33m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    bold: '\x1b[1m',
};

const DEFAULT_TIMEOUT = 30000;
const MAX_OUTPUT_SIZE = 1024 * 1024;

class TieredPermissionManager {
    constructor() {
        this.allowedCommands = new Set();
        this.deniedCommands = new Set();
    }

    async checkTieredPermission(command, args, agent, options = {}) {
        const { context, risk } = options;

        // Skip if enabled
        if (this.isSkipEnabled(context)) {
            return { allowed: true, reason: 'skip_enabled' };
        }

        // Check session memory
        if (this.allowedCommands.has(command)) {
            return { allowed: true, reason: 'always_allowed' };
        }
        if (this.deniedCommands.has(command)) {
            return { allowed: false, reason: 'always_denied' };
        }

        // Prompt based on risk tier
        return this.promptWithRisk(command, args, agent, risk);
    }

    async promptWithRisk(command, args, agent, risk) {
        const cmdString = [command, ...args].join(' ');
        const promptReader = agent?.promptReader;

        if (!promptReader) {
            console.log(`${c.yellow}Permission Required${c.reset} ${cmdString}`);
            console.log(`${c.red}Denied (non-interactive)${c.reset}`);
            return { allowed: false, reason: 'non_interactive' };
        }

        // Display warning based on risk
        console.log('');
        if (risk.level === 'dangerous') {
            console.log(`${c.red}${c.bold}DANGEROUS COMMAND${c.reset}`);
            console.log(`${c.red}${risk.reason}${c.reset}`);
        } else if (risk.level === 'caution') {
            console.log(`${c.yellow}Caution${c.reset}`);
            console.log(`${c.yellow}${risk.reason}${c.reset}`);
        }

        console.log(`${c.cyan}$ ${cmdString}${c.reset}`);

        // Different prompt text for dangerous
        const promptText = risk.level === 'dangerous'
            ? `${c.red}Type "yes" to confirm:${c.reset} `
            : `Allow? [${c.green}y${c.reset}]es / [${c.cyan}a${c.reset}]lways / [${c.red}n${c.reset}]o: `;

        const answer = await promptReader(promptText);
        const normalized = (answer || '').toLowerCase().trim();

        // Dangerous commands require explicit "yes"
        if (risk.level === 'dangerous') {
            if (normalized === 'yes') {
                return { allowed: true, reason: 'explicit_yes' };
            }
            return { allowed: false, reason: 'not_confirmed' };
        }

        // Standard permission flow
        switch (normalized) {
            case 'y': case 'yes':
                return { allowed: true, reason: 'once' };
            case 'a': case 'all': case 'always':
                this.allowedCommands.add(command);
                return { allowed: true, reason: 'always_allowed' };
            default:
                return { allowed: false, reason: 'denied' };
        }
    }

    isSkipEnabled(context) {
        return process.env.SKIP_BASH_PERMISSIONS === 'true'
            || context?.skipBashPermissions === true;
    }
}

const permissionManager = new TieredPermissionManager();

export async function executeWithTieredPermission(command, args, agent, options) {
    const { context, risk } = options;

    const permission = await permissionManager.checkTieredPermission(
        command, args, agent, { context, risk }
    );

    if (!permission.allowed) {
        return { success: false, denied: true, reason: permission.reason };
    }

    // Execute the command
    try {
        const result = spawnSync(command, args, {
            encoding: 'utf-8',
            timeout: DEFAULT_TIMEOUT,
            maxBuffer: MAX_OUTPUT_SIZE,
            shell: false,
        });

        if (result.error) {
            if (result.error.code === 'ENOENT') {
                return { success: false, error: `Command not found: ${command}` };
            }
            return { success: false, error: result.error.message };
        }

        if (result.status !== 0) {
            return {
                success: false,
                error: result.stderr?.trim() || `Exit code: ${result.status}`,
                output: result.stdout?.trim()
            };
        }

        return { success: true, output: result.stdout?.trim() || '' };
    } catch (error) {
        return { success: false, error: error.message };
    }
}
