# InteractivePrompt Module Specification

Handles interactive user input with command and skill selector support.

## Overview

InteractivePrompt manages the input line with features including slash command detection, interactive selector triggering, history navigation, and bracketed paste handling. It uses raw terminal mode for precise key control and delegates line editing to LineEditor.

## Constructor

Creates a new InteractivePrompt instance.

Accepts options object with:
- historyManager: HistoryManager instance for history navigation
- slashHandler: SlashCommandHandler for command parsing
- commandList: Array of available commands for selector
- getUserSkills: Callback function returning array of user skills
- getRepositories: Optional callback returning configured repositories

Initialization:
1. Store provided dependencies
2. Get theme colors from UIContext
3. Build styled prompt string (cyan bold "> ")
4. Build right hint text ("↵ send" in dim)
5. Initialize hint line counter for cleanup

## Public Methods

### prompt

Gets input from the user.

Processing:
1. If not running in TTY, use simple readline prompt
2. Otherwise use interactive prompt with selector support

Returns a promise that resolves to the user's input string.

## Private Methods

### _promptWithSelector

Main interactive input handler with selector and history support.

Sets up:
1. LineEditor instance with prompt, hint, and boxed mode
2. Raw mode on stdin for immediate key handling
3. Bracketed paste mode
4. History navigation state (index and saved buffer)

Key handling:
- Ctrl+C: Clean up and exit process
- Enter: Return current buffer
- "/" at empty buffer: Show command selector
- Escape: Ignored (may be start of escape sequence)
- Up arrow: Navigate to older history entry
- Down arrow: Navigate to newer history entry
- Tab: Trigger skill/repo selector if applicable command typed
- Space after command: Trigger skill/repo selector if command needs argument
- Other keys: Delegate to LineEditor

Command selector flow:
1. Exit raw mode
2. Show command selector
3. If command needs skill argument, show skill selector
4. If command needs repo argument, show repo selector
5. If command needs text arguments, show argument input prompt
6. Otherwise execute command directly

Cleanup on completion:
1. Draw bottom border if boxed mode
2. Disable bracketed paste
3. Exit raw mode
4. Remove key listener

### _handleArgInputFlow

Handles argument input for commands requiring text arguments.

Accepts:
- commandName: The slash command name (e.g., "/add-repo")
- cmdDef: Command definition with usage and description
- resolve: Promise resolve function
- cleanup: Cleanup function

Processing:
1. Display command name
2. Show separator line
3. Display usage information
4. Display description
5. Show cancel hint
6. Create readline interface
7. Handle Ctrl+C for cancellation
8. Prompt for arguments
9. Combine command and arguments
10. Resolve with full command

### _handleSkillInputFlow

Handles input flow after skill selection for commands needing additional input.

Accepts:
- commandName: The slash command (e.g., "/exec")
- selectedSkill: The skill object selected by user
- userSkills: Array of available user skills
- resolve: Promise resolve function
- cleanup: Cleanup function

Processing:
1. Find skill details in userSkills
2. Display skill name
3. Show separator line
4. Display skill type and description
5. Show command-specific input guidance based on command and skill type
6. Show cancel hint
7. Create readline interface
8. Handle Ctrl+C for cancellation
9. Prompt for input with command and skill name prefix
10. Resolve with full command

### _handleSkillInputFlowForCommand

Same as _handleSkillInputFlow but for commands typed without "/" prefix.

### _promptOnce

Fallback readline prompt for non-TTY or simple mode.

Processing:
1. Create readline interface with history and completion
2. Set up hint display for slash commands
3. Poll for line changes to update hints
4. Question user for input
5. Clean up hint display
6. Return answer

## Selector Triggers

Commands triggering skill selector:
- Commands with needsSkillArg flag (e.g., /read, /exec, /test)
- Triggered by Tab or Space after command name

Commands triggering repo selector:
- Commands with needsRepoArg flag (e.g., /remove-repo, /update-repo)
- Triggered by Tab or Space after command name

Commands triggering argument prompt:
- Commands with args: 'required' but no skill/repo arg flags
- Triggered by Tab after command name

## Bracketed Paste Support

Handles terminal bracketed paste mode for proper multi-character paste handling.

Paste start marker: ESC[200~
Paste end marker: ESC[201~

Processing:
1. Detect paste start marker
2. Accumulate paste content
3. Detect paste end marker
4. Pass complete content to LineEditor's handleBracketedPaste

## History Navigation

Up arrow behavior:
1. Save current buffer if first press
2. Move to older entry
3. Display history entry in buffer

Down arrow behavior:
1. Move to newer entry
2. If past newest, restore saved buffer
3. Display entry or saved buffer

Navigation resets when user modifies buffer.
