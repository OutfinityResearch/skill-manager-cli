/**
 * Test Discovery and Runner
 *
 * Discovers {skillName}.tests.mjs files in the tests/ folder and provides
 * utilities for running tests and collecting results.
 *
 * Test file naming convention:
 *   tests/{skillShortName}.tests.mjs
 *
 * Example:
 *   tests/area.tests.mjs       - Tests for the 'area' skill
 *   tests/equipment.tests.mjs  - Tests for the 'equipment' skill
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/**
 * Get the tests directory path from agent context
 * @param {Object} agent - RecursiveSkilledAgent instance
 * @returns {string|null} Path to tests directory or null
 */
function getTestsDir(agent) {
    // Try to get working directory from agent context
    const workingDir = agent?.context?.workingDir
        || agent?.options?.startDir
        || agent?.startDir
        || process.cwd();

    const testsDir = path.join(workingDir, 'tests');
    return fs.existsSync(testsDir) ? testsDir : null;
}

/**
 * Discover all skill tests across registered skills
 * Looks for {skillShortName}.tests.mjs files in the tests/ folder
 * @param {Object} agent - RecursiveSkilledAgent instance
 * @returns {Array} Array of test info objects
 */
export function discoverSkillTests(agent) {
    const tests = [];

    if (!agent?.skillCatalog) {
        return tests;
    }

    const testsDir = getTestsDir(agent);
    if (!testsDir) {
        return tests;
    }

    for (const [name, record] of agent.skillCatalog.entries()) {
        const shortName = record.shortName || name;
        const testFile = path.join(testsDir, `${shortName}.tests.mjs`);

        if (fs.existsSync(testFile)) {
            tests.push({
                skillName: name,
                shortName: shortName,
                skillType: record.type || 'unknown',
                testFile: testFile,
                skillDir: record.skillDir,
            });
        }
    }

    return tests;
}

/**
 * Discover tests for a specific skill
 * Looks for {skillShortName}.tests.mjs in the tests/ folder
 * @param {Object} agent - RecursiveSkilledAgent instance
 * @param {string} skillName - Name of the skill
 * @returns {Object|null} Test info or null if no tests
 */
export function discoverSkillTest(agent, skillName) {
    const skillInfo = agent?.findSkillFile?.(skillName);
    if (!skillInfo) return null;

    const testsDir = getTestsDir(agent);
    if (!testsDir) return null;

    const shortName = skillInfo.record?.shortName || skillName;
    const testFile = path.join(testsDir, `${shortName}.tests.mjs`);

    if (fs.existsSync(testFile)) {
        return {
            skillName: skillName,
            shortName: shortName,
            skillType: skillInfo.record?.type || 'unknown',
            testFile: testFile,
            skillDir: skillInfo.record?.skillDir || path.dirname(skillInfo.filePath),
        };
    }

    return null;
}

/**
 * Run a single test file
 * @param {string} testFile - Path to the test file
 * @param {Object} options - Options { timeout, verbose }
 * @returns {Promise<Object>} Test result { success, passed, failed, output, duration, errors }
 */
