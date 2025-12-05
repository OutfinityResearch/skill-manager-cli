# Design Spec: src/repl/QuickCommands.mjs

ID: DS(/repl/QuickCommands.mjs)

## Overview

**Role**: Handles built-in REPL commands that execute instantly without LLM invocation. Provides fast responses for common operations.

**Pattern**: Command handler with callback-based execution for actions requiring external state.

**Key Collaborators**:
- `HistoryManager` - for history commands
- `HelpPrinter` - for help and history display
- Callbacks from REPLSession - for skill listing and reloading

## What It Does

QuickCommands handles the following instant commands:
- `help` - Show quick reference help
- `reload` - Refresh skills from disk
- `list` / `ls` - List user skills
- `list all` / `ls -a` - List all skills including built-in
- `history` / `hist` - Show command history
- `history <n>` - Show last n commands
- `history <query>` - Search history
- `history clear` - Clear history

## How It Does It

### Command Detection
```javascript
isQuickCommand(input) {
    const lower = input.toLowerCase();
    return (
        lower === 'help' ||
        lower === 'reload' ||
        lower === 'list' ||
        lower === 'ls' ||
        lower === 'list all' ||
        lower === 'ls -a' ||
        lower === 'history' ||
        lower === 'hist' ||
        lower.startsWith('history ') ||
        lower.startsWith('hist ')
    );
}
```

### Command Execution
```javascript
execute(input) {
    const lower = input.toLowerCase();

    if (lower === 'help') {
        printHelp();
        return { handled: true };
    }

    if (lower === 'reload') {
        return this._handleReload();
    }

    if (lower === 'list' || lower === 'ls') {
        return this._handleList(false);  // User skills only
    }

    if (lower === 'list all' || lower === 'ls -a') {
        return this._handleList(true);   // All skills
    }

    if (lower === 'history' || lower === 'hist') {
        showHistory(this.historyManager);
        return { handled: true };
    }

    if (lower.startsWith('history ') || lower.startsWith('hist ')) {
        return this._handleHistory(input);
    }

    return { handled: false };
}
```

### List Handler with Built-in Filtering
```javascript
_handleList(showAll) {
    if (showAll) {
        const skills = this.getAllSkills();
        const builtIn = this.builtInSkillsDir
            ? skills.filter(s => s.skillDir?.startsWith(this.builtInSkillsDir))
            : [];
        const user = this.builtInSkillsDir
            ? skills.filter(s => !s.skillDir?.startsWith(this.builtInSkillsDir))
            : skills;

        console.log('\nAll skills:');
        if (user.length > 0) {
            console.log('  User:');
            user.forEach(s => console.log(`    • [${s.type}] ${s.shortName || s.name}`));
        }
        if (builtIn.length > 0) {
            console.log('  Built-in:');
            builtIn.forEach(s => console.log(`    • [${s.type}] ${s.shortName || s.name}`));
        }
    } else {
        const skills = this.getUserSkills();
        if (skills.length === 0) {
            console.log('\nNo user skills found.\n');
        } else {
            console.log('\nUser skills:');
            skills.forEach(s => console.log(`  • [${s.type}] ${s.shortName || s.name}`));
        }
    }
    return { handled: true };
}
```

### History Handler with Subcommands
```javascript
_handleHistory(input) {
    const arg = input.split(/\s+/).slice(1).join(' ');

    if (arg === 'clear') {
        this.historyManager.clear();
        console.log('\nHistory cleared.\n');
    } else if (arg.match(/^\d+$/)) {
        showHistory(this.historyManager, parseInt(arg, 10));
    } else {
        // Search history
        searchHistory(this.historyManager, arg);
    }

    return { handled: true };
}
```

## Why This Design

### 1. String-Based Detection
**Decision**: Check against specific string values rather than using a command registry.

**Rationale**:
- Quick commands are few and fixed
- Case-insensitive comparison is simple
- No need for extensibility
- Clear what commands exist

### 2. Callback Pattern for External Operations
**Decision**: Use callbacks (getUserSkills, getAllSkills, reloadSkills) rather than direct agent access.

**Rationale**:
- QuickCommands doesn't need to know about agent internals
- Easier to test with mock callbacks
- Clear contract between modules
- REPLSession controls what functions are available

### 3. Separate from Slash Commands
**Decision**: Keep quick commands distinct from slash commands.

**Rationale**:
- Quick commands are natural language ("help" not "/help")
- Different detection logic (no "/" prefix)
- Different execution path (no skill invocation)
- Faster processing (checked before slash commands)

### 4. Inline Display
**Decision**: Print output directly to console rather than returning formatted strings.

**Rationale**:
- Immediate feedback for simple commands
- No async processing needed
- Simpler implementation
- Consistent with REPL expectations

## Public API

### Constructor
```javascript
new QuickCommands({
    getUserSkills,    // () => userSkills[]
    getAllSkills,     // () => allSkills[]
    reloadSkills,     // () => count
    historyManager,   // HistoryManager instance
    builtInSkillsDir, // Path for filtering (optional)
})
```

### Methods
```javascript
isQuickCommand(input)  // Returns boolean
execute(input)         // Returns { handled: boolean }
```

## Pseudocode

```javascript
class QuickCommands {
    constructor({ getUserSkills, getAllSkills, reloadSkills, historyManager, builtInSkillsDir }) {
        this.getUserSkills = getUserSkills;
        this.getAllSkills = getAllSkills;
        this.reloadSkills = reloadSkills;
        this.historyManager = historyManager;
        this.builtInSkillsDir = builtInSkillsDir;
    }

    isQuickCommand(input) {
        lower = input.toLowerCase();
        return lower in ['help', 'reload', 'list', 'ls', 'list all', 'ls -a',
                        'history', 'hist'] || lower.startsWith('history ');
    }

    execute(input) {
        switch (input.toLowerCase()) {
            case 'help':
                printHelp();
                return { handled: true };

            case 'reload':
                count = this.reloadSkills();
                print(`Reloaded ${count} skills`);
                return { handled: true };

            case 'list':
            case 'ls':
                displayUserSkills();
                return { handled: true };

            case 'list all':
            case 'ls -a':
                displayAllSkillsGrouped();
                return { handled: true };

            case 'history':
            case 'hist':
                showHistory(this.historyManager);
                return { handled: true };

            default:
                if (input.startsWith('history ')) {
                    handleHistorySubcommand(input);
                    return { handled: true };
                }
                return { handled: false };
        }
    }
}
```

## Command Reference

| Command | Description |
|---------|-------------|
| `help` | Show quick reference help |
| `reload` | Refresh skills from disk |
| `list`, `ls` | List user skills only |
| `list all`, `ls -a` | List all skills (user + built-in) |
| `history`, `hist` | Show last 20 commands |
| `history <n>` | Show last n commands |
| `history <query>` | Search history for query |
| `history clear` | Clear all history |

## Notes/Constraints

- Commands are case-insensitive
- Output is printed directly (synchronous)
- No spinner needed (instant execution)
- Reload uses spinner for visual feedback
- History search is case-insensitive substring match
- Empty skills list shows helpful message
