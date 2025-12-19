# ResultFormatter Module Specification

Stateless utility functions for formatting skill execution results.

## Overview

ResultFormatter provides functions to transform raw skill execution results into human-readable output for display in the CLI.

## Functions

### summarizeResult

Summarizes an orchestrator result for non-debug output.

Accepts:
- result: The result to summarize (any type)

Processing:

For non-object results:
- Convert to string and return

For object results:
1. Unwrap nested result if present (orchestrator wraps in { result: {...} })
2. Check if result contains executions array (orchestrator format)

For orchestrator results with executions:
- Iterate each execution
- Skip executions marked as skipped
- Extract skill name (strip -code and -orchestrator suffixes)
- If execution has outcome.result:
  - For string results: add directly
  - For object results: stringify with formatting
- If execution has error: add "✗ skillName: error"
- If no execution content but notes exist: add notes
- Join all lines with double newlines
- Return JSON if no formatted lines

For non-orchestrator results:
- If result has output property: return output
- Otherwise: return formatted JSON of unwrapped data

Returns formatted string.

### formatSlashResult

Formats slash command result for display.

Accepts:
- result: The result to format (any type)

Processing:
- If string: return as-is
- If has result property:
  - If result.result is string: return it
  - Otherwise: stringify result.result
- If has output property: return output
- Otherwise: stringify entire result

Returns formatted string.

## Result Shapes Handled

Orchestrator result:
```
{
  result: {
    executions: [
      {
        skill: "skill-name",
        skipped: boolean,
        error: "error message",
        outcome: {
          result: "actual output" | { ... }
        }
      }
    ],
    notes: "additional information"
  }
}
```

Simple skill result:
```
{
  result: "string output" | { ... },
  output: "alternative output"
}
```

Direct string result:
```
"plain text result"
```

## Exports

Exports:
- summarizeResult function (named)
- formatSlashResult function (named)
- Default export: object containing both functions
