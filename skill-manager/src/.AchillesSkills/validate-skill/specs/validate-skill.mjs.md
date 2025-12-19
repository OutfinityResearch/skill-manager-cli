# validate-skill Module Specification

Validates a skill file against its schema.

## Overview

This module validates skill definition files against their type-specific schemas, checking for required sections, proper structure, and providing warnings for missing optional sections.

## Editability Check

Only editable skills can be validated:
- Local skills (in working directory)
- Skills from repos marked as editable

Non-editable skills return error with hint to enable management.

## Exported Function

### action

Main entry point for validation.

Accepts:
- recursiveSkilledAgent: The RecursiveSkilledAgent instance
- prompt: Skill name as string or object

## Input Parsing

Accepts:
- String: Skill name directly or JSON with skillName/name property
- Object: With skillName or name property

## Validation Process

1. Parse skill name from input
2. Find skill file using agent's findSkillFile method
3. Check skill is editable
4. Read skill definition content
5. Call validateSkillContent from skillSchemas
6. Format and return results

## Validation Checks

The validateSkillContent function performs:

Type detection:
- Analyzes content to determine skill type
- Returns error if type cannot be determined

Required sections:
- Checks for all required sections per skill type
- Each missing section is an error

Title check:
- Verifies file starts with # heading

Optional sections:
- Notes which optional sections are missing
- Each missing optional section is a warning

Type-specific checks:
- tskill: Must have at least one field definition
- cgskill: Should have LLM Mode section

## Output Format

Valid skill:
```
Validation: skillname
File: skilltype.md
Detected Type: skilltype
Status: VALID

No issues found.
```

Valid with warnings:
```
Validation: skillname
File: skilltype.md
Detected Type: skilltype
Status: VALID

Warnings:
  - Optional section not present: ## SectionName
```

Invalid skill:
```
Validation: skillname
File: skilltype.md
Detected Type: skilltype
Status: INVALID

Errors:
  - Missing required section: ## RequiredSection
  - Skill file should start with a # title

Warnings:
  - Optional section not present: ## OptionalSection
```

## Error Handling

Missing skill name:
```
Error: skillName is required. Usage: validate-skill <skillName>
```

Skill not found:
```
Error: Skill "name" not found
```

Non-editable skill:
```
Error: Cannot validate skill "name" - it belongs to read-only repository "reponame".

To enable management, run: /edit-repo reponame
```

File read error:
```
Error reading skill file: [message]
```

## Dependencies

- skillSchemas: validateSkillContent
- fs: File operations
- path: Path manipulation
