# HistoryManager Module Specification

Manages persistent command history for the CLI with per-project isolation.

## Overview

HistoryManager stores command history in a file within each project's working directory, providing project-specific history isolation. It supports navigation (up/down arrow keys), search, and automatic trimming.

## Constants

DEFAULT_HISTORY_FILE: The default filename for history storage is ".skill-manager-history"

DEFAULT_MAX_ENTRIES: The maximum number of history entries to store is 1000

## Constructor

Creates a new HistoryManager instance.

Accepts optional configuration object with:
- workingDir: Directory for history file (defaults to current working directory)
- historyFile: Filename for history (defaults to DEFAULT_HISTORY_FILE)
- maxEntries: Maximum entries to keep (defaults to DEFAULT_MAX_ENTRIES)

Initialization:
1. Resolve working directory to absolute path
2. Construct full history file path
3. Initialize empty history array
4. Set current navigation index to -1 (new input position)
5. Load existing history from file

## File Format

History is stored as a newline-delimited text file with one command per line. Empty lines are filtered out when loading.

## Public Methods

### add

Adds a command to history.

Accepts:
- command: The command string to add

Processing:
1. Trim whitespace from command
2. Skip if empty after trimming
3. Skip if command duplicates the most recent entry
4. Append command to history array
5. Trim array if exceeds maximum entries (keep newest)
6. Save history to file
7. Reset navigation position

### get

Gets a command by index.

Accepts:
- index: Zero-based index (0 is oldest, length-1 is newest)

Returns:
- The command at that index, or null if out of bounds

### getPrevious

Gets the previous (older) command for up arrow navigation.

Processing:
1. Return null if history is empty
2. If at new input position (-1), start from newest entry
3. Otherwise move to older entry if not at oldest
4. Return command at current index

Used for up arrow key navigation in the REPL.

### getNext

Gets the next (newer) command for down arrow navigation.

Processing:
1. Return null if already at new input position
2. Move to newer entry if not at newest
3. If moving past newest, reset to new input position (-1)
4. Return command at current index, or null if at new input position

Used for down arrow key navigation in the REPL.

### resetNavigation

Resets the navigation index to new input position.

Sets currentIndex to -1. Called after user enters a new command.

### getRecent

Gets a list of recent commands.

Accepts:
- count: Number of recent commands to return (default 10)

Returns:
- Array of objects with index (1-based for display) and command properties
- Ordered from older to newer within the slice

### search

Searches history for commands containing a string.

Accepts:
- query: Search string (case-insensitive)
- limit: Maximum results to return (default 10)

Processing:
1. Convert query to lowercase
2. Search from newest to oldest
3. Include commands whose lowercase form contains query
4. Stop when limit reached

Returns:
- Array of objects with index (1-based) and command properties
- Ordered from newest to oldest

### getAll

Gets all history entries.

Returns a copy of the history array (not a reference).

### length

Property getter for the count of history entries.

Returns the length of the history array.

### clear

Clears all history.

Processing:
1. Empty the history array
2. Reset navigation index to -1
3. Save empty history to file

### getHistoryPath

Gets the path to the history file.

Returns the full path to the history file.

## Private Methods

### _load

Loads history from the file.

Processing:
1. Check if history file exists
2. Read file content as UTF-8
3. Split by newlines
4. Filter out empty lines
5. Trim to max entries if needed (keeping newest)
6. Save back if trimmed
7. Silently ignore read errors (start with empty history)

### _save

Saves history to the file.

Processing:
1. Join history entries with newlines
2. Add trailing newline
3. Write to history file as UTF-8
4. Silently ignore write errors

## Exports

Exports the HistoryManager class as both named and default export.
