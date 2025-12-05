# Design Spec: src/ui/TestResultFormatter.mjs

ID: DS(/ui/TestResultFormatter.mjs)

## Overview

**Role**: Formats test execution results for display in the CLI, supporting both detailed and compact output formats, with and without ANSI colors.

**Pattern**: Pure functions for result formatting with multiple output modes.

**Key Collaborators**:
- `SlashCommandHandler` - formats test results for `/test` command
- `testDiscovery` - provides test result structures

## What It Does

TestResultFormatter provides:

1. **formatDuration**: Human-readable time formatting
2. **formatTestResult**: Detailed single test result
3. **formatSuiteResults**: Aggregated test suite results
4. **formatCompactResult**: Single-line test result
5. **formatPlainResults**: No-color output for non-TTY
6. **formatTestList**: Transform tests for interactive selector

## How It Does It

### Duration Formatting
```javascript
export function formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
}
```

### Single Test Result
```javascript
export function formatTestResult(result) {
    const lines = [];
    const { skillName, success, passed, failed, duration, errors } = result;

    // Status indicator
    const status = success
        ? `${GREEN}✓ PASS${RESET}`
        : `${RED}✗ FAIL${RESET}`;

    // Main line
    const durationStr = duration ? ` ${GRAY}(${formatDuration(duration)})${RESET}` : '';
    lines.push(`${status} ${skillName}${durationStr}`);

    // Pass/fail counts
    if (passed !== undefined || failed !== undefined) {
        const counts = [];
        if (passed > 0) counts.push(`${GREEN}${passed} passed${RESET}`);
        if (failed > 0) counts.push(`${RED}${failed} failed${RESET}`);
        if (counts.length > 0) {
            lines.push(`    ${counts.join(', ')}`);
        }
    }

    // Errors
    if (errors && errors.length > 0) {
        for (const error of errors) {
            lines.push(`    ${RED}${error}${RESET}`);
        }
    }

    return lines.join('\n');
}
```

### Suite Results
```javascript
export function formatSuiteResults(suiteResult) {
    const { success, totalTests, totalPassed, totalFailed, results, duration } = suiteResult;
    const lines = [];

    // Header
    lines.push(`${CYAN}${'─'.repeat(50)}${RESET}`);
    lines.push(`${BRIGHT}Test Results${RESET}`);
    lines.push(`${CYAN}${'─'.repeat(50)}${RESET}`);
    lines.push('');

    // Individual results
    if (results && results.length > 0) {
        for (const result of results) {
            lines.push(formatTestResult(result));
            lines.push('');
        }
    }

    // Summary
    lines.push(`${CYAN}${'─'.repeat(50)}${RESET}`);

    if (success) {
        lines.push(`${GREEN}${BRIGHT}✓ All tests passed${RESET}`);
    } else {
        lines.push(`${RED}${BRIGHT}✗ Some tests failed${RESET}`);
    }

    lines.push('');
    lines.push(`  Tests:   ${totalTests}`);
    lines.push(`  ${GREEN}Passed:${RESET}  ${totalPassed}`);
    if (totalFailed > 0) {
        lines.push(`  ${RED}Failed:${RESET}  ${totalFailed}`);
    }
    lines.push(`  ${GRAY}Time:${RESET}    ${formatDuration(duration)}`);
    lines.push(`${CYAN}${'─'.repeat(50)}${RESET}`);

    return lines.join('\n');
}
```

### Compact Format
```javascript
export function formatCompactResult(result) {
    const { skillName, success, passed, failed, duration } = result;

    const status = success ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
    const counts = [];
    if (passed > 0) counts.push(`${passed}✓`);
    if (failed > 0) counts.push(`${failed}✗`);
    const countStr = counts.length > 0 ? ` [${counts.join(' ')}]` : '';
    const durationStr = duration ? ` ${GRAY}${formatDuration(duration)}${RESET}` : '';

    return `${status} ${skillName}${countStr}${durationStr}`;
}
```

### Plain Text (No Colors)
```javascript
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
```

### Test List for Selector
```javascript
export function formatTestList(tests) {
    return tests.map((test) => ({
        name: test.shortName || test.skillName,
        description: `[${test.skillType}] ${test.testFile}`,
        value: test,
    }));
}
```

## Why This Design

### 1. Multiple Output Formats
**Decision**: Provide detailed, compact, and plain text formats.

**Rationale**:
- Different contexts need different detail levels
- Compact for progress during suite runs
- Detailed for final report
- Plain for non-TTY or piping

### 2. Color Constants
**Decision**: Use ANSI color codes as constants.

**Rationale**:
- Consistent coloring throughout
- Easy to change scheme
- Standard terminal colors
- Reset ensures no color bleed

### 3. Duration Threshold
**Decision**: Show milliseconds under 1 second, seconds above.

**Rationale**:
- Appropriate precision for context
- No unnecessary decimal places
- Clean output
- Standard convention

### 4. Error Indentation
**Decision**: Indent errors under the test result.

**Rationale**:
- Visual hierarchy (test → errors)
- Easy to scan for failures
- Groups related information
- Consistent with other test frameworks

### 5. Summary Line Placement
**Decision**: Summary at bottom with totals.

**Rationale**:
- Natural reading order (details → summary)
- Matches `npm test`, `jest`, etc.
- Easy to find final status
- Separators create visual structure

## Public API

### Functions
```javascript
formatDuration(ms)           // "42ms" or "1.23s"
formatTestResult(result)     // Detailed single result
formatSuiteResults(suite)    // Full suite with summary
formatCompactResult(result)  // Single line result
formatPlainResults(suite)    // No ANSI colors
formatTestList(tests)        // For CommandSelector
```

### Default Export
```javascript
export default {
    formatDuration,
    formatTestResult,
    formatSuiteResults,
    formatCompactResult,
    formatPlainResults,
    formatTestList,
};
```

## Result Structures

### Single Test Result
```javascript
{
    skillName: string,
    success: boolean,
    passed: number,
    failed: number,
    duration: number,     // milliseconds
    errors: string[],
}
```

### Suite Result
```javascript
{
    success: boolean,
    totalTests: number,
    totalPassed: number,
    totalFailed: number,
    results: TestResult[],
    duration: number,
}
```

## Output Examples

### Detailed Result
```
✓ PASS equipment (1.23s)
    3 passed

✗ FAIL material (0.85s)
    2 passed, 1 failed
    Expected value to be 'active', got 'pending'
```

### Compact Result
```
✓ equipment [3✓] 1.23s
✗ material [2✓ 1✗] 0.85s
```

### Plain Text
```
Test Results
────────────────────────────────────────
[PASS] equipment
[FAIL] material
  Error: Expected value to be 'active', got 'pending'
────────────────────────────────────────
Total: 2 | Passed: 1 | Failed: 1
Time: 2.08s
Result: FAIL
```

## Notes/Constraints

- ANSI codes assume VT100-compatible terminal
- Plain format is safe for file output
- Duration is always milliseconds (caller converts)
- Failed count only shown if > 0
- formatTestList preserves original test object as `value`
- Empty errors array is handled gracefully
