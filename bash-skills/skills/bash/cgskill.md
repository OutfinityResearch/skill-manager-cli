# Bash - Execute Shell Commands

Execute any bash command with tiered permission controls. Dangerous commands
require explicit confirmation.

## Summary

Universal bash command execution with smart safety controls. Any command can
be executed, but destructive commands (rm, chmod, etc.) show warnings and
require explicit confirmation.

## Input Format

Pass the command exactly as you would type it in a terminal:

```
ls -la /tmp
grep -r "pattern" src/
find . -name "*.js"
rm unwanted-file.txt
git status
```

## Risk Tiers

| Tier | Example Commands | Behavior |
|------|------------------|----------|
| Blocked | rm -rf /, fork bombs | Refused entirely |
| Dangerous | rm, chmod, kill | Red warning, "yes" required |
| Caution | mv, sed -i | Yellow warning, confirmation |
| Normal | ls, cat, grep | Standard permission |

## Security

- Commands executed via spawnSync with shell: false
- Dangerous patterns detected and warned
- Interactive permission prompts
- Timeout (30s) and output limits (1MB)

## Module

bash.mjs
