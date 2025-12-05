# Design Spec: src/repl/NaturalLanguageProcessor.mjs

ID: DS(/repl/NaturalLanguageProcessor.mjs)

## Overview

**Role**: Handles LLM-based natural language processing with abort capability, progress feedback, and user prompting support.

**Pattern**: Async processor with AbortController for cancellation and ActionReporter for progress feedback.

**Key Collaborators**:
- `ActionReporter` (external - achilles-agent-lib) - progress feedback
- `RecursiveSkilledAgent` - skill execution
- `HistoryManager` - command history
- `MarkdownRenderer` - output formatting
- `Spinner` - progress animation

## What It Does

NaturalLanguageProcessor provides:

1. **LLM Invocation**: Routes natural language prompts through the skills-orchestrator
2. **Progress Feedback**: Shows animated spinner during LLM processing
3. **Cancellation**: ESC key aborts the current operation via AbortController
4. **User Prompting**: Pauses spinner for interactive skill prompts
5. **Result Formatting**: Renders markdown output when enabled

## How It Does It

### Main Process Flow
```javascript
async process(input) {
    // Create AbortController for ESC cancellation
    const abortController = new AbortController();
    let wasInterrupted = false;

    // Create ActionReporter for real-time feedback
    const actionReporter = new ActionReporter({
        mode: 'spinner',
        spinnerFactory: createSpinner,
        showInterruptHint: true,
    });
    this.agent.setActionReporter(actionReporter);

    // Set up ESC key listener
    const handleKeypress = (key) => {
        if (key === '\x1b' || key === '\u001b') {  // ESC
            wasInterrupted = true;
            abortController.abort();
        }
    };

    // Enable raw mode for ESC detection
    if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.on('data', handleKeypress);
    }

    // Start with "Thinking" action
    actionReporter.thinking();

    try {
        const result = await this.processPrompt(input, {
            signal: abortController.signal,
        });

        // Show completion status
        actionReporter.reset();
        console.log(`✓ Done [${model}] (${duration}s)`);
        console.log(this.isMarkdownEnabled() ? renderMarkdown(result) : result);

    } catch (error) {
        if (wasInterrupted || error.name === 'AbortError') {
            actionReporter.interrupted('Operation cancelled');
        } else {
            actionReporter.failAction(error);
            console.error(error.message);
        }
    } finally {
        // Cleanup
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
            process.stdin.removeListener('data', handleKeypress);
        }
        this.agent.setActionReporter(null);
        this.agent.promptReader = null;

        // Save to history (unless interrupted)
        if (!wasInterrupted) {
            this.historyManager.add(input);
        }
    }
}
```

### User Prompt Handling
```javascript
// Set up prompt reader that pauses reporter during user input
this.agent.promptReader = async (prompt) => {
    // Pause the action reporter while waiting
    actionReporter.pause();

    // Temporarily disable raw mode for readline
    if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
        process.stdin.removeListener('data', handleKeypress);
    }

    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        rl.question(prompt, (answer) => {
            rl.close();
            // Re-enable raw mode and ESC listener
            if (process.stdin.isTTY) {
                process.stdin.setRawMode(true);
                process.stdin.on('data', handleKeypress);
            }
            actionReporter.resume();
            resolve(answer);
        });
    });
};
```

## Why This Design

### 1. AbortController Pattern
**Decision**: Use standard AbortController for cancellation.

**Rationale**:
- Standard JavaScript API for abort signaling
- Signal can be passed through async call chain
- Works with fetch, timeouts, and custom code
- Clean cancellation semantics

### 2. Raw Mode for ESC Detection
**Decision**: Enable raw terminal mode during LLM processing.

**Rationale**:
- ESC key needs immediate detection
- Standard readline buffers until Enter
- Raw mode gives character-by-character control
- Must be disabled during user prompts (readline needs it)

### 3. ActionReporter Integration
**Decision**: Use achilles-agent-lib's ActionReporter with injected spinner.

**Rationale**:
- Consistent progress feedback across skills
- Stack-based action tracking (nested operations)
- Pause/resume for user prompts
- Spinner factory injection for customization

### 4. Prompt Reader Injection
**Decision**: Set `agent.promptReader` to handle interactive skill prompts.

**Rationale**:
- Skills (especially iskills) may need user input
- Agent delegates to promptReader when set
- Allows coordination with spinner (pause/resume)
- Proper terminal mode switching

### 5. History on Success Only
**Decision**: Only add to history if not interrupted.

**Rationale**:
- Cancelled operations shouldn't pollute history
- History represents successful interactions
- User can re-run after cancellation
- Clean history for meaningful recall

## Public API

### Constructor
```javascript
new NaturalLanguageProcessor({
    agent,              // RecursiveSkilledAgent instance
    processPrompt,      // (input, opts) => Promise - prompt handler
    historyManager,     // HistoryManager instance
    isMarkdownEnabled,  // () => boolean - markdown state callback
})
```

### Methods
```javascript
async process(input)  // Process natural language input
```

## Pseudocode

```javascript
class NaturalLanguageProcessor {
    constructor({ agent, processPrompt, historyManager, isMarkdownEnabled }) {
        this.agent = agent;
        this.processPrompt = processPrompt;
        this.historyManager = historyManager;
        this.isMarkdownEnabled = isMarkdownEnabled || (() => true);
    }

    async process(input) {
        abortController = new AbortController();
        wasInterrupted = false;

        // Set up progress feedback
        actionReporter = new ActionReporter({ mode: 'spinner' });
        agent.setActionReporter(actionReporter);

        // Set up ESC handler
        enableRawMode();
        onKeypress((key) => {
            if (key === ESC) {
                wasInterrupted = true;
                abortController.abort();
            }
        });

        // Set up prompt reader for interactive skills
        agent.promptReader = async (prompt) => {
            actionReporter.pause();
            disableRawMode();
            answer = await readlineQuestion(prompt);
            enableRawMode();
            actionReporter.resume();
            return answer;
        };

        actionReporter.thinking();

        try {
            result = await this.processPrompt(input, {
                signal: abortController.signal
            });

            actionReporter.reset();
            print(formatResult(result));
        } catch (error) {
            if (wasInterrupted) {
                actionReporter.interrupted('Cancelled');
            } else {
                actionReporter.fail(error);
            }
        } finally {
            disableRawMode();
            agent.setActionReporter(null);
            agent.promptReader = null;

            if (!wasInterrupted) {
                historyManager.add(input);
            }
        }
    }
}
```

## State Transitions

```
┌─────────────────────────────────────────────────────────────────┐
│                  PROCESSING STATE MACHINE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   IDLE ──► process(input) ──► PROCESSING                        │
│                                    │                            │
│                    ┌───────────────┼───────────────┐            │
│                    │               │               │            │
│                    ▼               ▼               ▼            │
│              PROMPTING         CANCELLED       COMPLETED        │
│               (skill           (ESC key)       (success)        │
│               asks user)           │               │            │
│                    │               │               │            │
│         resume ◄───┘               │               │            │
│                    │               │               │            │
│                    ▼               │               │            │
│               PROCESSING ◄─────────┴───────────────┘            │
│                    │                                            │
│                    └──────────────► IDLE                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Notes/Constraints

- ESC detection requires TTY environment
- Non-TTY environments cannot cancel
- Spinner writes to stderr (preserves stdout)
- Model info retrieved from agent's invoker strategy
- Duration calculated from ActionReporter history
- Markdown rendering is optional (controlled by callback)
- finally block ensures cleanup even on errors
