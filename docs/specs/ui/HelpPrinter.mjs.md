# Design Spec: src/ui/HelpPrinter.mjs

ID: DS(/ui/HelpPrinter.mjs)

## Overview

**Role**: Stateless utility functions for displaying help screens and command history to the user.

**Pattern**: Pure functions with direct console output.

**Key Collaborators**:
- `QuickCommands` - calls printHelp and showHistory
- `HistoryManager` - provides history data

## What It Does

HelpPrinter provides:

1. **printHelp**: Display the quick reference help screen
2. **showHistory**: Display recent command history
3. **searchHistory**: Search and display matching history entries

## How It Does It

### Help Screen
```javascript
export function printHelp() {
    console.log(`
+----------------------------------------------------------+
|                     Quick Reference                       |
+----------------------------------------------------------+

Quick Commands (no LLM):
  list, ls          List user skills
  list all, ls -a   List all skills (including built-in)
  reload            Refresh skills from disk
  history, hist     Show recent command history
  help              Show this help
  exit, quit, q     Exit the CLI
  Esc               Cancel running operation

Slash Commands (direct skill execution):
  /help             Show all slash commands
  /ls               List skills
  /read <skill>     Read skill definition
  /write <skill>    Create/update skill
  /validate <skill> Validate against schema
  /generate <skill> Generate code from tskill
  /test <skill>     Test generated code
  /refine <skill>   Iteratively improve skill
  /exec <skill>     Execute any skill directly

Natural Language Examples:
  "list all skills"
  "read the equipment skill"
  "create a new tskill called inventory"
  "validate the area skill"
  "generate code for equipment"

Skill Types:
  tskill - Database table (fields, validators, etc.)
  cskill - Code skill (LLM generates code)
  iskill - Interactive (commands, user input)
  oskill - Orchestrator (routes to other skills)
  mskill - MCP tool integration
`);
}
```

### History Display
```javascript
export function showHistory(historyManager, count = 20) {
    const recent = historyManager.getRecent(count);

    if (recent.length === 0) {
        console.log('\nNo command history yet.\n');
        return;
    }

    console.log(`\nCommand history (last ${recent.length} of ${historyManager.length}):`);
    recent.forEach(({ index, command }) => {
        console.log(`  ${index.toString().padStart(4)}  ${command}`);
    });
    console.log(`\nHistory stored at: ${historyManager.getHistoryPath()}\n`);
}
```

### History Search
```javascript
export function searchHistory(historyManager, query, limit = 20) {
    const results = historyManager.search(query, limit);

    if (results.length === 0) {
        console.log(`\nNo history entries matching "${query}".\n`);
        return;
    }

    console.log(`\nHistory entries matching "${query}":`);
    results.forEach(({ index, command }) => {
        console.log(`  ${index.toString().padStart(4)}  ${command}`);
    });
    console.log('');
}
```

## Why This Design

### 1. Direct Console Output
**Decision**: Functions print directly to console rather than returning strings.

**Rationale**:
- Help is always displayed (not transformed)
- Simpler API (no need to console.log the result)
- Immediate feedback
- Consistent with CLI expectations

### 2. Hardcoded Help Text
**Decision**: Help text is a template literal rather than dynamically generated.

**Rationale**:
- Easy to edit and format
- No synchronization with COMMANDS needed
- Layout can be hand-tuned
- Fast (no computation)

### 3. Index Padding
**Decision**: Right-align history indices with `padStart(4)`.

**Rationale**:
- Clean visual alignment
- Works up to 9999 entries
- Consistent column layout
- Easier to read

### 4. History File Path Display
**Decision**: Show path to history file after listing.

**Rationale**:
- Users know where history is stored
- Can manually edit if needed
- Debugging aid
- Transparency

### 5. Empty State Handling
**Decision**: Explicit messages for empty history and no search results.

**Rationale**:
- Clear feedback (not silent)
- User knows the command worked
- Suggests next action implicitly
- Better UX than empty output

## Public API

### Functions
```javascript
printHelp()                               // Show quick reference
showHistory(historyManager, count = 20)   // Show recent commands
searchHistory(historyManager, query, limit = 20)  // Search history
```

### Default Export
```javascript
export default {
    printHelp,
    showHistory,
    searchHistory,
};
```

## Output Format

### Help Screen Structure
```
+----------------------------------------------------------+
|                     Quick Reference                       |
+----------------------------------------------------------+

Quick Commands (no LLM):
  [command]         [description]
  ...

Slash Commands (direct skill execution):
  /[command]        [description]
  ...

Natural Language Examples:
  "[example]"
  ...

Skill Types:
  [type] - [description]
  ...
```

### History Output Format
```
Command history (last N of TOTAL):
     1  first command
     2  second command
    ...
   123  most recent command

History stored at: /path/to/.skill-manager-history
```

## Pseudocode

```javascript
function printHelp() {
    console.log(HELP_TEXT);
}

function showHistory(historyManager, count) {
    recent = historyManager.getRecent(count);

    if (recent.empty) {
        console.log('No command history yet.');
        return;
    }

    console.log(`Command history (last ${recent.length} of ${historyManager.length}):`);
    for ({ index, command } of recent) {
        console.log(`  ${padIndex(index)}  ${command}`);
    }
    console.log(`History stored at: ${historyManager.getHistoryPath()}`);
}

function searchHistory(historyManager, query, limit) {
    results = historyManager.search(query, limit);

    if (results.empty) {
        console.log(`No history entries matching "${query}".`);
        return;
    }

    console.log(`History entries matching "${query}":`);
    for ({ index, command } of results) {
        console.log(`  ${padIndex(index)}  ${command}`);
    }
}
```

## Notes/Constraints

- Help text is ASCII art compatible (uses standard chars)
- No ANSI colors in help (works in any terminal)
- History indices are 1-based for user display
- Search results ordered newest-first (from HistoryManager)
- No pagination for long history lists
- Output goes to stdout (not stderr)
