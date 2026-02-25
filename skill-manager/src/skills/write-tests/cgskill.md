# Write Tests

Generates test files for skills.

## Summary
Uses LLM to generate comprehensive test files for skills:
- **tskill**: Tests validators, presenters, resolvers, enumerators
- **iskill**: Tests specs and action function behavior
- **oskill**: Tests routing logic and orchestration
- **cskill**: Tests action function with various inputs

Creates a `{skillName}.tests.mjs` file in the `tests/` directory that can be run with `/run-tests`.

## Prompt
Analyze the skill definition and generated code (if available) to create comprehensive test cases covering:
1. Valid inputs and expected outputs
2. Edge cases and error handling
3. All exported functions
4. Integration with dependencies

## Arguments
- skillName: Name of the skill to generate tests for
- options: Optional JSON with { force: boolean, coverage: 'basic'|'full' }

## LLM-Mode
deep
