# ls - List Directory Contents

Execute the `ls` command to list directory contents with validated parameters.

## Summary

List files and directories with optional formatting flags. Automatically differentiates between file types using indicators.

## Output Style

Uses bash-style coloring (always enabled):
- **Bold Blue** = directory (with `/` suffix)
- **Bold Green** = executable (with `*` suffix)
- **Cyan** = symbolic link (with `@` suffix)
- Normal = regular file

## Parameters

- **path**: Target directory path (required)
- **flags**: Array of flags from allowlist (optional)
- **flagArgs**: Object with flag arguments, e.g., `{}` (optional)

## Allowed Flags

- `-l`: Use long listing format
- `-a`: Show hidden files (starting with .)
- `-h`: Human-readable sizes
- `-R`: List subdirectories recursively
- `-t`: Sort by modification time
- `-S`: Sort by file size
- `-1`: One file per line
- `-d`: List directories themselves, not contents
- `-F`: Append type indicator (always enabled by default)

## Examples

### List all files with details
```json
{"path": "/tmp", "flags": ["-la"]}
```
Output example:
```
drwxr-xr-x  2 user group 4096 Dec 19 10:00 mydir/
-rw-r--r--  1 user group  123 Dec 19 10:00 file.txt
-rwxr-xr-x  1 user group  456 Dec 19 10:00 script.sh*
lrwxrwxrwx  1 user group   10 Dec 19 10:00 link@ -> target
```

### List with human-readable sizes
```json
{"path": ".", "flags": ["-lh"]}
```

## Module

ls-skill.mjs
