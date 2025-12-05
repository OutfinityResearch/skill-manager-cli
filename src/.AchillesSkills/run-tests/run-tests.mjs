/**
 * Run Tests Skill
 *
 * Discovers and runs tests for skills. Supports per-skill tests
 * (.tests.mjs files) and running all discovered tests.
 */

import {
    discoverSkillTests,
    discoverSkillTest,
    runTestFile,
    runTestSuite,
} from '../../lib/testDiscovery.mjs';
import {
    formatSuiteResults,
    formatTestResult,
    formatTestList,
} from '../../ui/TestResultFormatter.mjs';

/**
 * Parse input to extract target and options
 */
function parseInput(prompt) {
    if (!prompt) {
        return { target: null, options: {} };
    }

    if (typeof prompt === 'string') {
        const trimmed = prompt.trim();

        // Try JSON parse
        try {
            const parsed = JSON.parse(trimmed);
            return {
                target: parsed.target || parsed.skillName || parsed.name,
                options: parsed.options || {},
            };
        } catch (e) {
            // Not JSON, treat as skill name or "all"
            return { target: trimmed, options: {} };
        }
    }

    if (typeof prompt === 'object') {
        return {
            target: prompt.target || prompt.skillName || prompt.name,
            options: prompt.options || {},
        };
    }

    return { target: null, options: {} };
}

/**
 * Main action function
 */
export async function action(recursiveSkilledAgent, prompt) {
    const { target, options } = parseInput(prompt);

    // If no target, list available tests
    if (!target) {
        const tests = discoverSkillTests(recursiveSkilledAgent);

        if (tests.length === 0) {
            return 'No tests found. Create .tests.mjs files in skill directories to add tests.';
        }

        const lines = [
            'Available tests:',
            '',
            ...tests.map((t) => `  • ${t.shortName || t.skillName} [${t.skillType}]`),
            '',
            `Found ${tests.length} test(s). Use /test <skill-name> or /test all to run.`,
        ];

        return lines.join('\n');
    }

    // Run all tests
    if (target.toLowerCase() === 'all') {
        const tests = discoverSkillTests(recursiveSkilledAgent);

        if (tests.length === 0) {
            return 'No tests found. Create .tests.mjs files in skill directories to add tests.';
        }

        console.log(`\nRunning ${tests.length} test(s)...\n`);

        const suiteResult = await runTestSuite(tests, {
            timeout: options.timeout || 30000,
            verbose: options.verbose || false,
        });

        return formatSuiteResults(suiteResult);
    }

    // Run tests for specific skill
    const testInfo = discoverSkillTest(recursiveSkilledAgent, target);

    if (!testInfo) {
        // Check if skill exists but has no tests
        const skillInfo = recursiveSkilledAgent?.findSkillFile?.(target);

        if (skillInfo) {
            return `Skill "${target}" found but has no .tests.mjs file.\n\nCreate a test file at:\n  ${skillInfo.record?.skillDir || 'skill-dir'}/.tests.mjs`;
        }

        return `Skill "${target}" not found. Use /test to see available tests.`;
    }

    console.log(`\nRunning tests for ${testInfo.skillName}...\n`);

    const result = await runTestFile(testInfo.testFile, {
        timeout: options.timeout || 30000,
        verbose: options.verbose || false,
    });

    // Add skill info to result
    const fullResult = {
        ...testInfo,
        ...result,
    };

    return formatTestResult(fullResult);
}

/**
 * Get list of available tests for interactive selection
 */
export function getAvailableTests(recursiveSkilledAgent) {
    const tests = discoverSkillTests(recursiveSkilledAgent);
    return formatTestList(tests);
}

export default action;
