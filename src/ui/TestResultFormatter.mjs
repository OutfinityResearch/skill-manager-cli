/**
 * Test Result Formatter
 *
 * Formats test results for display in the CLI.
 */

// ANSI color codes
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m',
};

/**
 * Format duration in human-readable form
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration
 */
export function formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Format a single test result
 * @param {Object} result - Test result object
 * @returns {string} Formatted result string
 */
export function formatTestResult(result) {
    const lines = [];
    const { skillName, success, passed, failed, duration, errors } = result;

    // Status indicator
    const status = success
        ? `${colors.green}✓ PASS${colors.reset}`
        : `${colors.red}✗ FAIL${colors.reset}`;

    // Main line
    const durationStr = duration ? ` ${colors.gray}(${formatDuration(duration)})${colors.reset}` : '';
    lines.push(`${status} ${skillName}${durationStr}`);

    // Pass/fail counts if available
    if (passed !== undefined || failed !== undefined) {
        const counts = [];
        if (passed > 0) counts.push(`${colors.green}${passed} passed${colors.reset}`);
        if (failed > 0) counts.push(`${colors.red}${failed} failed${colors.reset}`);
        if (counts.length > 0) {
            lines.push(`    ${counts.join(', ')}`);
        }
    }

    // Errors
    if (errors && errors.length > 0) {
        for (const error of errors) {
            lines.push(`    ${colors.red}${error}${colors.reset}`);
        }
    }

    return lines.join('\n');
}

/**
 * Format aggregated test suite results
 * @param {Object} suiteResult - Suite result from runTestSuite
 * @returns {string} Formatted result string
 */
export function formatSuiteResults(suiteResult) {
    const { success, totalTests, totalPassed, totalFailed, results, duration } = suiteResult;
    const lines = [];

    // Header
    lines.push(`${colors.cyan}${'─'.repeat(50)}${colors.reset}`);
    lines.push(`${colors.bright}Test Results${colors.reset}`);
    lines.push(`${colors.cyan}${'─'.repeat(50)}${colors.reset}`);
    lines.push('');

    // Individual results
    if (results && results.length > 0) {
        for (const result of results) {
            lines.push(formatTestResult(result));
            lines.push('');
        }
    }

    // Summary
    lines.push(`${colors.cyan}${'─'.repeat(50)}${colors.reset}`);

    if (success) {
        lines.push(`${colors.green}${colors.bright}✓ All tests passed${colors.reset}`);
    } else {
        lines.push(`${colors.red}${colors.bright}✗ Some tests failed${colors.reset}`);
    }

    lines.push('');
    lines.push(`  Tests:   ${totalTests}`);
    lines.push(`  ${colors.green}Passed:${colors.reset}  ${totalPassed}`);
    if (totalFailed > 0) {
        lines.push(`  ${colors.red}Failed:${colors.reset}  ${totalFailed}`);
    }
    lines.push(`  ${colors.gray}Time:${colors.reset}    ${formatDuration(duration)}`);
    lines.push(`${colors.cyan}${'─'.repeat(50)}${colors.reset}`);

    return lines.join('\n');
}

/**
 * Format a compact single-line result
 * @param {Object} result - Test result object
 * @returns {string} Single line result
 */
export function formatCompactResult(result) {
    const { skillName, success, passed, failed, duration } = result;

    const status = success ? `${colors.green}✓${colors.reset}` : `${colors.red}✗${colors.reset}`;
    const counts = [];
    if (passed > 0) counts.push(`${passed}✓`);
    if (failed > 0) counts.push(`${failed}✗`);
    const countStr = counts.length > 0 ? ` [${counts.join(' ')}]` : '';
    const durationStr = duration ? ` ${colors.gray}${formatDuration(duration)}${colors.reset}` : '';

    return `${status} ${skillName}${countStr}${durationStr}`;
}

/**
 * Format results for non-TTY output (no colors)
 * @param {Object} suiteResult - Suite result from runTestSuite
 * @returns {string} Plain text result
 */
export function formatPlainResults(suiteResult) {
    const { success, totalTests, totalPassed, totalFailed, results, duration } = suiteResult;
    const lines = [];

    lines.push('Test Results');
    lines.push('─'.repeat(40));

    if (results && results.length > 0) {
        for (const result of results) {
            const status = result.success ? 'PASS' : 'FAIL';
            lines.push(`[${status}] ${result.skillName}`);
            if (result.errors && result.errors.length > 0) {
                for (const error of result.errors) {
                    lines.push(`  Error: ${error}`);
                }
            }
        }
    }

    lines.push('─'.repeat(40));
    lines.push(`Total: ${totalTests} | Passed: ${totalPassed} | Failed: ${totalFailed}`);
    lines.push(`Time: ${formatDuration(duration)}`);
    lines.push(success ? 'Result: PASS' : 'Result: FAIL');

    return lines.join('\n');
}

/**
 * Format test list for interactive selection
 * @param {Array} tests - Array of test info objects
 * @returns {Array} Array of { name, description } for selector
 */
export function formatTestList(tests) {
    return tests.map((test) => ({
        name: test.shortName || test.skillName,
        description: `[${test.skillType}] ${test.testFile}`,
        value: test,
    }));
}

export default {
    formatDuration,
    formatTestResult,
    formatSuiteResults,
    formatCompactResult,
    formatPlainResults,
    formatTestList,
};
