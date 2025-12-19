# CommandSelector Module Specification

Provides interactive command and skill selection with arrow key navigation and filtering.

## Overview

CommandSelector implements a terminal-based picker interface allowing users to select from a list of commands, skills, tests, or repositories using arrow keys, filtering by typing, and confirming with Enter or Tab.

## CommandSelector Class

### Constructor

Creates a new CommandSelector instance.

Accepts:
- commands: Array of objects with name, description, and usage properties
- options: Configuration object with optional fields:
  - maxVisible: Maximum items to show at once (default 8)
  - theme: Theme object for colors (defaults to baseTheme)

Initializes:
- Stores commands array
- Sets up scroll position tracking (selectedIndex, scrollOffset)
- Initializes empty filter
- Copies commands to filteredCommands

### Public Methods

#### updateFilter

Updates the command filter and resets selection.

Accepts:
- input: Filter string

Processing:
1. Convert input to lowercase
2. Filter commands where name or description contains filter
3. Reset selectedIndex to 0
4. Reset scrollOffset to 0

#### moveUp

Moves selection up by one item.

Processing:
1. If not at first item, decrement selectedIndex
2. If selected is above visible area, adjust scrollOffset

#### moveDown

Moves selection down by one item.

Processing:
1. If not at last item, increment selectedIndex
2. If selected is below visible area, adjust scrollOffset

#### getSelected

Returns the currently selected command object, or null if no selection.

#### render

Renders the command list to an array of styled strings.

Output format:
- Scroll indicator "↑ N more" if items above viewport
- For each visible item:
  - Selected: "❯ [cyan]name[/cyan] [gray]description[/gray]"
  - Unselected: "  name [gray]description[/gray]"
- Scroll indicator "↓ N more" if items below viewport
- "No matching commands" if filtered list is empty

Returns array of formatted strings.

#### getRenderedLineCount

Returns the number of lines the current render will produce.

Includes scroll indicators and empty state message in count.

## showCommandSelector Function

Shows an interactive command selector and returns the selection.

Accepts:
- commands: Array of command objects
- options: Configuration object with optional fields:
  - theme: Theme object
  - prompt: Prompt string (default "> /")
  - initialFilter: Starting filter text
  - maxVisible: Maximum visible items (default 10)

Processing:
1. Create CommandSelector instance
2. Hide terminal cursor
3. Enable raw mode for key capture
4. Render initial state with prompt and command list

Key handling:
- Up arrow: Move selection up
- Down arrow: Move selection down
- Enter: Return selected command
- Tab: Return selected command
- Escape or Ctrl+C: Cancel (return null)
- Backspace: Remove last filter character, cancel if empty
- Printable characters: Add to filter

Cleanup:
- Clear displayed content
- Show cursor
- Disable raw mode
- Remove key listener

Returns promise resolving to:
- Object with name, args, needsSkillArg, needsRepoArg on selection
- null on cancellation

## showSkillSelector Function

Shows an interactive skill selector.

Accepts:
- skills: Array of skill objects with name, type, description
- options: Configuration similar to showCommandSelector

Transforms skills to command format with:
- name: shortName or name
- description: "[type] description"

Returns promise resolving to:
- Object with name and type on selection
- null on cancellation

## showTestSelector Function

Shows an interactive test selector.

Accepts:
- tests: Array of test info objects from test discovery
- options: Configuration similar to showCommandSelector

Transforms tests to command format with:
- name: shortName or skillName
- description: "[type] filename"

Returns promise resolving to:
- Object with skillName, shortName, skillType, testFile, skillDir on selection
- null on cancellation

## showHelpSelector Function

Shows an interactive help topic selector.

Accepts:
- topics: Array of topic objects with name, title, description
- options: Configuration similar to showCommandSelector

Requires TTY mode (returns null if not available).

Returns promise resolving to:
- Object with name, title, type on selection
- null on cancellation

## showRepoSelector Function

Shows an interactive repository selector.

Accepts:
- repos: Array of repository objects with name, source, enabled, editable
- options: Configuration similar to showCommandSelector

Transforms repos to command format with:
- name: Repository name
- description: "✓/✗ editable/read-only - source"

Requires TTY mode (returns null if not available).

Returns promise resolving to:
- Object with name on selection
- null on cancellation

## buildCommandList Function

Builds command list from slash command definitions.

Accepts:
- slashCommands: Object mapping command names to definitions

Processing:
1. Iterate command entries
2. Skip duplicate skills (dedup by skill name)
3. Create command object with name, description, usage, skill flags
4. Add built-in /help command
5. Sort alphabetically by name

Returns array of command objects suitable for CommandSelector.

## Terminal Control

Uses ANSI escape sequences for:
- HIDE_CURSOR: Hide terminal cursor during selection
- SHOW_CURSOR: Restore cursor visibility
- CLEAR_LINE: Clear current line content
- MOVE_UP: Move cursor up one line
- MOVE_DOWN: Move cursor down one line
- MOVE_TO_COL: Position cursor at specific column

## Exports

Exports:
- CommandSelector class (named and default)
- showCommandSelector function
- showSkillSelector function
- showTestSelector function
- showHelpSelector function
- showRepoSelector function
- buildCommandList function
