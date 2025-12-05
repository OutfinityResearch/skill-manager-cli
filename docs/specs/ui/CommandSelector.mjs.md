# Design Spec: src/ui/CommandSelector.mjs

ID: DS(/ui/CommandSelector.mjs)

## Overview

**Role**: Provides interactive picker components for commands, skills, and tests with arrow key navigation, filtering, and scroll windowing.

**Pattern**: Stateful UI component with raw terminal mode handling. Exports both a class (CommandSelector) and factory functions (showCommandSelector, showSkillSelector, showTestSelector).

**Key Collaborators**:
- `InteractivePrompt` - uses selectors for command/skill picking
- `REPLSession` - uses test selector for `/test` command
- `SlashCommandHandler` - provides command list via buildCommandList

## What It Does

This module provides:

1. **CommandSelector Class**: Core selection logic with filtering and scroll windowing
2. **showCommandSelector**: Interactive command picker that returns selected command
3. **showSkillSelector**: Interactive skill picker that returns selected skill
4. **showTestSelector**: Interactive test picker that returns selected test
5. **buildCommandList**: Transforms COMMANDS registry into picker format

## How It Does It

### CommandSelector Class
```javascript
class CommandSelector {
    constructor(commands, options = {}) {
        this.commands = commands;  // Array of {name, description, ...}
        this.maxVisible = options.maxVisible || 8;
        this.selectedIndex = 0;
        this.scrollOffset = 0;
        this.filter = '';
        this.filteredCommands = [...commands];
    }

    updateFilter(input) {
        this.filter = input.toLowerCase();
        this.filteredCommands = this.commands.filter(cmd =>
            cmd.name.toLowerCase().includes(this.filter) ||
            cmd.description.toLowerCase().includes(this.filter)
        );
        this.selectedIndex = 0;
        this.scrollOffset = 0;
    }

    moveUp() {
        if (this.selectedIndex > 0) {
            this.selectedIndex--;
            // Scroll if selection moves above visible window
            if (this.selectedIndex < this.scrollOffset) {
                this.scrollOffset = this.selectedIndex;
            }
        }
    }

    moveDown() {
        if (this.selectedIndex < this.filteredCommands.length - 1) {
            this.selectedIndex++;
            // Scroll if selection moves below visible window
            if (this.selectedIndex >= this.scrollOffset + this.maxVisible) {
                this.scrollOffset = this.selectedIndex - this.maxVisible + 1;
            }
        }
    }

    render() {
        const lines = [];
        const visible = this.filteredCommands.slice(
            this.scrollOffset,
            this.scrollOffset + this.maxVisible
        );

        // Scroll indicator (above)
        if (this.scrollOffset > 0) {
            lines.push(`${DIM}  ↑ ${this.scrollOffset} more above${RESET}`);
        }

        // Visible items
        visible.forEach((cmd, idx) => {
            const actualIdx = this.scrollOffset + idx;
            const isSelected = actualIdx === this.selectedIndex;
            const prefix = isSelected ? `${CYAN}❯${RESET}` : ' ';
            const name = isSelected ? `${CYAN}${cmd.name}${RESET}` : cmd.name;
            lines.push(`${prefix} ${name.padEnd(20)} ${DIM}${cmd.description}${RESET}`);
        });

        // Scroll indicator (below)
        const remaining = this.filteredCommands.length - this.scrollOffset - this.maxVisible;
        if (remaining > 0) {
            lines.push(`${DIM}  ↓ ${remaining} more below${RESET}`);
        }

        return lines;
    }
}
```

### showCommandSelector Function
```javascript
async function showCommandSelector(commands, options = {}) {
    const { prompt = 'SkillManager> /', initialFilter = '', maxVisible = 8 } = options;

    return new Promise((resolve) => {
        const selector = new CommandSelector(commands, { maxVisible });
        let currentInput = initialFilter;

        process.stdout.write(ANSI.HIDE_CURSOR);

        const handleKey = (key) => {
            const keyStr = key.toString();

            if (keyStr === '\x1b[A') {  // Up arrow
                selector.moveUp();
                render();
            }
            if (keyStr === '\x1b[B') {  // Down arrow
                selector.moveDown();
                render();
            }
            if (keyStr === '\r' || keyStr === '\n') {  // Enter
                cleanup();
                resolve(selector.getSelected());
            }
            if (keyStr === '\x1b' || keyStr === '\x03') {  // ESC or Ctrl+C
                cleanup();
                resolve(null);  // Cancelled
            }
            if (keyStr === '\x7f') {  // Backspace
                if (currentInput.length > 0) {
                    currentInput = currentInput.slice(0, -1);
                    selector.updateFilter(currentInput);
                    render();
                } else {
                    cleanup();
                    resolve(null);  // Backspace on empty cancels
                }
            }
            if (keyStr.length === 1 && keyStr >= ' ') {  // Printable
                currentInput += keyStr;
                selector.updateFilter(currentInput);
                render();
            }
        };

        process.stdin.setRawMode(true);
        process.stdin.on('data', handleKey);
        render();
    });
}
```

