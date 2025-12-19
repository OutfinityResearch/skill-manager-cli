# tail - Display Last Lines

Execute the `tail` command to display the last lines of a file.

## Summary

Display the last N lines of a file (default 10).

## Parameters

- **path**: Target file path (required)
- **flags**: Array of flags from allowlist (optional)
- **flagArgs**: Object with flag arguments, e.g., `{"-n": "20"}` (optional)

## Allowed Flags

- `-n`: Number of lines to show (requires argument)
- `-c`: Number of bytes to show (requires argument)
- `-q`: Never print headers

Note: `-f` (follow) is intentionally not supported as it blocks indefinitely.

## Examples

### Show last 20 lines
```json
{"path": "log.txt", "flagArgs": {"-n": "20"}}
```

### Show last 100 bytes
```json
{"path": "data.bin", "flagArgs": {"-c": "100"}}
```

## Module

tail-skill.mjs
