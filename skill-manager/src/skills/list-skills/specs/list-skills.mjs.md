# list-skills Module Specification

Lists registered skills from the catalog with filtering.

## Overview

This module returns all registered skills. By default, it shows only user skills (excluding built-in skills).

## Exported Function

### action

Main entry point for the skill.

Accepts:
- recursiveSkilledAgent: The RecursiveSkilledAgent instance
- prompt: Input string or object specifying filter options

## Input Parsing

The prompt can be:
- Empty: List all user skills
- String "all" or "list all skills": Include built-in skills
- String with type name: Filter by skill type
- Object with filter property: Filter by skill type

Ignored patterns:
- Common command phrases like "list skills", "show all skills"
- Full command sentences with more than 3 words

## Output Format

Success output:
```
Found N user skill(s):

[type] skillName
   Summary: Skill summary text
   Path: /path/to/skill/directory

[type] anotherSkill
   Summary: Another summary
   Path: /path/to/another/skill
```

When filtered:
```
Found N skill(s) matching "filter":
...
```

When showing all (including built-in):
```
Found N skill(s):
...
```

No skills found:
- If showing all: "No skills currently registered..."
- If user only: "No user skills found..."

Filter mismatch:
```
No skills found matching filter: "typename"
Available types: type1, type2, type3
```

## Error Handling

Returns error message if no skill catalog is available.

## Dependencies

- Sanitiser from achillesAgentLib for name normalization
- None
