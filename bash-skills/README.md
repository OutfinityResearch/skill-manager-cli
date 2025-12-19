# Bash Command Skills Repository

A collection of secure, validated bash command skills for use with skill-manager-cli.

## Overview

This repository provides individual skills for common bash commands. Each skill:
- **Prompts for permission** before executing (like Claude Code)
- Has a strict allowlist of permitted flags
- Validates all input paths to prevent traversal attacks
- Blocks shell injection patterns
- Has timeout and output size limits

## Permission System

Before executing any command, the skill will prompt for permission:

```
╭─ Bash Command ────────────────────────────────────────────╮
│ ls -la /tmp                                               │
╰───────────────────────────────────────────────────────────╯
Allow? [y]es once / [a]llow all ls / [n]o: _
```

### User Options

| Input | Action |
|-------|--------|
| `y` or `yes` | Allow this execution only |
| `a` or `all` | Allow all future `ls` commands this session |
| `n` or `no` | Deny execution |
| `d` or `deny` | Deny all future commands of this type |

### Skip Permissions

For trusted environments, you can skip all permission prompts:

```bash
# Via environment variable
SKIP_BASH_PERMISSIONS=true skill-manager

# Via context flag (for programmatic use)
# Pass { skipBashPermissions: true } in context
```

### Non-Interactive Mode

When running without a terminal (no `promptReader`), commands are denied by default for safety. Use the skip flag to allow execution in scripts.

## Installation

```bash
# Add as a skill repository
/add-repo ./bash-skills

# Or with editing enabled
/add-repo ./bash-skills --editable
```

## Available Skills

### File Reading

| Skill | Command | Description |
|-------|---------|-------------|
| `cat-skill` | `cat` | Display file contents |
| `head-skill` | `head` | Display first N lines |
| `tail-skill` | `tail` | Display last N lines |

### Directory Listing

| Skill | Command | Description |
|-------|---------|-------------|
| `ls-skill` | `ls` | List directory contents |
| `find-skill` | `find` | Search for files |
| `tree-skill` | `tree` | Display directory tree |

### Search & Transform

| Skill | Command | Description |
|-------|---------|-------------|
| `grep-skill` | `grep` | Search for patterns |
| `awk-skill` | `awk` | Text processing |
| `sed-skill` | `sed` | Stream editing |

### Utilities

| Skill | Command | Description |
|-------|---------|-------------|
| `wc-skill` | `wc` | Count lines/words/bytes |
| `sort-skill` | `sort` | Sort lines |
| `uniq-skill` | `uniq` | Filter duplicates |
| `pwd-skill` | `pwd` | Print working directory |

## Usage Examples

### Via Natural Language
```
> list all files in /tmp
> show the first 20 lines of config.json
> search for "TODO" in all JavaScript files
> count lines in package.json
```

### Via Direct Skill Execution
```bash
# List directory
/exec ls-skill {"path": "/tmp", "flags": ["-la"]}

# Search for pattern
/exec grep-skill {"path": "src/", "pattern": "function", "flags": ["-rn"]}

# Count lines
/exec wc-skill {"path": "data.txt", "flags": ["-l"]}

# Display first 20 lines
/exec head-skill {"path": "log.txt", "flagArgs": {"-n": "20"}}
```

## Security Model

### Allowlist-Only Flags

Each skill has a hardcoded list of allowed flags. Any flag not in the allowlist is rejected.

### Path Validation

- No `..` (directory traversal)
- No shell expansion (`$()`, backticks, `${}`)
- No pipes (`|`) or redirects (`>`, `<`)
- No command chaining (`;`, `&&`, `||`)

### Execution Safety

- Commands run via `spawnSync` with `shell: false`
- 30-second timeout by default
- 1MB output size limit
- Non-zero exit codes handled gracefully

## Skill Input Format

All skills accept JSON input with these common fields:

```json
{
  "path": "/path/to/target",
  "flags": ["-l", "-a"],
  "flagArgs": {"-n": "10"},
  "pattern": "search pattern"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `path` | string | Target file or directory (required) |
| `flags` | string[] | Simple flags like `-l`, `-a` |
| `flagArgs` | object | Flags with arguments like `{"-n": "10"}` |
| `pattern` | string | Search/transform pattern (grep, sed, awk) |

## Extending

To add a new command skill:

1. Create a directory: `bash-skills/.AchillesSkills/mycommand-skill/`
2. Add `cgskill.md` with skill definition
3. Add `mycommand-skill.mjs` with implementation
4. Use shared utilities from `_shared/`

### Template

```javascript
import { validatePath, validateFlags, parseInput } from '../_shared/validation.mjs';
import { executeWithPermission, buildArgs } from '../_shared/executor.mjs';

const ALLOWED_FLAGS = ['-flag1', '-flag2'];

export async function action(agent, prompt) {
    const { path, flags = [] } = parseInput(prompt);

    const pathCheck = validatePath(path);
    if (!pathCheck.valid) return `Error: ${pathCheck.error}`;

    const flagCheck = validateFlags(flags, ALLOWED_FLAGS);
    if (!flagCheck.valid) return `Error: ${flagCheck.error}`;

    const args = buildArgs(flags, {}, pathCheck.path);
    const context = agent?.context || {};
    const result = await executeWithPermission('mycommand', args, agent, { context });

    if (result.denied) return `Execution denied: ${result.error}`;
    return result.success ? result.output : `Error: ${result.error}`;
}

export default action;
```

## License

MIT
