# generate-code Module Specification

Generates executable .mjs code from skill definition files.

## Overview

This module generates JavaScript code from skill definitions (tskill, iskill, oskill, cskill) using LLM. It supports timestamp-based caching to avoid unnecessary regeneration and automatically runs associated tests after generation.

## Supported Skill Types

- tskill: Database table skills → tskill.generated.mjs
- iskill: Interactive skills → skillname.generated.mjs
- oskill: Orchestrator skills → skillname.generated.mjs
- cskill: Code skills → skillname.generated.mjs

## Editability Check

Only editable skills can have code generated:
- Local skills (in working directory)
- Skills from repos marked as editable

Non-editable skills return error with hint to enable editing.

## Exported Function

### action

Main entry point for code generation.

Accepts:
- recursiveSkilledAgent: The RecursiveSkilledAgent instance
- prompt: Skill name as string or object

## Input Parsing

Accepts:
- String: Skill name directly or JSON with skillName/name property
- Object: With skillName or name property

## Regeneration Check

Before generating, checks if regeneration is needed:

Source files checked:
- Skill definition file (.md)
- Specs file (.specs.md) if exists

Regeneration triggered when:
- Generated file does not exist
- Any source file is newer than generated file

Skipped when generated file is up to date with all sources.

## Code Generation Flow

1. Parse skill name from input
2. Find skill file using agent's findSkillFile method
3. Check skill is editable
4. Read skill definition content
5. Verify skill type is supported
6. Check if regeneration is needed
7. Parse skill sections for context
8. Load specs content if available
9. Build type-specific code generation prompt
10. Call LLM with prompt (mode: deep, shape: code)
11. Clean response (remove markdown blocks)
12. Write generated file to skill directory
13. Auto-run tests if found

## Output File Paths

Output file is written to the skill directory:
- tskill: {skillDir}/tskill.generated.mjs
- Other types: {skillDir}/{skillName}.generated.mjs

## Auto-Test Discovery

After generation, looks for test files in working directory's tests/ folder:
- {skillName}.test.mjs
- {skillName}.tests.mjs

If found, runs tests and includes results in output.

## Output Format

Success:
```
Generated: skillname.generated.mjs
Path: /full/path/to/generated.mjs
Size: 1234 bytes

[Auto-running tests from tests/skillname.tests.mjs...]
[Test results summary]
```

Skipped (up to date):
```
Skipped: skillname.generated.mjs is up to date (no source files modified since last generation)
```

## Error Handling

Missing skill name:
```
Error: skillName is required. Usage: generate-code <skillName>
```

Skill not found:
```
Error: Skill "name" not found
```

Non-editable skill:
```
Error: Cannot generate code for skill "name" - it belongs to read-only repository "reponame".

To enable editing, run: /edit-repo reponame
```

Unsupported type:
```
Error: Code generation is only supported for: tskill, iskill, oskill, cskill.
This skill is type: unknown
```

LLM error:
```
Error generating code: [message]
```

## Dependencies

- skillSchemas: detectSkillType, parseSkillSections, loadSpecsContent
- codeGeneration.prompts: Type-specific prompt builders
- testDiscovery: runTestFile
- TestResultFormatter: formatTestResult
- fs: File operations
- path: Path manipulation
