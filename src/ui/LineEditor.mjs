/**
 * LineEditor - Handles line editing with cursor navigation.
 *
 * Provides Unix-like terminal navigation including:
 * - Left/Right arrow cursor movement
 * - Ctrl+Left/Right or Alt+Left/Right word navigation
 * - Ctrl+Backspace or Alt+Backspace word deletion backward
 * - Ctrl+Delete or Alt+Delete word deletion forward
 * - Ctrl+A/E and Home/End for line start/end
 * - Ctrl+U to clear line
 * - Ctrl+K to kill to end of line
 */

// ANSI escape codes for terminal control
const ANSI = {
    MOVE_TO_COL: (n) => `\x1b[${n}G`,
    CLEAR_TO_END: '\x1b[K',
};

// Key code constants - some keys have multiple codes depending on terminal
const KEYS = {
    // Arrow keys
    LEFT: '\x1b[D',
    RIGHT: '\x1b[C',

    // Ctrl/Alt+Arrow for word navigation
    WORD_LEFT: ['\x1b[1;5D', '\x1b[5D', '\x1b[1;3D', '\x1bb'],  // Ctrl+Left and Alt+Left
    WORD_RIGHT: ['\x1b[1;5C', '\x1b[5C', '\x1b[1;3C', '\x1bf'],  // Ctrl+Right and Alt+Right

    // Word deletion (Ctrl/Alt+Backspace and Ctrl/Alt+Delete)
    WORD_BACKSPACE: ['\x08', '\x1b\x7f', '\x17', '\x1f'],  // Ctrl+BS, Alt+BS (ESC+DEL), Ctrl+W, Ctrl+_
    WORD_DELETE: ['\x1b[3;5~', '\x1b[3;3~', '\x1bd'],  // Ctrl+Del and Alt+Del

    // Line operations
    CTRL_U: '\x15',
    CTRL_K: '\x0b',

    // Line navigation
    CTRL_A: '\x01',
    CTRL_E: '\x05',
    HOME: ['\x1b[H', '\x1b[1~', '\x1bOH'],
    END: ['\x1b[F', '\x1b[4~', '\x1bOF'],

    // Delete key
    DELETE: '\x1b[3~',

    // Standard keys
    BACKSPACE: '\x7f',  // DEL key (0x7f) - regular backspace
};

/**
 * LineEditor class for managing line input with cursor positioning.
 */
