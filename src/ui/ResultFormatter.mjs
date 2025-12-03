/**
 * ResultFormatter - Stateless utility functions for formatting skill execution results.
 *
 * Extracted from SkillManagerCli to reduce file size and improve modularity.
 */

/**
 * Summarize an orchestrator result for non-debug output.
 * Handles orchestrator results with executions, simple results, and fallbacks.
 *
 * @param {*} result - The result to summarize
 * @returns {string} - Human-readable summary
 */
export function summarizeResult(result) {
    if (!result || typeof result !== 'object') {
        return String(result);
    }

    const lines = [];

    // Unwrap nested result if present (orchestrator returns { result: { executions, ... } })
    const data = result.result && typeof result.result === 'object' ? result.result : result;

    // If it's an orchestrator result with executions
    if (data.executions && Array.isArray(data.executions)) {
        for (const exec of data.executions) {
            if (exec.skipped) continue;

            const skillName = exec.skill?.replace(/-code$/, '').replace(/-orchestrator$/, '') || 'unknown';
            const status = exec.error ? '✗' : '✓';

            if (exec.outcome?.result) {
                // Show the actual result from the skill execution
                const outcomeResult = exec.outcome.result;
                if (typeof outcomeResult === 'string') {
                    lines.push(outcomeResult);
                } else {
                    lines.push(JSON.stringify(outcomeResult, null, 2));
                }
            } else if (exec.error) {
                lines.push(`${status} ${skillName}: ${exec.error}`);
            }
        }

        // Add notes if present
        if (data.notes && lines.length === 0) {
            lines.push(data.notes);
        }

        return lines.length > 0 ? lines.join('\n\n') : JSON.stringify(data, null, 2);
    }

    // Fallback for non-orchestrator results
    if (result.output) {
        return result.output;
    }

    // Return the unwrapped data (or original result) as JSON
    return JSON.stringify(data, null, 2);
}

/**
 * Format slash command result for display.
 * Extracts the most relevant content from various result shapes.
 *
 * @param {*} result - The result to format
 * @returns {string} - Formatted result string
 */
export function formatSlashResult(result) {
    if (typeof result === 'string') {
        return result;
    }
    if (result?.result) {
        return typeof result.result === 'string'
            ? result.result
            : JSON.stringify(result.result, null, 2);
    }
    if (result?.output) {
        return result.output;
    }
    return JSON.stringify(result, null, 2);
}

export default {
    summarizeResult,
    formatSlashResult,
};
