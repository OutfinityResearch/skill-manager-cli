# sed - Stream Editor

Execute the `sed` command for text transformation.

## Summary

Transform text using stream editing patterns.

## Parameters

- **path**: Target file path (required)
- **pattern**: SED expression (required)
- **flags**: Array of flags from allowlist (optional)

## Allowed Flags

- `-n`: Suppress automatic printing
- `-e`: Add script expression (for multiple expressions)

## Examples

### Substitute text (first occurrence per line)
```json
{"path": "file.txt", "pattern": "s/old/new/"}
```

### Global substitution
```json
{"path": "file.txt", "pattern": "s/old/new/g"}
```

### Delete lines matching pattern
```json
{"path": "file.txt", "pattern": "/pattern/d"}
```

### Print only matching lines
```json
{"path": "file.txt", "pattern": "/pattern/p", "flags": ["-n"]}
```

## Security

- Read-only operations only (no in-place editing)
- No w command (write to file)
- No e command (execute)

## Module

sed-skill.mjs
