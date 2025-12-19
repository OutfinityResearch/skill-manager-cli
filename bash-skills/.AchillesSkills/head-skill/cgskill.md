# head - Display First Lines

Execute the `head` command to display the first lines of a file.

## Summary

Display the first N lines of a file (default 10).

## Parameters

- **path**: Target file path (required)
- **flags**: Array of flags from allowlist (optional)
- **flagArgs**: Object with flag arguments, e.g., `{"-n": "20"}` (optional)

## Allowed Flags

- `-n`: Number of lines to show (requires argument)
- `-c`: Number of bytes to show (requires argument)
- `-q`: Never print headers

## Examples

### Show first 20 lines
```json
{"path": "log.txt", "flagArgs": {"-n": "20"}}
```

### Show first 100 bytes
```json
{"path": "data.bin", "flagArgs": {"-c": "100"}}
```

## Module

head-skill.mjs
