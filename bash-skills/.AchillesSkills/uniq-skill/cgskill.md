# uniq - Filter Duplicates

Execute the `uniq` command to filter or report repeated lines.

## Summary

Report or filter out repeated lines in a sorted file.

## Parameters

- **path**: Target file path (required) - should be sorted first
- **flags**: Array of flags from allowlist (optional)

## Allowed Flags

- `-c`: Prefix lines by count
- `-d`: Only print duplicate lines
- `-u`: Only print unique lines
- `-i`: Ignore case

## Examples

### Count occurrences
```json
{"path": "sorted.txt", "flags": ["-c"]}
```

### Show only duplicates
```json
{"path": "sorted.txt", "flags": ["-d"]}
```

### Show only unique lines
```json
{"path": "sorted.txt", "flags": ["-u"]}
```

### Case-insensitive uniqueness
```json
{"path": "names.txt", "flags": ["-i"]}
```

## Note

Input should be sorted first for `uniq` to work correctly. Use `sort-skill` first if needed.

## Module

uniq-skill.mjs
