# cat - Display File Contents

Execute the `cat` command to display file contents with validated parameters.

## Summary

Display the contents of a file.

## Parameters

- **path**: Target file path (required)
- **flags**: Array of flags from allowlist (optional)

## Allowed Flags

- `-n`: Number all output lines
- `-b`: Number non-blank output lines
- `-s`: Squeeze multiple blank lines into one
- `-A`: Show all (equivalent to -vET)
- `-E`: Show $ at end of each line
- `-T`: Show TAB characters as ^I

## Examples

### Display file with line numbers
```json
{"path": "/etc/hosts", "flags": ["-n"]}
```

### Display file showing all characters
```json
{"path": "config.txt", "flags": ["-A"]}
```

## Module

cat-skill.mjs
