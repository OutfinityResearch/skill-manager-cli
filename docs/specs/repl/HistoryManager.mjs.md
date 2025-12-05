# Design Spec: src/repl/HistoryManager.mjs

ID: DS(/repl/HistoryManager.mjs)

## Overview

**Role**: Manages persistent command history for the CLI, providing per-project storage, navigation, and search capabilities.

**Pattern**: Stateful manager with file-based persistence and index-based navigation.

**Key Collaborators**:
- `fs` (Node.js) - file operations for persistence
- `InteractivePrompt` - uses navigation methods
- `QuickCommands` - uses getRecent and search methods

## What It Does

HistoryManager provides:

1. **Persistence**: Stores history in `.skill-manager-history` per working directory
2. **Navigation**: Arrow key navigation through history (getPrevious, getNext)
3. **Search**: Find commands containing a query string
4. **Deduplication**: Prevents consecutive duplicate entries
5. **Limiting**: Caps history at configurable max entries (default: 1000)

## How It Does It

### File-Based Persistence
```javascript
_load() {
    try {
        if (fs.existsSync(this.historyPath)) {
            const content = fs.readFileSync(this.historyPath, 'utf-8');
            this.history = content
                .split('\n')
                .filter(line => line.trim() !== '');

            // Trim to max entries if needed
            if (this.history.length > this.maxEntries) {
                this.history = this.history.slice(-this.maxEntries);
                this._save();
            }
        }
    } catch (error) {
        // Silently ignore read errors
        this.history = [];
    }
}

_save() {
    try {
        fs.writeFileSync(this.historyPath, this.history.join('\n') + '\n', 'utf-8');
    } catch (error) {
        // Silently ignore write errors
    }
}
```

### Index-Based Navigation
```javascript
// currentIndex: -1 = new input, 0..n = position from end of history

getPrevious() {
    if (this.history.length === 0) return null;

    if (this.currentIndex === -1) {
        // Start from the end
        this.currentIndex = this.history.length - 1;
    } else if (this.currentIndex > 0) {
        this.currentIndex--;
    }

    return this.history[this.currentIndex];
}

getNext() {
    if (this.currentIndex === -1) return null;

    if (this.currentIndex < this.history.length - 1) {
        this.currentIndex++;
        return this.history[this.currentIndex];
    } else {
        // At the end, reset to new input position
        this.currentIndex = -1;
        return null;
    }
}

resetNavigation() {
    this.currentIndex = -1;
}
```

### Adding with Deduplication
```javascript
add(command) {
    const trimmed = command.trim();
    if (!trimmed) return;

    // Don't add duplicates of the last command
    if (this.history.length > 0 && this.history[this.history.length - 1] === trimmed) {
        this.resetNavigation();
        return;
    }

    this.history.push(trimmed);

    // Trim if over max
    if (this.history.length > this.maxEntries) {
        this.history = this.history.slice(-this.maxEntries);
    }

    this._save();
    this.resetNavigation();
}
```

### Search Implementation
```javascript
search(query, limit = 10) {
    const lowerQuery = query.toLowerCase();
    const results = [];

    // Search from newest to oldest
    for (let i = this.history.length - 1; i >= 0 && results.length < limit; i--) {
        if (this.history[i].toLowerCase().includes(lowerQuery)) {
            results.push({
                index: i + 1,  // 1-based for display
                command: this.history[i],
            });
        }
    }

    return results;
}
```

## Why This Design

### 1. Per-Project History
**Decision**: Store history in `.skill-manager-history` in the working directory.

**Rationale**:
- Different projects have different skill sets
- History suggestions are context-relevant
- Easy to gitignore if desired
- No global state pollution
- Multiple developers on same machine don't share

### 2. Silent Error Handling
**Decision**: Silently ignore file read/write errors.

**Rationale**:
- History is a convenience feature, not critical
- Read-only filesystems shouldn't break the CLI
- Permission issues shouldn't crash the app
- User doesn't need to see history errors

### 3. Index-Based Navigation (-1 Convention)
**Decision**: Use -1 to indicate "not navigating" (new input position).

**Rationale**:
- Clear distinction between history browsing and new input
- Simple increment/decrement logic
- null return signals "back to new input"
- Matches shell history behavior

### 4. Newest-to-Oldest Search
**Decision**: Search returns results ordered from newest to oldest.

**Rationale**:
- Recent matches are more likely to be relevant
- Matches shell history search behavior
- Early termination when limit reached
- Most useful results first

### 5. Line-Based File Format
**Decision**: Simple newline-separated text file.

**Rationale**:
- Human-readable (can edit manually)
- Simple parsing (split on newline)
- One command per line
- Easy to inspect/debug

## Public API

### Constructor
```javascript
new HistoryManager({
    workingDir,   // Base directory (default: cwd)
    historyFile,  // Filename (default: '.skill-manager-history')
    maxEntries,   // Max entries to keep (default: 1000)
})
```

### Methods
```javascript
add(command)                     // Add command to history
get(index)                       // Get command by index (0-based)
getPrevious()                    // Navigate to previous (older) command
getNext()                        // Navigate to next (newer) command
resetNavigation()                // Reset to new input position
getRecent(count = 10)            // Get recent commands with indices
search(query, limit = 10)        // Search for matching commands
getAll()                         // Get all history entries
clear()                          // Clear all history
getHistoryPath()                 // Get path to history file

// Properties
length                           // Number of history entries (getter)
```

## Pseudocode

```javascript
class HistoryManager {
    constructor(options) {
        this.historyPath = path.join(options.workingDir, '.skill-manager-history');
        this.maxEntries = options.maxEntries || 1000;
        this.history = [];
        this.currentIndex = -1;  // -1 = new input position

        this._load();
    }

    add(command) {
        if (!command.trim()) return;
        if (lastCommand() === command) return;  // No consecutive duplicates

        history.push(command);
        trimToMax();
        save();
        resetNavigation();
    }

    getPrevious() {
        if (empty()) return null;
        if (currentIndex === -1) {
            currentIndex = history.length - 1;
        } else if (currentIndex > 0) {
            currentIndex--;
        }
        return history[currentIndex];
    }

    getNext() {
        if (currentIndex === -1) return null;
        if (currentIndex < history.length - 1) {
            currentIndex++;
            return history[currentIndex];
        }
        currentIndex = -1;
        return null;
    }

    search(query, limit) {
        results = [];
        for (i = history.length - 1; i >= 0 && results.length < limit; i--) {
            if (history[i].includes(query)) {
                results.push({ index: i + 1, command: history[i] });
            }
        }
        return results;
    }
}
```

## File Format

```
list skills
/read equipment
create a tskill called inventory
/generate equipment
history
```

- One command per line
- No metadata (timestamps, etc.)
- Empty lines are filtered on load
- Trailing newline after last entry

## Notes/Constraints

- History loads synchronously in constructor
- Save happens immediately on add()
- currentIndex is internal state for navigation
- resetNavigation() called after add() and on new input
- 1-based indices in getRecent() and search() for user display
- getAll() returns a copy (not the internal array)
- clear() persists empty file immediately
