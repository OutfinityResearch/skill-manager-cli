# QuickCommands Module Specification

Handles built-in quick commands that execute without LLM involvement.

## Overview

QuickCommands provides fast, deterministic execution for common REPL commands like help, list, reload, and history. These commands bypass the LLM entirely for immediate response.

## Constructor

Creates a new QuickCommands handler.

Accepts options object with:
- getUserSkills: Callback function returning array of user skills
- getAllSkills: Callback function returning array of all skills
- reloadSkills: Callback function that reloads skills and returns count
- historyManager: HistoryManager instance for history commands
- builtInSkillsDir: Optional path to built-in skills for filtering

## Public Methods

### isQuickCommand

Checks if input matches a quick command pattern.

Accepts:
- input: User input string

Returns true for these commands (case-insensitive):
- "help"
- "reload"
- "list" or "ls"
- "list all" or "ls -a"
- "history" or "hist"
- Strings starting with "history " or "hist "

### execute

Executes a quick command.

Accepts:
- input: User input string

Processing by command type:

help:
- Calls printHelp utility function
- Returns handled: true

reload:
- Delegates to _handleReload
- Returns handled: true

list or ls:
- Delegates to _handleList with showAll false
- Shows only user skills
- Returns handled: true

list all or ls -a:
- Delegates to _handleList with showAll true
- Shows both user and built-in skills
- Returns handled: true

history or hist (no args):
- Calls showHistory utility function
- Returns handled: true

history or hist with args:
- Delegates to _handleHistory
- Returns handled: true

Unrecognized:
- Returns handled: false

## Private Methods

### _handleReload

Handles the reload command.

Processing:
1. Create spinner with "Reloading skills" message
2. Call reloadSkills callback
3. Update spinner to success with count
4. Return handled: true

### _handleList

Handles list commands.

Accepts:
- showAll: Boolean indicating whether to show all skills

Processing when showAll is true:
1. Get all skills via callback
2. Split into built-in and user skills based on builtInSkillsDir
3. Print header "All skills:"
4. Print "User:" section with bullet list of user skills
5. Print "Built-in:" section with bullet list of built-in skills
6. Each skill shown as "• [type] name"

Processing when showAll is false:
1. Get user skills via callback
2. If empty, print "No user skills found."
3. Otherwise print "User skills:" with bullet list
4. Each skill shown as "• [type] name"

Returns handled: true

### _handleHistory

Handles history command with arguments.

Accepts:
- input: Full input string including command

Processing:
1. Extract arguments after "history" or "hist"
2. If argument is "clear": Clear history and print confirmation
3. If argument is numeric: Show that many recent history entries
4. Otherwise: Search history for the argument string

Returns handled: true

## Dependencies

- createSpinner: Creates progress spinner
- printHelp: Displays REPL help
- showHistory: Displays recent history entries
- searchHistory: Searches history for a string

## Exports

Exports QuickCommands class as both named and default export.
