/**
 * Unified bash command skill - executes any command with tiered permissions
 */
import { parseCommandLine } from './parser.mjs';
import { classifyRisk, RISK_LEVELS } from './riskClassifier.mjs';
import { executeWithTieredPermission } from './permissions.mjs';
import { expandGlobsInArgs } from './globExpander.mjs';

export async function action(agent, prompt) {
    // Parse the command line
    const { command, args, raw } = parseCommandLine(prompt);

    if (!command) {
        return 'Error: No command provided. Usage: bash <command> [args...]';
    }

    // Classify the risk level (before glob expansion for safety)
    const risk = classifyRisk(command, args, raw);

    // Block dangerous patterns entirely
    if (risk.level === RISK_LEVELS.BLOCKED) {
        return `BLOCKED: ${risk.reason}\nThis command pattern is not allowed for safety.`;
    }

    // Expand glob patterns in arguments (*, ?, [], */)
    // This is needed because shell: false doesn't do glob expansion
    const expandedArgs = expandGlobsInArgs(args);

    // Execute with appropriate permission tier
    const context = agent?.context || {};
    const result = await executeWithTieredPermission(
        command,
        expandedArgs,
        agent,
        { context, risk }
    );

    if (result.denied) {
        return `Execution denied: ${result.reason}`;
    }

    if (!result.success) {
        return `Error: ${result.error}`;
    }

    return result.output || '(no output)';
}

export default action;
