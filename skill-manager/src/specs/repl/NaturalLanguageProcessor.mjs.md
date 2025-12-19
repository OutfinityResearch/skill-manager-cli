# NaturalLanguageProcessor Module Specification

Handles LLM processing for natural language prompts with abort capability.

## Overview

NaturalLanguageProcessor manages the execution of natural language prompts through the LLM with support for ESC key cancellation, real-time progress feedback via ActionReporter, and user prompt handling during execution.

## Constructor

Creates a new NaturalLanguageProcessor.

Accepts options object with:
- agent: RecursiveSkilledAgent instance for skill execution
- processPrompt: Callback function that processes prompts through orchestrator
- historyManager: HistoryManager instance for saving commands
- isMarkdownEnabled: Optional callback returning current markdown rendering state (defaults to always true)

## Public Methods

### process

Processes a natural language prompt through the LLM.

Accepts:
- input: The user input string

Processing sequence:

Setup phase:
1. Create AbortController for cancellation
2. Initialize wasInterrupted flag to false
3. Create ActionReporter in spinner mode with interrupt hint enabled
4. Attach ActionReporter to agent
5. Set up ESC key listener on stdin
6. Enable raw mode for keypress detection

User prompt handling:
1. Assign promptReader to agent for handling intermediate prompts
2. When prompt requested:
   - Pause ActionReporter
   - Disable raw mode
   - Create readline interface
   - Get user answer
   - Re-enable raw mode and ESC listener
   - Resume ActionReporter
   - Return answer

Execution phase:
1. Start with "Thinking" action
2. Call processPrompt with abort signal
3. On success:
   - Get model info from last invocation
   - Reset ActionReporter
   - Calculate duration from ActionReporter history
   - Print success message with check icon, model info, and duration
   - Print separator line
   - Render result with markdown if enabled
   - Print closing separator line

Error handling:
- If interrupted or AbortError: Call interrupted on reporter, print newline
- Other errors: Call failAction on reporter, print error message

Cleanup phase:
1. Disable raw mode
2. Remove keypress listener
3. Clear ActionReporter from agent
4. Clear promptReader from agent
5. Save input to history if not interrupted

## ESC Key Cancellation

The processor listens for ESC key (code \x1b or \u001b) while processing.

When detected:
1. Set wasInterrupted to true
2. Call abort on AbortController

The abort signal is passed to processPrompt, allowing the underlying LLM call to be cancelled.

## ActionReporter Integration

ActionReporter provides real-time feedback during LLM operations.

Configuration:
- Mode: spinner
- spinnerFactory: Uses createSpinner from UI module
- showInterruptHint: Enabled to show "Press ESC to cancel"

Methods used:
- thinking(): Initial state while waiting for LLM
- pause(): Pauses spinner during user input
- resume(): Resumes spinner after user input
- reset(): Clears current action state
- interrupted(message): Shows cancellation message
- failAction(error): Shows error state

## Output Format

Success output structure:
```
✓ Done [model-name] (duration)
────────────────────────────────────────────────────────────────
[result with optional markdown rendering]
────────────────────────────────────────────────────────────────
```

Cancellation output:
```
[spinner interrupted message]
[blank line]
```

Error output:
```
[spinner fail state]
[error.message]
```

## Dependencies

- ActionReporter: Real-time progress feedback
- createSpinner: Creates spinner instances
- renderMarkdown: Renders markdown content
- colors, icons, style, line, box: Theme utilities

## Exports

Exports NaturalLanguageProcessor class as both named and default export.
