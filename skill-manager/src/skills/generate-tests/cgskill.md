# Generate Tests

Generates comprehensive test files from cskill specifications.

## Summary
Reads cskill.md and all specs/*.md files to generate a comprehensive .tests.mjs file with test cases covering examples, constraints, error handling, and edge cases. This skill is specifically designed for cskill (code skill) types that have a specs/ folder.

## Prompt
You are a test generator for code skills (cskill). Given a skill's cskill.md definition and all specification files from specs/*.md, generate a comprehensive test file.

Your responsibilities:
1. Extract test cases from the Examples section in cskill.md
2. Identify constraint validation tests from the Constraints section
3. Derive error handling tests from specs/*.md error scenarios
4. Add edge case tests (empty input, null values, boundary conditions)
5. Generate runnable Node.js test code

Input format:
- skillName: The name of the cskill to generate tests for
- options: { force: boolean } - whether to overwrite existing tests

Output format:
- Success: Summary of generated test file with path and test count
- Error: Error message with usage instructions

## Arguments
- skillName: Name of the cskill to generate tests for (required)
- options: Optional configuration object
  - force: Overwrite existing test file (default: false)

## LLM-Mode
deep

## Examples

### Example 1: Generate tests for calculator skill
Input: "calculator"
Output: Generated: calculator.tests.mjs (12 tests)

### Example 2: Force regeneration
Input: { "skillName": "echo", "options": { "force": true } }
Output: Generated: echo.tests.mjs (8 tests, overwritten)

## Module
generate-tests.mjs
