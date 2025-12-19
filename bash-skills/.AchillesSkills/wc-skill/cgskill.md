# wc - Word Count

Execute the `wc` command to count lines, words, and characters.

## Summary

Count lines, words, and bytes in a file.

## Parameters

- **path**: Target file path (required)
- **flags**: Array of flags from allowlist (optional)

## Allowed Flags

- `-l`: Count lines only
- `-w`: Count words only
- `-c`: Count bytes only
- `-m`: Count characters only
- `-L`: Print longest line length

## Examples

### Count lines in file
```json
{"path": "data.txt", "flags": ["-l"]}
```

### Count words
```json
{"path": "document.txt", "flags": ["-w"]}
```

### Full count (lines, words, bytes)
```json
{"path": "file.txt"}
```

## Module

wc-skill.mjs
