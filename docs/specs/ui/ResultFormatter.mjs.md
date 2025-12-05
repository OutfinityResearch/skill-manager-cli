# Design Spec: src/ui/ResultFormatter.mjs

ID: DS(/ui/ResultFormatter.mjs)

## Overview

**Role**: Stateless utility functions for formatting skill execution results for display. Handles orchestrator results, nested structures, and various output shapes.

**Pattern**: Pure functions (input → output) with no state or side effects.

**Key Collaborators**:
- `REPLSession` - uses for natural language results
- `SlashCommandHandler` - uses formatSlashResult

## What It Does

ResultFormatter provides:

1. **summarizeResult**: Format orchestrator results with execution traces
2. **formatSlashResult**: Extract displayable content from skill results

## How It Does It

### summarizeResult - Orchestrator Results
```javascript
export function summarizeResult(result) {
    if (!result || typeof result !== 'object') {
        return String(result);
    }

    const lines = [];

    // Unwrap nested result if present
    // Orchestrator returns { result: { executions, ... } }
    const data = result.result && typeof result.result === 'object'
        ? result.result
        : result;

    // Handle orchestrator results with executions array
    if (data.executions && Array.isArray(data.executions)) {
        for (const exec of data.executions) {
            if (exec.skipped) continue;

            const skillName = exec.skill
                ?.replace(/-code$/, '')
                ?.replace(/-orchestrator$/, '')
                || 'unknown';

            if (exec.outcome?.result) {
                const outcomeResult = exec.outcome.result;
                if (typeof outcomeResult === 'string') {
                    lines.push(outcomeResult);
                } else {
                    lines.push(JSON.stringify(outcomeResult, null, 2));
                }
            } else if (exec.error) {
                const status = '✗';
                lines.push(`${status} ${skillName}: ${exec.error}`);
            }
        }

        // Add notes if present and no other output
        if (data.notes && lines.length === 0) {
            lines.push(data.notes);
        }

        return lines.length > 0
            ? lines.join('\n\n')
            : JSON.stringify(data, null, 2);
    }

    // Fallback for non-orchestrator results
    if (result.output) {
        return result.output;
    }

    return JSON.stringify(data, null, 2);
}
```

### formatSlashResult - Simple Extraction
```javascript
export function formatSlashResult(result) {
    // String passthrough
    if (typeof result === 'string') {
        return result;
    }

    // Unwrap { result: ... }
    if (result?.result) {
        return typeof result.result === 'string'
            ? result.result
            : JSON.stringify(result.result, null, 2);
    }

    // Try output property
    if (result?.output) {
        return result.output;
    }

    // Fallback to JSON
    return JSON.stringify(result, null, 2);
}
```

## Why This Design

### 1. Pure Functions
**Decision**: Stateless utility functions without class wrapper.

**Rationale**:
- Easy to test (pure input → output)
- No initialization required
- Can be imported and used anywhere
- No side effects to track

### 2. Nested Result Unwrapping
**Decision**: Handle `{ result: { result: ... } }` nesting.

**Rationale**:
- Orchestrator wraps skill results
- Skills may return wrapped results
- User should see actual content
- Deep unwrapping unnecessary (one level)

### 3. Execution Trace Formatting
**Decision**: Extract outcome.result from each execution.

**Rationale**:
- Orchestrator tracks each skill execution
- Users want the output, not the metadata
- Skipped executions are noise
- Errors should be visible

### 4. Skill Name Cleanup
**Decision**: Remove `-code` and `-orchestrator` suffixes from skill names.

**Rationale**:
- Implementation detail (code vs orchestrator)
- User knows "read-skill" not "read-skill-code"
- Cleaner output
- Matches how users reference skills

### 5. JSON Fallback
**Decision**: Fall back to pretty-printed JSON when structure is unknown.

**Rationale**:
- Never lose information
- Structured output for debugging
- Handles unexpected result shapes
- Pretty-printed for readability

## Public API

### Functions
```javascript
summarizeResult(result)      // Format orchestrator/complex result
formatSlashResult(result)    // Extract displayable content from result
```

### Default Export
```javascript
export default {
    summarizeResult,
    formatSlashResult,
};
```

## Result Shape Handling

```javascript
// 1. Orchestrator result with executions
{
    result: {
        executions: [
            { skill: 'read-skill-code', outcome: { result: '...' } },
            { skill: 'validate-skill', skipped: true },
        ],
        notes: 'Operation completed',
    }
}
// → Extracts outcome.result from non-skipped executions

// 2. Simple skill result
{
    result: 'The skill definition is...'
}
// → Returns the string directly

// 3. Result with output property
{
    output: 'Generated code...',
    metadata: { ... }
}
// → Returns output property

// 4. Unknown structure
{
    foo: 'bar',
    data: [1, 2, 3]
}
// → Returns JSON.stringify with indentation
```

## Pseudocode

```javascript
function summarizeResult(result) {
    if (!result || !isObject(result)) return String(result);

    // Unwrap nested result
    data = result.result || result;

    // Handle orchestrator executions
    if (data.executions) {
        lines = [];
        for (exec of data.executions) {
            if (exec.skipped) continue;

            if (exec.outcome?.result) {
                lines.push(formatValue(exec.outcome.result));
            } else if (exec.error) {
                lines.push(`✗ ${cleanSkillName(exec.skill)}: ${exec.error}`);
            }
        }

        if (lines.empty && data.notes) {
            return data.notes;
        }

        return lines.join('\n\n') || JSON.stringify(data);
    }

    // Fallbacks
    if (result.output) return result.output;
    return JSON.stringify(data, null, 2);
}

function formatSlashResult(result) {
    if (isString(result)) return result;
    if (result?.result) return formatValue(result.result);
    if (result?.output) return result.output;
    return JSON.stringify(result, null, 2);
}
```

## Notes/Constraints

- Null/undefined result returns "null"/"undefined" string
- Arrays are JSON stringified
- No maximum output length (could be added)
- No color/styling (handled by markdown renderer if enabled)
- Double newline between execution results for visual separation
- Notes only shown if no execution output (avoid redundancy)
