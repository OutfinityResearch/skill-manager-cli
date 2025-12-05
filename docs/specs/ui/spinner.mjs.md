# Design Spec: src/ui/spinner.mjs

ID: DS(/ui/spinner.mjs)

## Overview

**Role**: Provides animated loading indicators for long-running operations with elapsed time display, interrupt hints, and multiple visual styles.

**Pattern**: Stateful UI component with interval-based animation and pause/resume capability.

**Key Collaborators**:
- `ActionReporter` (via spinnerFactory injection) - progress feedback
- `NaturalLanguageProcessor` - during LLM calls
- `QuickCommands` - for reload operation

## What It Does

The spinner module provides:

1. **Spinner Class**: Animated progress indicator with multiple styles
2. **StatusLine Class**: Non-animated status updates that overwrite in place
3. **createSpinner Factory**: Convenience function for quick spinner creation

## How It Does It

### Animation Loop
```javascript
class Spinner {
    constructor(options = {}) {
        this.frames = SPINNER_FRAMES[options.style] || SPINNER_FRAMES.dots;
        this.interval = options.interval || 80;
        this.color = COLORS[options.color] || COLORS.cyan;
        this.stream = options.stream || process.stderr;
        this.showInterruptHint = options.showInterruptHint || false;

        this.frameIndex = 0;
        this.timer = null;
        this.isSpinning = false;
        this.isPaused = false;
        this.startTime = null;
    }

    start(message = 'Processing') {
        if (this.isSpinning) return this;

        this.isSpinning = true;
        this.message = message;
        this.startTime = Date.now();

        // Hide cursor during animation
        this.stream.write('\x1b[?25l');

        this.timer = setInterval(() => {
            this.render();
            this.frameIndex = (this.frameIndex + 1) % this.frames.length;
        }, this.interval);

        return this;
    }

    render() {
        const frame = this.frames[this.frameIndex];
        const elapsed = this.getElapsed();
        const line = `${this.color}${frame}${RESET} ${this.message} ${DIM}${elapsed}${RESET}`;

        if (this.showInterruptHint) {
            const hint = `${DIM}   Esc to interrupt${RESET}`;
            this.stream.write(`\r\x1b[K${line}\n\x1b[K${hint}\x1b[A\r`);
        } else {
            this.stream.write(`\r\x1b[K${line}`);
        }
    }
}
```

### Elapsed Time Formatting
```javascript
getElapsed() {
    if (!this.startTime) return '';
    const ms = Date.now() - this.startTime;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) {
        return `(${seconds}s)`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `(${minutes}m ${remainingSeconds}s)`;
}
```

### Pause/Resume for User Input
```javascript
pause() {
    if (!this.isSpinning || this.isPaused) return this;

    clearInterval(this.timer);
    this.timer = null;

    // Clear line(s) and show cursor
    if (this.showInterruptHint) {
        this.stream.write('\r\x1b[K\n\x1b[K\x1b[A\r');
    } else {
        this.stream.write('\r\x1b[K');
    }
    this.stream.write('\x1b[?25h');  // Show cursor

    this.isPaused = true;
    return this;
}

resume() {
    if (!this.isPaused || !this.isSpinning) return this;

    this.isPaused = false;
    this.stream.write('\x1b[?25l');  // Hide cursor

    this.timer = setInterval(() => {
        this.render();
        this.frameIndex = (this.frameIndex + 1) % this.frames.length;
    }, this.interval);

    return this;
}
```

### Termination Methods
```javascript
succeed(message) {
    return this.stop(`${GREEN}✓${RESET} ${message || this.message}`);
}

fail(message) {
    return this.stop(`${YELLOW}✗${RESET} ${message || this.message}`);
}

info(message) {
    return this.stop(`${BLUE}ℹ${RESET} ${message || this.message}`);
}

stop(finalMessage) {
    if (!this.isSpinning) return this;

    clearInterval(this.timer);
    this.timer = null;
    this.isSpinning = false;

    // Clear spinner line(s)
    if (this.showInterruptHint) {
        this.stream.write('\r\x1b[K\n\x1b[K\x1b[A\r');
    } else {
        this.stream.write('\r\x1b[K');
    }

    // Show cursor
    this.stream.write('\x1b[?25h');

    // Write final message
    if (finalMessage) {
        const elapsed = this.getElapsed();
        this.stream.write(`${finalMessage} ${DIM}${elapsed}${RESET}\n`);
    }

    return this;
}
```

### StatusLine (Non-Animated)
```javascript
class StatusLine {
    constructor(stream = process.stderr) {
        this.stream = stream;
        this.active = false;
    }

    update(message) {
        if (!this.active) {
            this.active = true;
            this.stream.write('\x1b[?25l');  // Hide cursor
        }
        this.stream.write(`\r\x1b[K${message}`);
        return this;
    }

    clear() {
        if (this.active) {
            this.stream.write('\r\x1b[K');
            this.stream.write('\x1b[?25h');  // Show cursor
            this.active = false;
        }
        return this;
    }

    done(message) {
        this.stream.write(`\r\x1b[K${message}\n`);
        this.stream.write('\x1b[?25h');
        this.active = false;
        return this;
    }
}
```

## Why This Design

### 1. Write to stderr
**Decision**: Spinner output goes to stderr by default.

**Rationale**:
- Keeps stdout clean for actual results
- Enables proper piping (`command | grep`)
- Progress is "metadata" not output
- Common convention for CLI tools

### 2. Cursor Hiding
**Decision**: Hide cursor during animation.

**Rationale**:
- Prevents visual noise from blinking cursor
- Cleaner appearance during animation
- Standard practice for spinners
- Restored on stop (always in finally)

### 3. Method Chaining
**Decision**: All methods return `this` for chaining.

**Rationale**:
- Fluent API: `spinner.start().update('msg')`
- Convenient for inline usage
- No need to store intermediate values
- Common JavaScript pattern

### 4. Pause/Resume for Prompts
**Decision**: Support pausing animation during user input.

**Rationale**:
- Interactive skills may need user input
- Spinner shouldn't interfere with typing
- Clean transition (hide spinner, show cursor)
- Resume continues from where it left off

### 5. Multiple Frame Styles
**Decision**: Include several animation styles (dots, line, arc, etc.).

**Rationale**:
- User preference varies
- Different styles for different contexts
- Easy to add more styles
- Default (dots) works well universally

## Public API

### Spinner Class
```javascript
new Spinner({
    style,              // 'dots' | 'line' | 'arc' | 'circle' | 'square' | etc.
    interval,           // Animation interval in ms (default: 80)
    color,              // 'cyan' | 'yellow' | 'green' | etc.
    stream,             // Output stream (default: stderr)
    showInterruptHint,  // Show "Esc to interrupt" (default: false)
})

start(message)      // Start animation with message
update(message)     // Update message during animation
pause()             // Pause animation (for user input)
resume()            // Resume paused animation
stop(finalMessage)  // Stop and optionally show final message
succeed(message)    // Stop with green checkmark
fail(message)       // Stop with yellow X
info(message)       // Stop with blue info icon
```

### StatusLine Class
```javascript
new StatusLine(stream)

update(message)  // Update status (no animation)
clear()          // Clear status line
done(message)    // Show final message and clear
```

### Factory
```javascript
createSpinner(message, options)  // Create and start spinner
```

## Frame Styles

```javascript
const SPINNER_FRAMES = {
    dots: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
    line: ['|', '/', '-', '\\'],
    arc: ['◜', '◠', '◝', '◞', '◡', '◟'],
    circle: ['◐', '◓', '◑', '◒'],
    square: ['◰', '◳', '◲', '◱'],
    bounce: ['⠁', '⠂', '⠄', '⠂'],
    pulse: ['█', '▓', '▒', '░', '▒', '▓'],
    arrows: ['←', '↖', '↑', '↗', '→', '↘', '↓', '↙'],
    clock: ['🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚', '🕛'],
};
```

## Pseudocode

```javascript
class Spinner {
    start(message) {
        if (isSpinning) return this;

        isSpinning = true;
        startTime = now();
        hideCursor();

        timer = setInterval(() => {
            render();
            frameIndex = (frameIndex + 1) % frames.length;
        }, interval);

        return this;
    }

    render() {
        frame = frames[frameIndex];
        elapsed = formatElapsed(now() - startTime);
        line = `${frame} ${message} (${elapsed})`;

        if (showInterruptHint) {
            writeTwoLines(line, 'Esc to interrupt');
        } else {
            writeOneLine(line);
        }
    }

    pause() {
        clearInterval(timer);
        clearLine();
        showCursor();
        isPaused = true;
    }

    resume() {
        if (!isPaused) return;
        hideCursor();
        startInterval();
        isPaused = false;
    }

    stop(finalMessage) {
        clearInterval(timer);
        clearLine();
        showCursor();
        if (finalMessage) writeLine(finalMessage);
        isSpinning = false;
    }
}
```

## Notes/Constraints

- Timer must be cleared on stop (memory leak prevention)
- Cursor must be shown on stop (user experience)
- Interrupt hint requires extra line handling
- startTime tracks elapsed since start, not since pause
- pause/resume doesn't reset elapsed time
- Multiple lines require careful cursor management
- stderr is unbuffered (immediate display)
