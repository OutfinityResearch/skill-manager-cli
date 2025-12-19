# grep - Search for Patterns

Execute the `grep` command to search for patterns in files with validated parameters.

## Summary

Search for text patterns in files using regular expressions.

## Parameters

- **path**: Target file or directory path (required)
- **pattern**: Search pattern (required)
- **flags**: Array of flags from allowlist (optional)

## Allowed Flags

- `-i`: Case insensitive search
- `-n`: Show line numbers
- `-r`: Recursive search in directories
- `-l`: Only show filenames with matches
- `-c`: Count matching lines
- `-v`: Invert match (show non-matching lines)
- `-E`: Extended regular expressions
- `-w`: Match whole words only
- `-H`: Print filename with matches
- `-h`: Suppress filename prefix

## Examples

### Search case-insensitively with line numbers
```json
{"path": "src/", "pattern": "TODO", "flags": ["-rni"]}
```

### Count matches in a file
```json
{"path": "log.txt", "pattern": "error", "flags": ["-ci"]}
```

### Find files containing pattern
```json
{"path": ".", "pattern": "function", "flags": ["-rl"]}
```

## Module

grep-skill.mjs
