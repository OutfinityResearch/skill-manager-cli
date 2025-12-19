# write-skill Module Specification

Creates or updates a skill definition file.

## Overview

This module writes skill definition files to the skills directory. It creates the skill directory if needed and automatically triggers skill reload after writing.

## Exported Function

### action

Main entry point for writing skills.

Accepts:
- recursiveSkilledAgent: The RecursiveSkilledAgent instance
- prompt: JSON object with write parameters

## Input Format

Requires JSON input (string or object) with:
- skillName: Name for the skill (used as directory name)
- fileName: File to write (e.g., cgskill.md, tskill.md, cskill.md)
- content: File content to write

## File Name Validation

Valid file names:
- Standard skill files from SKILL_FILE_NAMES constant
- Files ending with .mjs or .js

Non-standard files generate a warning but are still written.

## Write Process

1. Get skills directory from agent
2. Parse input arguments
3. Validate required fields (skillName, fileName, content)
4. Validate fileName against known patterns
5. Construct skill directory path
6. Create directory if needed (recursive)
7. Check if file already exists
8. Write file content
9. Auto-reload skills if possible
10. Return success message

## Auto-Reload

After writing, attempts to reload skills:
- Calls agent.reloadSkills() if available
- Reports count of registered skills
- Falls back gracefully if reload fails

## Output Format

Created new skill:
```
Created: skillname/skilltype.md (1234 bytes)
Skills reloaded (15 skill(s) registered).
```

Updated existing skill:
```
Updated: skillname/skilltype.md (1234 bytes)
Skills reloaded (15 skill(s) registered).
```

With reload failure:
```
Created: skillname/skilltype.md (1234 bytes)
Note: Could not auto-reload skills. Use "reload" command.
```

## Error Handling

No skills directory:
```
Error: skillsDir not available (agent.getSkillsDir() returned null)
```

Invalid JSON input:
```
Error: Invalid JSON input. Expected: {skillName, fileName, content}. Got: [first 100 chars]
```

Missing skillName:
```
Error: skillName is required
```

Missing fileName:
```
Error: fileName is required (e.g., cgskill.md, tskill.md, cskill.md)
```

Missing content:
```
Error: content is required
```

Non-standard file name (warning only):
```
Warning: "filename" is not a standard skill file. Valid skill files: cgskill.md, tskill.md, ...
```

Write error:
```
Error writing file: [message]
```

## Dependencies

- SKILL_FILE_NAMES from achillesAgentLib
- fs: File operations
- path: Path manipulation
