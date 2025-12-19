# SlashCommandHandler Module Specification

Manages slash command definitions, parsing, execution, and completion.

## Overview

SlashCommandHandler provides the slash command interface for the REPL, mapping command names to skills and handling special commands like repository management. It supports argument parsing, autocomplete, and context-sensitive hints.

## Static Properties

### COMMANDS

A static object mapping command names to their definitions.

Each command definition contains:
- skill: The built-in skill name to execute (or null for special handling)
- usage: Usage string for help display
- description: Human-readable description
- args: Argument requirement ("none", "optional", or "required")
- needsSkillArg: Boolean indicating if command takes a skill name
- needsRepoArg: Boolean indicating if command takes a repository name

Available commands:

Skill CRUD commands:
- ls/list: List skills, optionally filtering by repository
- read: Read a skill definition file
- write: Create or update a skill file
- delete: Delete a skill directory
- validate: Validate skill against schema
- template: Get blank template for skill type

Code generation and testing commands:
- generate: Generate .mjs code from skill definition
- test: Test skill code (shows picker if no args)
- run-tests: Run .tests.mjs files
- refine: Iteratively improve skill
- update: Update specific section
- exec: Execute any skill directly
- specs: Read skill's .specs.md file
- specs-write: Create/update skill's .specs.md file
- write-tests: Generate test file for a skill
- gen-tests: Generate tests from cskill specs

Repository management commands:
- repos: List configured repositories
- add-repo: Add external skill repository
- remove-repo: Remove a repository
- update-repo: Update repository via git pull
- enable-repo: Enable a disabled repository
- disable-repo: Disable a repository
- edit-repo: Toggle repository editability

## Constructor

Creates a new SlashCommandHandler.

Accepts options object with:
- executeSkill: Callback function for skill execution
- getUserSkills: Callback returning array of user skills
- getSkills: Callback returning all skills
- getRepositories: Optional callback returning configured repositories

## Public Methods

### isSlashCommand

Checks if input is a slash command.

Returns true if input starts with "/".

### parseSlashCommand

Parses slash command into components.

Accepts:
- input: User input starting with /

Returns object with:
- command: Command name (lowercase)
- args: Trimmed argument string or empty string

Returns null if input does not match command pattern.

### executeSlashCommand

Executes a slash command.

Accepts:
- command: Command name without leading /
- args: Argument string
- options: Execution options including context

Processing for special commands:

help or ?:
- With args: Show help for specific topic
- Without args: Return showHelpPicker signal

commands:
- Show commands help topic

raw:
- Return toggleMarkdown signal

quit, exit, or q:
- Return exitRepl signal

test:
- Without args: Return showTestPicker signal
- With args: Execute test-code skill

exec:
- Split args into skill name and input
- Execute specified skill with remaining args

run-tests:
- Without args: Return showRunTestsPicker signal
- With args: Execute run-tests skill

Repository commands:
- repos: List all configured repositories
- add-repo: Parse source, name, and flags; add repository; sync and reload
- remove-repo: Get repo path; remove repository; sync and reload
- update-repo: Update specified or all repositories; reload
- enable-repo: Enable repository; sync and reload
- disable-repo: Disable repository; sync and reload
- edit-repo: Toggle editable status

ls/list with --repo:
- Parse repo name from args
- Filter skills by repository path
- Format and return skill list

Standard command execution:
- Check if args required but missing
- Execute mapped skill via callback
- Format result

Returns object with:
- handled: Boolean indicating command was processed
- result: Formatted result string (on success)
- error: Error message (on failure)
- Special signals: showHelpPicker, showTestPicker, showRunTestsPicker, toggleMarkdown, exitRepl

### getCompletions

Gets autocomplete suggestions for input.

Accepts:
- line: Current input line

Processing:
1. If starts with "/", provide slash command completions
2. If just "/" typed, return all commands
3. If completing command name, match against command list
4. If completing arguments, match based on command type:
   - Skill commands: Suggest user skill names
   - template: Suggest skill types
   - exec: Suggest all skills
   - write: Suggest skill types as second arg
   - Repository commands: Suggest repo names
   - ls/list: Suggest "all" and "--repo"
5. For non-slash input, match basic commands

Returns tuple of [completions array, original line].

### getInputHint

Gets context-sensitive hint for current input.

Accepts:
- line: Current input line

Returns:
- Hint text for the command/state
- null if not a slash command

Hints provided:
- Help commands: "Show available slash commands"
- raw: "Toggle raw output"
- quit/exit: "Exit the REPL"
- Unknown command: Suggests partial matches
- Command without required args: Shows usage
- Command with args: Shows description

### printHelp

Prints slash command help.

Delegates to HelpSystem showHelp with "commands" topic.

## Private Methods

### _syncAgentSkillRoots

Synchronizes agent's skill roots with RepoManager configuration.

Accepts:
- agent: RecursiveSkilledAgent instance
- repoManager: RepoManager instance
- options: Optional object with removedSkillsPath

Processing:
1. Get current agent roots and repo roots
2. Collect paths to remove (disabled repos, removed repo)
3. Add new enabled repo paths to agent
4. Remove disabled/deleted paths from agent

Called after repository add/remove/enable/disable operations.

## Dependencies

- formatSlashResult: Formats skill execution results
- showHelp: Displays help content
- BUILT_IN_SKILLS: Constants for skill names

## Exports

Exports SlashCommandHandler class as both named and default export.
