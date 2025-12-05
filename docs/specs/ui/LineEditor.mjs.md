# Design Spec: src/ui/LineEditor.mjs

ID: DS(/ui/LineEditor.mjs)

## Overview

**Role**: Handles line editing with cursor navigation and text manipulation. Provides Unix-like terminal editing capabilities (Emacs-style keybindings).

**Pattern**: Stateful text buffer with cursor position tracking and key-to-action mapping.

**Key Collaborators**:
- `InteractivePrompt` - uses LineEditor for input handling
- Terminal (stdout) - for rendering

## What It Does

LineEditor provides:

1. **Buffer Management**: String buffer with cursor position
2. **Cursor Navigation**: Left/right, word-wise, line start/end
3. **Text Editing**: Insert, delete, word delete, line operations
4. **Key Processing**: Maps key codes to editing actions
5. **Rendering**: Writes buffer with cursor positioning

## How It Does It

### State Management
```javascript
class LineEditor {
    constructor(options = {}) {
        this.buffer = '';        // Current text content
        this.cursorPos = 0;      // Cursor position (0 = before first char)
        this.prompt = options.prompt || '';
        this.stream = options.stream || process.stdout;
    }

    getBuffer() { return this.buffer; }
    getCursorPos() { return this.cursorPos; }

    setBuffer(content) {
        this.buffer = content;
        this.cursorPos = content.length;  // Move to end
    }

    clear() {
        this.buffer = '';
        this.cursorPos = 0;
    }
}
```

### Text Operations
```javascript
insert(chars) {
    this.buffer =
        this.buffer.slice(0, this.cursorPos) +
        chars +
        this.buffer.slice(this.cursorPos);
    this.cursorPos += chars.length;
}

deleteBack() {  // Backspace
    if (this.cursorPos > 0) {
        this.buffer =
            this.buffer.slice(0, this.cursorPos - 1) +
            this.buffer.slice(this.cursorPos);
        this.cursorPos--;
        return true;
    }
    return false;
}

deleteForward() {  // Delete key
    if (this.cursorPos < this.buffer.length) {
        this.buffer =
            this.buffer.slice(0, this.cursorPos) +
            this.buffer.slice(this.cursorPos + 1);
        return true;
    }
    return false;
}
```

### Word Navigation
```javascript
findPrevWordBoundary() {
    let pos = this.cursorPos;
    // Skip whitespace backward
    while (pos > 0 && /\s/.test(this.buffer[pos - 1])) {
        pos--;
    }
    // Skip word characters backward
    while (pos > 0 && !/\s/.test(this.buffer[pos - 1])) {
        pos--;
    }
    return pos;
}

findNextWordBoundary() {
    let pos = this.cursorPos;
    // Skip word characters forward
    while (pos < this.buffer.length && !/\s/.test(this.buffer[pos])) {
        pos++;
    }
    // Skip whitespace forward
    while (pos < this.buffer.length && /\s/.test(this.buffer[pos])) {
        pos++;
    }
    return pos;
}

deleteWordBack() {  // Ctrl+Backspace
    const newPos = this.findPrevWordBoundary();
    if (newPos < this.cursorPos) {
        this.buffer =
            this.buffer.slice(0, newPos) +
            this.buffer.slice(this.cursorPos);
        this.cursorPos = newPos;
        return true;
    }
    return false;
}
```

### Key Processing
```javascript
processKey(keyStr) {
    // Arrow keys
    if (keyStr === '\x1b[D') return this.moveLeft() ? 'cursor' : 'none';
    if (keyStr === '\x1b[C') return this.moveRight() ? 'cursor' : 'none';

    // Word navigation (Ctrl+Arrow, Alt+Arrow)
    if (KEYS.WORD_LEFT.includes(keyStr)) {
        this.moveToPrevWord();
        return 'cursor';
    }
    if (KEYS.WORD_RIGHT.includes(keyStr)) {
        this.moveToNextWord();
        return 'cursor';
    }

    // Line navigation
    if (keyStr === '\x01' || KEYS.HOME.includes(keyStr)) {  // Ctrl+A / Home
        this.moveToStart();
        return 'cursor';
    }
    if (keyStr === '\x05' || KEYS.END.includes(keyStr)) {  // Ctrl+E / End
        this.moveToEnd();
        return 'cursor';
    }

    // Line operations
    if (keyStr === '\x15') {  // Ctrl+U
        this.clearLine();
        return 'modified';
    }
    if (keyStr === '\x0b') {  // Ctrl+K
        return this.killToEnd() ? 'modified' : 'none';
    }

    // Word deletion (check before single char)
    if (KEYS.WORD_BACKSPACE.includes(keyStr)) {
        return this.deleteWordBack() ? 'modified' : 'none';
    }
    if (KEYS.WORD_DELETE.includes(keyStr)) {
        return this.deleteWordForward() ? 'modified' : 'none';
    }

    // Single character operations
    if (keyStr === '\x7f') {  // Backspace
        return this.deleteBack() ? 'modified' : 'none';
    }
    if (keyStr === '\x1b[3~') {  // Delete
        return this.deleteForward() ? 'modified' : 'none';
    }

    // Printable characters
    if (keyStr.length === 1 && keyStr >= ' ' && keyStr <= '~') {
        this.insert(keyStr);
        return 'modified';
    }

    return 'unhandled';
}
```

