# read-skill Module Specification

Reads a skill definition file and returns its content.

## Overview

This module reads and returns the content of a skill definition file (.md). It enforces editability restrictions to prevent reading skills from non-editable repositories.

## Editability Check

Only editable skills can be read:
- Local skills (in working directory)
- Skills from repos marked as editable

Non-editable skills return error with hint to enable editing.

## Exported Function

### action

Main entry point for reading skills.

Accepts:
- recursiveSkilledAgent: The RecursiveSkilledAgent instance
- prompt: Skill name as string or object

## Input Parsing

Accepts:
- String: Skill name directly or JSON with skillName/name property
- Object: With skillName or name property

## Read Process

1. Parse skill name from input
2. Find skill file using agent's findSkillFile method
3. Check skill is editable
4. Read file content
5. Format and return with metadata

## Output Format

Success:
```
=== skilltype.md ===
Path: /full/path/to/skilltype.md
Type: skilltype

[Full file content]
```

## Error Handling

Missing skill name:
```
Error: skillName is required. Usage: read-skill <skillName>
```

Skill not found:
```
Error: Skill "name" not found.
Available editable skills: skill1, skill2, skill3
```

The available skills list shows only editable skills.

Non-editable skill:
```
Error: Cannot read skill "name" - it belongs to read-only repository "reponame".

To enable editing, run: /edit-repo reponame
```

File read error:
```
Error reading skill file: [message]
```

## Dependencies

- fs: File operations
- path: Path manipulation