export class LineEditor {
    /**
     * @param {Object} options
     * @param {string} [options.prompt=''] - The prompt string displayed before input
     * @param {NodeJS.WriteStream} [options.stream=process.stdout] - Output stream
     */
    constructor(options = {}) {
        this.buffer = '';
        this.cursorPos = 0;
        this.prompt = options.prompt || '';
        this.stream = options.stream || process.stdout;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // State accessors
    // ─────────────────────────────────────────────────────────────────────────

    /** Get the current buffer content */
    getBuffer() {
        return this.buffer;
    }

    /** Get the current cursor position */
    getCursorPos() {
        return this.cursorPos;
    }

    /** Set buffer content and move cursor to end */
    setBuffer(content) {
        this.buffer = content;
        this.cursorPos = content.length;
    }

    /** Clear buffer and reset cursor */
    clear() {
        this.buffer = '';
        this.cursorPos = 0;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Character operations
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Insert character(s) at cursor position
     * @param {string} chars - Characters to insert
     */
    insert(chars) {
        this.buffer =
            this.buffer.slice(0, this.cursorPos) +
            chars +
            this.buffer.slice(this.cursorPos);
        this.cursorPos += chars.length;
    }

    /**
     * Delete character before cursor (backspace)
     * @returns {boolean} True if a character was deleted
     */
    deleteBack() {
        if (this.cursorPos > 0) {
            this.buffer =
                this.buffer.slice(0, this.cursorPos - 1) +
                this.buffer.slice(this.cursorPos);
            this.cursorPos--;
            return true;
        }
        return false;
    }

    /**
     * Delete character at cursor (delete key)
     * @returns {boolean} True if a character was deleted
     */
    deleteForward() {
        if (this.cursorPos < this.buffer.length) {
            this.buffer =
                this.buffer.slice(0, this.cursorPos) +
                this.buffer.slice(this.cursorPos + 1);
            return true;
        }
        return false;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Cursor movement
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Move cursor left one position
     * @returns {boolean} True if cursor moved
     */
    moveLeft() {
        if (this.cursorPos > 0) {
            this.cursorPos--;
            return true;
        }
        return false;
    }

    /**
     * Move cursor right one position
     * @returns {boolean} True if cursor moved
     */
    moveRight() {
        if (this.cursorPos < this.buffer.length) {
            this.cursorPos++;
            return true;
        }
        return false;
    }

    /** Move cursor to start of line */
    moveToStart() {
        this.cursorPos = 0;
    }

    /** Move cursor to end of line */
    moveToEnd() {
        this.cursorPos = this.buffer.length;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Word navigation
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Find the position of the previous word boundary
     * @returns {number} Position of previous word start
     */
    findPrevWordBoundary() {
        let pos = this.cursorPos;
        // Skip whitespace first (moving backward)
        while (pos > 0 && /\s/.test(this.buffer[pos - 1])) {
            pos--;
        }
        // Then skip non-whitespace (the word itself)
        while (pos > 0 && !/\s/.test(this.buffer[pos - 1])) {
            pos--;
        }
        return pos;
    }

    /**
     * Find the position of the next word boundary
     * @returns {number} Position after next word end
     */
    findNextWordBoundary() {
        let pos = this.cursorPos;
        // Skip non-whitespace first (current word)
        while (pos < this.buffer.length && !/\s/.test(this.buffer[pos])) {
            pos++;
        }
        // Then skip whitespace
        while (pos < this.buffer.length && /\s/.test(this.buffer[pos])) {
            pos++;
        }
        return pos;
    }

    /** Move cursor to previous word boundary */
    moveToPrevWord() {
        this.cursorPos = this.findPrevWordBoundary();
    }

    /** Move cursor to next word boundary */
    moveToNextWord() {
        this.cursorPos = this.findNextWordBoundary();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Word/line deletion
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Delete word backward (Ctrl+Backspace)
     * @returns {boolean} True if text was deleted
     */
    deleteWordBack() {
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

    /**
     * Delete word forward (Ctrl+Delete)
     * @returns {boolean} True if text was deleted
     */
    deleteWordForward() {
        const newPos = this.findNextWordBoundary();
        if (newPos > this.cursorPos) {
            this.buffer =
                this.buffer.slice(0, this.cursorPos) +
                this.buffer.slice(newPos);
            return true;
        }
        return false;
    }

    /**
     * Clear entire line (Ctrl+U)
     */
    clearLine() {
        this.buffer = '';
        this.cursorPos = 0;
    }

    /**
     * Kill to end of line (Ctrl+K)
     * @returns {boolean} True if text was deleted
     */
    killToEnd() {
        if (this.cursorPos < this.buffer.length) {
            this.buffer = this.buffer.slice(0, this.cursorPos);
            return true;
        }
        return false;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Rendering
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Render the line with proper cursor positioning
     */
    render() {
        // Move to start of line, clear to end, write prompt + buffer
        this.stream.write('\r' + ANSI.CLEAR_TO_END);
        this.stream.write(this.prompt + this.buffer);

        // Position cursor correctly (1-indexed column)
        const cursorColumn = this.prompt.length + this.cursorPos + 1;
        this.stream.write(ANSI.MOVE_TO_COL(cursorColumn));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Key processing
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Helper to check if a key matches any pattern in an array or single value
     * @param {string} key - The key code to check
     * @param {string|string[]} patterns - Pattern(s) to match against
     * @returns {boolean}
     */
    static matches(key, patterns) {
        if (Array.isArray(patterns)) {
            return patterns.includes(key);
        }
        return key === patterns;
    }

    /**
     * Process a key and perform the appropriate action
     * @param {string} keyStr - The key code string
     * @returns {'modified'|'cursor'|'none'|'unhandled'} Action type
     *   - 'modified': Buffer content changed
     *   - 'cursor': Only cursor position changed
     *   - 'none': Key recognized but no change (e.g., backspace at start)
     *   - 'unhandled': Key not recognized by LineEditor
     */
    processKey(keyStr) {
        const { matches } = LineEditor;

        // Left arrow
        if (keyStr === KEYS.LEFT) {
            return this.moveLeft() ? 'cursor' : 'none';
        }

        // Right arrow
        if (keyStr === KEYS.RIGHT) {
            return this.moveRight() ? 'cursor' : 'none';
        }

        // Ctrl/Alt+Left (word left)
        if (matches(keyStr, KEYS.WORD_LEFT)) {
            this.moveToPrevWord();
            return 'cursor';
        }

        // Ctrl/Alt+Right (word right)
        if (matches(keyStr, KEYS.WORD_RIGHT)) {
            this.moveToNextWord();
            return 'cursor';
        }

        // Ctrl+A or Home
        if (keyStr === KEYS.CTRL_A || matches(keyStr, KEYS.HOME)) {
            this.moveToStart();
            return 'cursor';
        }

        // Ctrl+E or End
        if (keyStr === KEYS.CTRL_E || matches(keyStr, KEYS.END)) {
            this.moveToEnd();
            return 'cursor';
        }

        // Ctrl+U (clear line)
        if (keyStr === KEYS.CTRL_U) {
            this.clearLine();
            return 'modified';
        }

        // Ctrl+K (kill to end)
        if (keyStr === KEYS.CTRL_K) {
            return this.killToEnd() ? 'modified' : 'none';
        }

        // Ctrl/Alt+Backspace (delete word back) - check BEFORE regular backspace
        if (matches(keyStr, KEYS.WORD_BACKSPACE)) {
            return this.deleteWordBack() ? 'modified' : 'none';
        }

        // Ctrl/Alt+Delete (delete word forward) - check BEFORE regular delete
        if (matches(keyStr, KEYS.WORD_DELETE)) {
            return this.deleteWordForward() ? 'modified' : 'none';
        }

        // Backspace (single character delete)
        if (keyStr === KEYS.BACKSPACE) {
            return this.deleteBack() ? 'modified' : 'none';
        }

        // Delete key (single character delete)
        if (keyStr === KEYS.DELETE) {
            return this.deleteForward() ? 'modified' : 'none';
        }

        // Regular printable character
        if (keyStr.length === 1 && keyStr >= ' ' && keyStr <= '~') {
            this.insert(keyStr);
            return 'modified';
        }

        return 'unhandled';
    }
}

// Export key constants for reference/testing
export const KEYS_REFERENCE = KEYS;
export default LineEditor;
