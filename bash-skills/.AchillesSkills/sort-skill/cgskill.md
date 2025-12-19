# sort - Sort Lines

Execute the `sort` command to sort lines of text.

## Summary

Sort lines of a text file.

## Parameters

- **path**: Target file path (required)
- **flags**: Array of flags from allowlist (optional)
- **flagArgs**: Object with flag arguments (optional)

## Allowed Flags

- `-n`: Numeric sort
- `-r`: Reverse order
- `-u`: Unique (remove duplicates)
- `-k`: Sort by field (requires argument)
- `-t`: Field delimiter (requires argument)
- `-f`: Ignore case

## Examples

### Numeric sort
```json
{"path": "numbers.txt", "flags": ["-n"]}
```

### Reverse alphabetic sort
```json
{"path": "names.txt", "flags": ["-r"]}
```

### Sort by second field, numeric
```json
{"path": "data.txt", "flags": ["-n"], "flagArgs": {"-k": "2", "-t": ","}}
```

### Unique sorted lines
```json
{"path": "list.txt", "flags": ["-u"]}
```

## Module

sort-skill.mjs
