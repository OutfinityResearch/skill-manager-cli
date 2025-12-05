# Design Spec: src/repl/InteractivePrompt.mjs

ID: DS(/repl/InteractivePrompt.mjs)

## Overview

**Role**: Handles interactive input capture with command/skill selector integration, history navigation, and raw terminal mode for immediate key detection.

**Pattern**: Input handler with mode switching (raw mode ↔ readline mode) for different interaction types.

**Key Collaborators**:
- `LineEditor` - buffer management and cursor navigation
- `CommandSelector` via `showCommandSelector`, `showSkillSelector` - interactive pickers
- `SlashCommandHandler` - command validation and completion
- `HistoryManager` - command history navigation

## What It Does

InteractivePrompt provides:

1. **Raw Input Capture**: Detects "/" keypress immediately to trigger command picker
2. **History Navigation**: Arrow key handling for command history (↑/↓)
3. **Command Picker**: Interactive selector when "/" is typed alone
4. **Skill Picker**: Automatic skill selection for commands that need a skill argument
5. **Fallback Mode**: Standard readline for non-TTY environments

## How It Does It

### Raw Mode Input Loop
```javascript
async _promptWithSelector() {
    return new Promise((resolve) => {
        const editor = new LineEditor({ prompt: self.promptString });
        let historyIndex = -1;  // -1 = new input
        let savedBuffer = '';

        process.stdin.setRawMode(true);
        process.stdin.resume();

        const handleKey = async (key) => {
            const keyStr = key.toString();

            // "/" with empty buffer triggers command picker
            if (keyStr === '/' && editor.getBuffer() === '') {
                const selected = await showCommandSelector(commandList, {
                    prompt: `${promptString}/`,
                });
                if (selected) {
                    // Handle selected command...
                }
                return;
            }

            // Arrow keys for history
            if (keyStr === '\x1b[A') {  // Up arrow
                // Navigate to previous command
            }
            if (keyStr === '\x1b[B') {  // Down arrow
                // Navigate to next command
            }

            // Tab or Space after command triggers skill picker
            if ((keyStr === '\t' || keyStr === ' ') && commandNeedsSkillArg()) {
                await showSkillSelectorForCommand();
                return;
            }

            // Delegate to LineEditor
            editor.processKey(keyStr);
            editor.render();
        };

        process.stdin.on('data', handleKey);
    });
}
```

### History Navigation
```javascript
// Up arrow - go to previous (older) command
if (keyStr === '\x1b[A') {
    if (historyIndex === -1) {
        savedBuffer = editor.getBuffer();  // Save current input
    }
    if (historyIndex < history.length - 1) {
        historyIndex++;
        // History is oldest-first, read from end
        const historyEntry = history[history.length - 1 - historyIndex];
        editor.setBuffer(historyEntry);
        editor.render();
    }
    return;
}

// Down arrow - go to next (newer) command
if (keyStr === '\x1b[B') {
    if (historyIndex === -1) return;  // Already at newest
    historyIndex--;
    if (historyIndex === -1) {
        editor.setBuffer(savedBuffer);  // Restore saved input
    } else {
        const historyEntry = history[history.length - 1 - historyIndex];
        editor.setBuffer(historyEntry);
    }
    editor.render();
    return;
}
```

### Skill Input Flow (for /exec, /refine, /update)
```javascript
async _handleSkillInputFlow(commandName, selectedSkill, userSkills, resolve, cleanup) {
    // Show skill information
    console.log(`Skill: ${selectedSkill.name} [${skillType}]`);
    if (hint) console.log(`About: ${hint}`);

    // Show command-specific guidance
    if (commandName === '/exec') {
        console.log('Input: Type your request in natural language');
    } else if (commandName === '/refine') {
        console.log('Input: Describe what to improve');
    }

    // Prompt for additional input using readline
    const rl = readline.createInterface({...});
    rl.question(`${commandName} ${selectedSkill.name} `, (input) => {
        rl.close();
        cleanup();
        resolve(`${commandName} ${selectedSkill.name} ${input}`.trim());
    });
}
```

## Why This Design

### 1. Raw Mode for "/" Detection
**Decision**: Use raw terminal mode to detect "/" immediately.

