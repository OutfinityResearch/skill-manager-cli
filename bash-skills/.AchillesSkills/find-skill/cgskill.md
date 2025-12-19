# find - Search for Files

Execute the `find` command to search for files by name, type, or other criteria.

## Summary

Search for files and directories matching specified criteria. Output includes type indicators for easy identification.

## Output Style

Uses bash-style coloring:
- **Bold Blue** = directory
- **Bold Green** = executable file
- **Cyan** = symbolic link
- Normal = regular file

## Parameters

- **path**: Starting directory path (required)
- **flags**: Array of flags from allowlist (optional)
- **flagArgs**: Object with flag arguments (optional)

## Allowed Flags

- `-name`: Match filename pattern (requires argument)
- `-type`: File type: f=file, d=directory, l=link (requires argument)
- `-mtime`: Modified time in days (requires argument)
- `-size`: File size with suffix (requires argument)
- `-maxdepth`: Maximum directory depth (requires argument)

## Examples

### Find all JavaScript files
```json
{"path": "src/", "flagArgs": {"-name": "*.js"}}
```
Output: Files shown in normal text (or bold green if executable)

### Find directories only
```json
{"path": ".", "flagArgs": {"-type": "d"}}
```
Output: Directories shown in **bold blue**

### Find large files
```json
{"path": "/tmp", "flagArgs": {"-type": "f", "-size": "+10M"}}
```

### Find with depth limit
```json
{"path": ".", "flagArgs": {"-maxdepth": "2", "-name": "*.md"}}
```

## Module

find-skill.mjs
