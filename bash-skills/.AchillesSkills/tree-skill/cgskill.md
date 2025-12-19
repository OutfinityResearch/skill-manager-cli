# tree - Display Directory Tree

Execute the `tree` command to display directory structure as a tree.

## Summary

Display directory contents in a tree-like format.

## Parameters

- **path**: Target directory path (required)
- **flags**: Array of flags from allowlist (optional)
- **flagArgs**: Object with flag arguments (optional)

## Allowed Flags

- `-L`: Maximum depth level (requires argument)
- `-d`: List directories only
- `-a`: Show hidden files
- `-I`: Exclude pattern (requires argument)
- `-f`: Print full path prefix

## Examples

### Show tree with depth limit
```json
{"path": "src/", "flagArgs": {"-L": "2"}}
```

### Show directories only
```json
{"path": ".", "flags": ["-d"]}
```

### Exclude node_modules
```json
{"path": ".", "flagArgs": {"-I": "node_modules"}}
```

## Module

tree-skill.mjs