**Rationale**:
- Standard readline buffers input until Enter
- "/" picker needs to activate before Enter is pressed
- Raw mode gives character-by-character control
- Enables ESC for cancellation at any time

### 2. Mode Switching for Pickers
**Decision**: Temporarily disable raw mode when showing pickers.

**Rationale**:
- Pickers need to manage their own input
- Avoids conflicting key handlers
- Clean state transitions
- Re-enable raw mode after picker completes

### 3. Index-Based History Navigation
**Decision**: Use `historyIndex` (-1 = new input, 0+ = history position).

**Rationale**:
- -1 indicates "not navigating history"
- Saves current input when starting navigation
- Restores saved input when returning to new
- Simple increment/decrement logic

### 4. Skill Picker Chaining
**Decision**: Automatically show skill picker for commands that need a skill argument.

**Rationale**:
- Commands like `/read` always need a skill name
- Auto-popup saves typing
- Tab and Space both trigger (ergonomic)
- Reduces error rate (no invalid skill names)

### 5. Contextual Input Guidance
**Decision**: Show skill info and input hints before prompting for additional input.

**Rationale**:
- User knows what they're about to execute
- Different commands have different input expectations
- Skill type affects expected input format
- Helps discoverability

## Public API

### Constructor
```javascript
new InteractivePrompt({
    historyManager,    // HistoryManager instance
    slashHandler,      // SlashCommandHandler for validation
    commandList,       // Array for command picker
    getUserSkills,     // Callback: () => skills[]
    prompt,            // Prompt string (default: 'SkillManager> ')
})
```

### Methods
```javascript
async prompt()  // Get input from user (returns string)
```

## Pseudocode

```javascript
class InteractivePrompt {
    async prompt() {
        if (!process.stdin.isTTY) {
            return this._promptOnce();  // Fallback
        }
        return this._promptWithSelector();
    }

    async _promptWithSelector() {
        return new Promise((resolve) => {
            editor = new LineEditor({ prompt });
            historyIndex = -1;
            savedBuffer = '';

            process.stdin.setRawMode(true);

            handleKey = async (key) => {
                // "/" alone → command picker
                if (key === '/' && editor.empty()) {
                    selected = await showCommandSelector();
                    if (selected.needsSkillArg) {
                        skill = await showSkillSelector();
                        // Handle commands needing more input
                    }
                    resolve(buildCommand(selected, skill));
                    return;
                }

                // History navigation
                if (key === UP_ARROW) navigateHistoryUp();
                if (key === DOWN_ARROW) navigateHistoryDown();

                // Tab/Space after command → skill picker
                if ((key === TAB || key === SPACE) && commandNeedsSkillArg()) {
                    await showSkillSelectorForCommand();
                    return;
                }

                // Delegate to LineEditor
                editor.processKey(key);
                editor.render();
            };

            stdin.on('data', handleKey);
            editor.render();
        });
    }

    async _promptOnce() {
        // Fallback: standard readline with tab completion
        rl = readline.createInterface({...});
        return new Promise((resolve) => {
            rl.question(prompt, resolve);
        });
    }
}
```

## State Management

```
┌─────────────────────────────────────────────────────────────────┐
│                    INPUT STATE MACHINE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   IDLE                                                          │
│     │                                                           │
│     ├── "/" (empty buffer) ──► COMMAND_PICKER                   │
│     │                              │                            │
│     │                              ├── select ──► SKILL_PICKER? │
│     │                              │                  │         │
│     │                              │                  └──► INPUT│
│     │                              │                       │    │
│     │                              └── cancel ─────────────┘    │
│     │                                                      │    │
│     ├── ↑ arrow ──► HISTORY_NAV (historyIndex++)           │    │
│     │                    │                                 │    │
│     │                    └── ↓ arrow (back to IDLE if -1)  │    │
│     │                                                      │    │
│     ├── typing ──► LineEditor handles                      │    │
│     │                                                      │    │
│     └── Enter ──► RESOLVE ◄────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Notes/Constraints

- Raw mode requires explicit cleanup (`setRawMode(false)`)
- Ctrl+C in raw mode must be handled manually
- TTY detection for fallback mode
- History is read as a snapshot at prompt start
- savedBuffer preserves user's partial input during navigation
- Commands with `needsSkillArg: true` trigger skill picker