### Terminal Rendering
```javascript
const render = () => {
    clearDisplay();

    // Write prompt with filter
    process.stdout.write(`${prompt}${currentInput}`);

    // Write list below
    const lines = selector.render();
    lines.forEach(line => {
        process.stdout.write(`\n${ANSI.CLEAR_LINE}${line}`);
    });

    // Move cursor back to input line
    for (let i = 0; i < lines.length; i++) {
        process.stdout.write(ANSI.MOVE_UP);
    }
    // Position cursor at end of input
    process.stdout.write(ANSI.MOVE_TO_COL(prompt.length + currentInput.length + 1));
};
```

## Why This Design

### 1. Scroll Windowing
**Decision**: Show only `maxVisible` items with scroll indicators.

**Rationale**:
- Works with any list size
- Prevents terminal overflow
- Clear visual feedback of position
- Consistent UI regardless of skill count

### 2. Filter on Name and Description
**Decision**: Match filter against both name and description.

**Rationale**:
- More discoverable (search by purpose)
- Fuzzy matching behavior
- Natural language queries work
- `/read` found by typing "read" or "definition"

### 3. Separate Factory Functions
**Decision**: Provide showCommandSelector, showSkillSelector, showTestSelector.

**Rationale**:
- Different return types (command vs skill vs test info)
- Different prompts and contexts
- Shared core logic (CommandSelector)
- Clean API for specific use cases

### 4. Backspace-Empty Cancels
**Decision**: Backspace on empty input cancels the picker.

**Rationale**:
- Natural escape hatch
- Similar to shell behavior
- No stuck state
- ESC also available for cancel

### 5. Direct ANSI Codes
**Decision**: Use raw ANSI escape codes instead of a terminal library.

**Rationale**:
- Zero external dependencies
- Full control over rendering
- Simpler to understand/debug
- Small footprint

## Public API

### Classes
```javascript
class CommandSelector {
    constructor(commands, options = { maxVisible: 8 })
    updateFilter(input)
    moveUp()
    moveDown()
    getSelected()
    render()
    getRenderedLineCount()
}
```

### Functions
```javascript
showCommandSelector(commands, options)   // Returns Promise<{name, args, needsSkillArg}>
showSkillSelector(skills, options)       // Returns Promise<{name, type}>
showTestSelector(tests, options)         // Returns Promise<{skillName, testFile, ...}>
buildCommandList(slashCommands)          // Returns command array for picker
```

### Options
```javascript
{
    prompt: string,        // Prompt string before input
    initialFilter: string, // Pre-populated filter
    maxVisible: number,    // Max items to show (default: 8)
}
```

## ANSI Escape Codes Used

```javascript
const ANSI = {
    HIDE_CURSOR: '\x1b[?25l',
    SHOW_CURSOR: '\x1b[?25h',
    CLEAR_LINE: '\x1b[K',
    MOVE_UP: '\x1b[A',
    MOVE_DOWN: '\x1b[B',
    MOVE_TO_COL: (n) => `\x1b[${n}G`,
    DIM: '\x1b[2m',
    RESET: '\x1b[0m',
    CYAN: '\x1b[36m',
    // ...
};
```

## Pseudocode

```javascript
async function showCommandSelector(commands, options) {
    selector = new CommandSelector(commands);
    input = '';

    hideCursor();
    enableRawMode();

    return new Promise((resolve) => {
        onKeypress((key) => {
            if (key === UP) selector.moveUp();
            if (key === DOWN) selector.moveDown();
            if (key === ENTER) resolve(selector.getSelected());
            if (key === ESC) resolve(null);
            if (key === BACKSPACE) {
                if (input) input = input.slice(0, -1);
                else resolve(null);
            }
            if (isPrintable(key)) input += key;

            selector.updateFilter(input);
            render();
        });

        render();  // Initial render
    });
}

class CommandSelector {
    moveUp() {
        if (selectedIndex > 0) selectedIndex--;
        adjustScrollOffset();
    }

    moveDown() {
        if (selectedIndex < filtered.length - 1) selectedIndex++;
        adjustScrollOffset();
    }

    render() {
        lines = [];
        if (scrollOffset > 0) lines.push('↑ more above');

        for item in visible window:
            prefix = (index === selected) ? '❯' : ' ';
            lines.push(prefix + item.name + item.description);

        if (hasMore) lines.push('↓ more below');
        return lines;
    }
}
```

## Notes/Constraints

- Cursor hidden during picker (restored in cleanup)
- Raw mode required for arrow key detection
- Lines are cleared by counting rendered lines
- maxRenderedLines tracks peak for proper clearing
- Tab key acts same as Enter (confirms selection)
- Tests selector includes additional metadata (testFile, skillDir)
- buildCommandList deduplicates aliases (ls/list map to same skill)
