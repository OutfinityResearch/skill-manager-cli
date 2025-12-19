# LineEditor Module Specification

Handles single-line editing with cursor navigation and text manipulation.

## Overview

LineEditor provides Unix-like terminal line editing capabilities including cursor movement, word navigation, character and word deletion, clipboard operations, and flexible rendering modes (simple or boxed).

## Key Constants

KEYS object defines terminal key codes for:
- Arrow keys (LEFT, RIGHT)
- Word navigation (Ctrl/Alt+Left/Right)
- Word deletion (Ctrl/Alt+Backspace/Delete)
- Line operations (Ctrl+U clear, Ctrl+K kill to end)
- Line navigation (Ctrl+A/E, Home/End)
- Delete key
- Standard backspace
- Clipboard operations (Ctrl+Insert copy, Shift+Insert paste)
- Bracketed paste markers

## LineEditor Class

### Constructor

Creates a new LineEditor instance.

Accepts options object with optional fields:
- prompt: Prompt string displayed before input
- rightHint: Hint text displayed on right side
- boxed: Whether to draw box around input (default false)
- stream: Output stream (default process.stdout)
- theme: Theme object for colors and box characters

Initializes:
- Empty buffer
- Cursor position at 0
- Box drawn state to false

### State Accessors

#### getBuffer

Returns current buffer content as string.

#### getCursorPos

Returns current cursor position as number.

#### setBuffer

Sets buffer content and moves cursor to end.

Accepts:
- content: New buffer content

#### clear

Clears buffer and resets cursor to position 0.

### Character Operations

#### insert

Inserts characters at current cursor position.

Accepts:
- chars: Characters to insert

Processing:
1. Slice buffer at cursor
2. Insert chars between slices
3. Advance cursor by chars length

#### deleteBack

Deletes character before cursor (backspace).

Returns true if character was deleted, false if at start.

#### deleteForward

Deletes character at cursor position (delete key).

Returns true if character was deleted, false if at end.

### Cursor Movement

#### moveLeft

Moves cursor left one position.

Returns true if moved, false if at start.

#### moveRight

Moves cursor right one position.

Returns true if moved, false if at end.

#### moveToStart

Moves cursor to start of line (position 0).

#### moveToEnd

Moves cursor to end of line (buffer length).

### Word Navigation

#### findPrevWordBoundary

Finds position of previous word boundary.

Processing:
1. Skip whitespace moving backward
2. Skip non-whitespace (the word)

Returns position number.

#### findNextWordBoundary

Finds position after next word end.

Processing:
1. Skip non-whitespace (current word)
2. Skip whitespace

Returns position number.

#### moveToPrevWord

Moves cursor to previous word boundary.

#### moveToNextWord

Moves cursor to next word boundary.

### Word/Line Deletion

#### deleteWordBack

Deletes word backward (Ctrl+Backspace).

Processing:
1. Find previous word boundary
2. Delete text between boundary and cursor
3. Move cursor to boundary

Returns true if text was deleted.

#### deleteWordForward

Deletes word forward (Ctrl+Delete).

Processing:
1. Find next word boundary
2. Delete text between cursor and boundary

Returns true if text was deleted.

#### clearLine

Clears entire line (Ctrl+U).

Sets buffer to empty and cursor to 0.

#### killToEnd

Deletes from cursor to end of line (Ctrl+K).

Returns true if text was deleted.

### Clipboard Operations

#### enableBracketedPaste (static)

Enables terminal bracketed paste mode.

Sends escape sequence ESC[?2004h.

#### disableBracketedPaste (static)

Disables terminal bracketed paste mode.

Sends escape sequence ESC[?2004l.

#### copyToClipboard

Copies current buffer to system clipboard.

Returns false if buffer is empty.

#### pasteFromClipboard

Pastes from system clipboard at cursor.

Processing:
1. Get text from clipboard
2. Replace newlines with spaces
3. Insert at cursor position

Returns true if text was inserted.

#### handleBracketedPaste

Handles text received via bracketed paste.

Accepts:
- text: Pasted text without bracket markers

Processing:
1. Replace newlines with spaces
2. Insert at cursor position

Returns true if text was inserted.

### Rendering

#### render

Renders the line with proper cursor positioning.

Delegates to _renderSimple or _renderBoxed based on boxed flag.

#### _renderSimple

Renders without box decoration.

Processing:
1. Clear line
2. Write prompt and buffer
3. If rightHint set and fits, write at right edge
4. Position cursor within buffer

#### _renderBoxed

Renders with box around input.

Box layout:
```
┌────────────────────────────────────────┐
│ > buffer content              ↵ send   │
└────────────────────────────────────────┘
```

Processing:
1. Calculate widths for content area
2. Truncate buffer if too long (scroll to keep cursor visible)
3. On first render: draw all three lines
4. On subsequent renders: only redraw content line
5. Position cursor within content

#### drawBottomBorder

Finalizes box display by moving cursor below box.

Called when input is complete.

#### clearBox

Clears all three box lines from display.

Used when cancelling or switching modes.

### Key Processing

#### matches (static)

Checks if key matches patterns.

Accepts:
- key: Key code to check
- patterns: Single pattern or array of patterns

Returns true if key matches any pattern.

#### processKey

Processes a key and performs appropriate action.

Accepts:
- keyStr: Key code string

Handles:
- Arrow keys: cursor movement
- Ctrl/Alt+Arrow: word navigation
- Ctrl+A/E, Home/End: line start/end
- Ctrl+U: clear line
- Ctrl+K: kill to end
- Word delete keys: word deletion
- Backspace/Delete: single character deletion
- Copy/Paste keys: clipboard operations
- Printable characters: insertion

Returns action type:
- 'modified': Buffer content changed
- 'cursor': Only cursor position changed
- 'none': Key recognized but no change
- 'unhandled': Key not recognized

## Exports

Exports:
- LineEditor class (named and default)
- KEYS_REFERENCE constant for testing
