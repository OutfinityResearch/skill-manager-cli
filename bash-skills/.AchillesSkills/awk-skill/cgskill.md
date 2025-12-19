# awk - Text Processing

Execute the `awk` command for text processing and field extraction.

## Summary

Process text files with field-based operations.

## Parameters

- **path**: Target file path (required)
- **pattern**: AWK program/pattern (required)
- **flagArgs**: Object with flag arguments (optional)

## Allowed Flags

- `-F`: Field separator (requires argument)

## Examples

### Print first column
```json
{"path": "data.txt", "pattern": "{print $1}"}
```

### Print columns 1 and 3 with custom separator
```json
{"path": "data.csv", "pattern": "{print $1, $3}", "flagArgs": {"-F": ","}}
```

### Sum values in column 2
```json
{"path": "numbers.txt", "pattern": "{sum += $2} END {print sum}"}
```

## Security

- Only simple AWK patterns allowed
- No system() or getline calls
- No pipe or redirection within pattern

## Module

awk-skill.mjs
