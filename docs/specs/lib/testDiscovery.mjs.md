# Design Spec: src/lib/testDiscovery.mjs

ID: DS(/lib/testDiscovery.mjs)

## Overview

**Role**: Discovers and runs test files for skills. Provides utilities for finding `{skillName}.tests.mjs` files in the `tests/` folder and executing them in isolated processes.

**Pattern**: Discovery functions paired with execution utilities, using subprocess isolation for test runs.

**Key Collaborators**:
- `RecursiveSkilledAgent` - provides skill catalog for discovery
- `test-code` skill - uses run functions for execution
- `SlashCommandHandler` - triggers test discovery for `/test` picker
- `TestResultFormatter` - formats execution results

## What It Does

testDiscovery provides:

1. **discoverSkillTests**: Find all tests across registered skills
2. **discoverSkillTest**: Find test for a specific skill
3. **runTestFile**: Execute a test file in a subprocess
4. **runTestFileInProcess**: Execute test file via dynamic import
5. **runTestSuite**: Run multiple tests with aggregated results

## How It Does It

### Test Discovery
```javascript
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

function getTestsDir(agent) {
    const workingDir = agent?.context?.workingDir
        || agent?.options?.startDir
        || agent?.startDir
        || process.cwd();

    const testsDir = path.join(workingDir, 'tests');
    return fs.existsSync(testsDir) ? testsDir : null;
}
```

### Subprocess Test Execution
```javascript
export async function runTestFile(testFile, options = {}) {
    const { timeout = 30000, verbose = false } = options;
    const startTime = Date.now();

    return new Promise((resolve) => {
        let stdout = '';
        let stderr = '';

        // Wrapper script that imports and runs the test
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

        // Timeout handling
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

            let result = {
                success: code === 0,
                passed: 0,
                failed: 0,
                output: stdout,
                errors: [],
                duration,
            };

            // Parse JSON result from output
            try {
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
                if (code !== 0 && stderr) {
                    result.errors = [stderr.trim()];
                }
            }

            resolve(result);
        });
    });
}
```

### In-Process Execution
```javascript
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
```

### Suite Execution
```javascript
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
```

## Why This Design

### 1. Subprocess Isolation
**Decision**: Run tests in separate Node.js processes by default.

**Rationale**:
- Tests can't crash the CLI
- Clean module cache per run
- Isolated environment (no shared state)
- Timeout enforcement via SIGTERM
- Exit code reflects test success/failure

### 2. Convention-Based Discovery
**Decision**: Tests must be named `{skillShortName}.tests.mjs` in `tests/` folder.

**Rationale**:
- Simple, predictable convention
- No configuration needed
- Automatic association with skills
- Easy to find/organize tests

### 3. Flexible Test Export Pattern
**Decision**: Support `default`, `module.default`, and `runTests` exports.

**Rationale**:
- Supports common export patterns
- Backward compatible
- Works with various test frameworks
- Minimal constraints on test file structure

### 4. JSON Result Protocol
**Decision**: Test files output JSON with `{ success, result }` structure.

**Rationale**:
- Structured data extraction from output
- Works across process boundary
- Rich error information (message, stack)
- Pass/fail counts for reporting

### 5. Cache Busting for In-Process
**Decision**: Add timestamp query parameter to import URL.

**Rationale**:
- ESM module cache prevents re-import
- Query parameter creates "new" URL
- Forces fresh import on each run
- Essential for iterative testing

## Public API

### Functions
```javascript
discoverSkillTests(agent)              // Find all skill tests
discoverSkillTest(agent, skillName)    // Find test for specific skill
runTestFile(testFile, options)         // Run test in subprocess
runTestFileInProcess(testFile)         // Run test via import
runTestSuite(tests, options)           // Run multiple tests
```

### Default Export
```javascript
export default {
    discoverSkillTests,
    discoverSkillTest,
    runTestFile,
    runTestFileInProcess,
    runTestSuite,
};
```

## Options

### runTestFile Options
```javascript
{
    timeout: number,   // Max execution time (default: 30000ms)
    verbose: boolean,  // Include stderr in result (default: false)
}
```

### runTestSuite Options
```javascript
{
    timeout: number,   // Per-test timeout
    verbose: boolean,  // Verbose output
    parallel: boolean, // Run tests in parallel (default: false)
}
```

## Test File Contract

Test files should:
1. Export a default function or `runTests` function
2. Return an object with `{ passed, failed, errors }`
3. Be named `{skillShortName}.tests.mjs`
4. Be located in `tests/` directory

```javascript
// Example: tests/equipment.tests.mjs
export default async function() {
    const passed = 0;
    const failed = 0;
    const errors = [];

    // Run tests...

    return { passed, failed, errors };
}
```

## Result Structures

### Single Test Result
```javascript
{
    success: boolean,
    passed: number,
    failed: number,
    output: string,      // stdout from subprocess
    errors: string[],
    duration: number,    // milliseconds
}
```

### Suite Result
```javascript
{
    success: boolean,
    totalTests: number,
    totalPassed: number,
    totalFailed: number,
    results: TestResult[],  // Individual results with test metadata
    errors: string[],       // Flattened errors from all tests
    duration: number,
}
```

## Pseudocode

```javascript
function discoverSkillTests(agent) {
    tests = [];
    testsDir = findTestsDir(agent.workingDir);

    if (!testsDir) return [];

    for ([name, record] of agent.skillCatalog) {
        testFile = join(testsDir, `${record.shortName}.tests.mjs`);
        if (exists(testFile)) {
            tests.push({
                skillName: name,
                shortName: record.shortName,
                skillType: record.type,
                testFile,
                skillDir: record.skillDir,
            });
        }
    }

    return tests;
}

async function runTestFile(testFile, { timeout = 30000 }) {
    startTime = now();

    child = spawn('node', ['--input-type=module', '-e', wrapperCode]);

    return new Promise((resolve) => {
        timer = setTimeout(() => {
            child.kill();
            resolve({ success: false, errors: ['Timeout'] });
        }, timeout);

        child.on('close', (code) => {
            clearTimeout(timer);
            result = parseJsonFromOutput(stdout);
            resolve({
                success: code === 0 && result.failed === 0,
                ...result,
                duration: now() - startTime,
            });
        });
    });
}
```

## Notes/Constraints

- Tests directory must exist for discovery to work
- Short name used for test file naming (not full skill name)
- Subprocess CWD is set to test file's directory
- Environment variables are inherited
- Timeout kills with SIGTERM (not SIGKILL)
- JSON result is extracted from end of stdout (after any test output)
- In-process execution shares module state (use subprocess for isolation)
- Parallel execution may cause resource contention