### Rendering
```javascript
render() {
    // Clear line and redraw
    this.stream.write('\r' + ANSI.CLEAR_TO_END);
    this.stream.write(this.prompt + this.buffer);

    // Position cursor (columns are 1-indexed)
    const cursorColumn = this.prompt.length + this.cursorPos + 1;
    this.stream.write(ANSI.MOVE_TO_COL(cursorColumn));
}
```

## Why This Design

### 1. Return Action Type
**Decision**: processKey returns action type ('modified', 'cursor', 'none', 'unhandled').

**Rationale**:
- Caller knows if re-render is needed
- Distinguishes content change from cursor movement
- Enables optimization (skip re-render on 'none')
- 'unhandled' allows delegation to other handlers

### 2. Multiple Key Codes per Action
**Decision**: Store arrays of key codes for word navigation/deletion.

**Rationale**:
- Terminals send different codes for same key
- Ctrl+Left might be `\x1b[1;5D` or `\x1b[5D` or `\x1bb`
- Alt+Backspace might be `\x1b\x7f` or `\x08`
- Single check handles all variants

### 3. Word Boundary Algorithm
**Decision**: Words are delimited by whitespace (skip space, then skip non-space).

**Rationale**:
- Simple and predictable
- Matches common shell behavior
- Works with any content
- No special punctuation handling needed

### 4. Emacs-Style Keybindings
**Decision**: Support Ctrl+A/E, Ctrl+U/K, etc.

**Rationale**:
- Standard terminal conventions
- Familiar to Unix users
- readline compatibility
- Muscle memory from other tools

### 5. Stateless Render
**Decision**: render() redraws entire line each time.

**Rationale**:
- Simple implementation
- No state tracking of previous output
- Always correct (no sync issues)
- Fast enough for line editing

## Public API

### Constructor
```javascript
new LineEditor({
    prompt,    // Prompt string (default: '')
    stream,    // Output stream (default: stdout)
})
```

### Methods
```javascript
// State
getBuffer()                    // Get current text
getCursorPos()                 // Get cursor position
setBuffer(content)             // Set text (cursor to end)
clear()                        // Clear buffer and cursor

// Character operations
insert(chars)                  // Insert at cursor
deleteBack()                   // Delete char before cursor
deleteForward()                // Delete char at cursor

// Cursor movement
moveLeft()                     // Move cursor left
moveRight()                    // Move cursor right
moveToStart()                  // Move to line start (Ctrl+A)
moveToEnd()                    // Move to line end (Ctrl+E)
moveToPrevWord()               // Move to previous word
moveToNextWord()               // Move to next word

// Word/line operations
deleteWordBack()               // Delete word backward (Ctrl+Backspace)
deleteWordForward()            // Delete word forward (Ctrl+Delete)
clearLine()                    // Clear entire line (Ctrl+U)
killToEnd()                    // Delete to end of line (Ctrl+K)

// Key handling
processKey(keyStr)             // Process key, return action type
render()                       // Render line with cursor
```

## Key Codes Reference

```javascript
const KEYS = {
    // Arrow keys
    LEFT: '\x1b[D',
    RIGHT: '\x1b[C',

    // Ctrl/Alt+Arrow for word navigation
    WORD_LEFT: ['\x1b[1;5D', '\x1b[5D', '\x1b[1;3D', '\x1bb'],
    WORD_RIGHT: ['\x1b[1;5C', '\x1b[5C', '\x1b[1;3C', '\x1bf'],

    // Word deletion
    WORD_BACKSPACE: ['\x08', '\x1b\x7f', '\x17', '\x1f'],  // Ctrl+BS, Alt+BS, Ctrl+W, Ctrl+_
    WORD_DELETE: ['\x1b[3;5~', '\x1b[3;3~', '\x1bd'],

    // Line operations
    CTRL_U: '\x15',
    CTRL_K: '\x0b',
    CTRL_A: '\x01',
    CTRL_E: '\x05',
    HOME: ['\x1b[H', '\x1b[1~', '\x1bOH'],
    END: ['\x1b[F', '\x1b[4~', '\x1bOF'],

    // Standard
    DELETE: '\x1b[3~',
    BACKSPACE: '\x7f',
};
```

## Pseudocode

```javascript
class LineEditor {
    processKey(key) {
        switch (key) {
            case LEFT: return moveLeft() ? 'cursor' : 'none';
            case RIGHT: return moveRight() ? 'cursor' : 'none';
            case WORD_LEFT: moveToPrevWord(); return 'cursor';
            case WORD_RIGHT: moveToNextWord(); return 'cursor';
            case CTRL_A: moveToStart(); return 'cursor';
            case CTRL_E: moveToEnd(); return 'cursor';
            case CTRL_U: clearLine(); return 'modified';
            case CTRL_K: return killToEnd() ? 'modified' : 'none';
            case BACKSPACE: return deleteBack() ? 'modified' : 'none';
            case DELETE: return deleteForward() ? 'modified' : 'none';
            default:
                if (isPrintable(key)) {
                    insert(key);
                    return 'modified';
                }
                return 'unhandled';
        }
    }

    render() {
        clearLine();
        write(prompt + buffer);
        moveCursor(prompt.length + cursorPos);
    }
}
```

## Notes/Constraints

- Buffer uses 0-based indexing
- Cursor position is "between characters" (0 = before first)
- render() must be called after processKey for changes to appear
- ANSI codes assume VT100-compatible terminal
- No multi-byte character support (assumes ASCII)
- KEYS_REFERENCE exported for testing
