# Bash Command Skill

A unified bash command skill with tiered permission controls for secure shell command execution.

## Overview

The `bash` skill allows execution of **any bash command** with intelligent safety controls:
- **Blocked commands**: Catastrophic operations (rm -rf /, mkfs) are refused entirely
- **Dangerous commands**: Destructive operations (rm, chmod) require typing "yes"
- **Caution commands**: Modifying operations (mv, sed -i) show yellow warnings
- **Normal commands**: Read-only operations use standard permission prompts

## Permission System

Commands are classified by risk tier with appropriate prompts:

### Normal Command (ls, cat, grep, etc.)
```
$ ls -la /tmp
Allow? [y]es / [a]lways / [n]o: _
```

### Caution Command (mv, cp, sed -i, etc.)
```
Caution
'mv' modifies files
$ mv file1.txt file2.txt
Allow? [y]es / [a]lways / [n]o: _
```

### Dangerous Command (rm, chmod, kill, etc.)
```
DANGEROUS COMMAND
'rm' can permanently modify or delete data
$ rm important-file.txt
Type "yes" to confirm: _
```

### Blocked Patterns (rm -rf /, mkfs, etc.)
```
BLOCKED: Matches blocked dangerous pattern
This command pattern is not allowed for safety.
```

## Risk Tiers

| Tier | Commands | Behavior |
|------|----------|----------|
| **Blocked** | `rm -rf /`, `mkfs`, `fdisk`, `shred`, fork bombs | Refused entirely |
| **Dangerous** | `rm`, `rmdir`, `chmod`, `chown`, `kill`, `pkill`, `shutdown` | Red warning, must type "yes" |
| **Caution** | `mv`, `cp`, `truncate`, `sed -i`, output redirection | Yellow warning, y/a/n prompt |
| **Normal** | `ls`, `cat`, `grep`, `find`, `head`, `tail`, `pwd`, etc. | Standard y/a/n prompt |

## User Options

| Input | Action |
|-------|--------|
| `y` or `yes` | Allow this execution only |
| `a` or `always` | Allow all future commands of this type this session |
| `n` or `no` | Deny execution |

For dangerous commands, only `yes` (full word) is accepted.

## Skip Permissions

For trusted environments, you can skip all permission prompts:

```bash
# Via environment variable
SKIP_BASH_PERMISSIONS=true skill-manager

# Via context flag (for programmatic use)
# Pass { skipBashPermissions: true } in context
```

## Installation

```bash
# Add as a skill repository
/add-repo ./bash-skills

# Or with editing enabled
/add-repo ./bash-skills --editable
```

## Usage Examples

### Via Natural Language
```
> bash ls -la /tmp
> bash grep -r "TODO" src/
> bash find . -name "*.js"
> bash cat package.json
> bash head -n 20 log.txt
```

### Via Direct Skill Execution
```bash
# List directory
/exec bash "ls -la /tmp"

# Search for pattern
/exec bash "grep -rn 'function' src/"

# Find files
/exec bash "find . -type f -name '*.md'"

# Git operations
/exec bash "git status"
/exec bash "git log --oneline -10"
```

## Security Model

### Command Execution Safety

- Commands run via `spawnSync` with `shell: false` (no shell injection)
- 30-second timeout by default
- 1MB output size limit
- Non-zero exit codes handled gracefully

### Blocked Patterns

The following patterns are always blocked:
- `rm -rf /` or `rm -rf /*` (recursive deletion of root)
- Fork bombs like `:(){ :|:& };:`
- `dd if=/dev/zero` (disk wipe)
- `> /dev/sd*` (write to disk device)
- `chmod 777 /` (insecure permissions on root)
- Commands: `mkfs`, `fdisk`, `parted`, `shred`

### Risk Classification

The risk classifier examines:
1. The command name (is it inherently dangerous?)
2. The full command string (does it match blocked patterns?)
3. Flags used (is `-i` or `--in-place` present?)
4. Output redirection (is `>` or `| tee` present?)

## Architecture

```
bash-skills/.AchillesSkills/
└── bash/
    ├── cgskill.md           # Skill definition
    ├── bash.mjs             # Entry point
    ├── parser.mjs           # Command line tokenizer
    ├── riskClassifier.mjs   # Risk tier classification
    └── permissions.mjs      # Tiered permission system
```

## License

MIT
