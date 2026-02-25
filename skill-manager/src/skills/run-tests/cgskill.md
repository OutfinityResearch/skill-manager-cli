# Run Tests

## Summary
Discovers and runs tests for skills. Supports per-skill tests (.tests.mjs files) and running all discovered tests.

## Prompt
Execute tests and report results. The skill can:
1. Run tests for a specific skill by name
2. Run all discovered tests across all skills
3. Return formatted test results with pass/fail counts

Input can be:
- A skill name to run tests for that specific skill
- "all" to run all discovered tests
- JSON object: { "target": "skill-name" | "all", "options": { "verbose": boolean, "timeout": number } }

## Arguments
- target: Skill name, "all", or empty (shows available tests)
- options: Optional settings like verbose mode and timeout

## LLM-Mode
fast