export async function runTestFile(testFile, options = {}) {
    const { timeout = 30000, verbose = false } = options;
    const startTime = Date.now();

    return new Promise((resolve) => {
        let stdout = '';
        let stderr = '';

        // Create a wrapper script that imports and runs the test
        const wrapperCode = `
            import testModule from '${testFile.replace(/\\/g, '/')}';

            async function run() {
                if (typeof testModule === 'function') {
                    return await testModule();
                } else if (typeof testModule.default === 'function') {
                    return await testModule.default();
                } else if (typeof testModule.runTests === 'function') {
                    return await testModule.runTests();
                } else {
                    throw new Error('Test file must export a default function or runTests function');
                }
            }

            run()
                .then(result => {
                    console.log(JSON.stringify({ success: true, result }));
                    process.exit(result?.failed > 0 ? 1 : 0);
                })
                .catch(error => {
                    console.log(JSON.stringify({
                        success: false,
                        error: error.message,
                        stack: error.stack
                    }));
                    process.exit(1);
                });
        `;

        const child = spawn('node', ['--input-type=module', '-e', wrapperCode], {
            cwd: path.dirname(testFile),
            stdio: ['ignore', 'pipe', 'pipe'],
            env: { ...process.env },
        });

        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        const timer = setTimeout(() => {
            child.kill('SIGTERM');
            resolve({
                success: false,
                passed: 0,
                failed: 1,
                output: stdout,
                errors: ['Test timeout exceeded'],
                duration: Date.now() - startTime,
            });
        }, timeout);

        child.on('close', (code) => {
            clearTimeout(timer);
            const duration = Date.now() - startTime;

            // Try to parse structured result from stdout
            let result = {
                success: code === 0,
                passed: 0,
                failed: 0,
                output: stdout,
                errors: [],
                duration,
            };

            try {
                // Look for JSON result in output (trim to handle trailing newlines)
                const jsonMatch = stdout.trim().match(/\{[\s\S]*\}$/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    if (parsed.result) {
                        result.passed = parsed.result.passed || 0;
                        result.failed = parsed.result.failed || 0;
                        result.errors = parsed.result.errors || [];
                        result.success = parsed.success && result.failed === 0;
                    } else if (parsed.error) {
                        result.success = false;
                        result.errors = [parsed.error];
                    }
                }
            } catch (e) {
                // If not JSON, check exit code
                if (code !== 0 && stderr) {
                    result.errors = [stderr.trim()];
                }
            }

            if (verbose) {
                result.stderr = stderr;
            }

            resolve(result);
        });

        child.on('error', (error) => {
            clearTimeout(timer);
            resolve({
                success: false,
                passed: 0,
                failed: 1,
                output: stdout,
                errors: [error.message],
                duration: Date.now() - startTime,
            });
        });
    });
}

/**
 * Run tests directly by importing the module (for in-process testing)
 * @param {string} testFile - Path to the test file
 * @returns {Promise<Object>} Test result
 */
export async function runTestFileInProcess(testFile) {
    const startTime = Date.now();

    try {
        // Dynamic import with cache busting
        const testUrl = `file://${testFile}?t=${Date.now()}`;
        const testModule = await import(testUrl);

        let result;
        if (typeof testModule.default === 'function') {
            result = await testModule.default();
        } else if (typeof testModule.runTests === 'function') {
            result = await testModule.runTests();
        } else {
            throw new Error('Test file must export a default function or runTests function');
        }

        return {
            success: (result?.failed || 0) === 0,
            passed: result?.passed || 0,
            failed: result?.failed || 0,
            errors: result?.errors || [],
            duration: Date.now() - startTime,
        };
    } catch (error) {
        return {
            success: false,
            passed: 0,
            failed: 1,
            errors: [error.message],
            duration: Date.now() - startTime,
        };
    }
}

/**
 * Run multiple tests and aggregate results
 * @param {Array} tests - Array of test info objects from discoverSkillTests
 * @param {Object} options - Options { timeout, verbose, parallel }
 * @returns {Promise<Object>} Aggregated results
 */
export async function runTestSuite(tests, options = {}) {
    const { parallel = false } = options;
    const startTime = Date.now();
    const results = [];

    if (parallel) {
        const promises = tests.map(async (test) => {
            const result = await runTestFile(test.testFile, options);
            return { ...test, ...result };
        });
        results.push(...(await Promise.all(promises)));
    } else {
        for (const test of tests) {
            const result = await runTestFile(test.testFile, options);
            results.push({ ...test, ...result });
        }
    }

    // Aggregate results
    const totalPassed = results.reduce((sum, r) => sum + (r.passed || 0), 0);
    const totalFailed = results.reduce((sum, r) => sum + (r.failed || 0), 0);
    const allErrors = results.flatMap((r) => r.errors || []);

    return {
        success: totalFailed === 0 && results.every((r) => r.success),
        totalTests: results.length,
        totalPassed,
        totalFailed,
        results,
        errors: allErrors,
        duration: Date.now() - startTime,
    };
}

export default {
    discoverSkillTests,
    discoverSkillTest,
    runTestFile,
    runTestFileInProcess,
    runTestSuite,
};
