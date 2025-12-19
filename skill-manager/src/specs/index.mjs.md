# Index Module Specification

Entry point for the skill-manager CLI application, providing both library exports and command-line execution.

## Overview

This module serves as the main entry point for skill-manager-cli. It can be imported as a library to access core components, or executed directly as a CLI tool for managing skill definition files.

## Library Exports

When imported, this module re-exports the following components:

### Core Agent Components
- RecursiveSkilledAgent from achillesAgentLib for skill discovery and execution
- LLMAgent from achillesAgentLib for language model interactions

### REPL Components
- REPLSession for interactive command-line sessions
- SlashCommandHandler for processing slash commands
- HistoryManager for command history persistence

### UI Components
- CommandSelector and related functions for interactive command picking
- Result formatters for displaying execution output
- Help printing utilities

### Utilities
- RepoManager for external repository management
- Built-in skills directory path
- Built-in skill name constants

## CLI Execution

When run directly, the module parses command-line arguments and executes in one of two modes.

### Command Line Arguments

Working Directory:
- Flags: --dir, -d
- Accepts a path to the project directory containing .AchillesSkills
- Defaults to current working directory

Additional Skill Roots:
- Flags: --skill-root, -r
- Can be specified multiple times
- Adds extra directories to search for skills
- Accepts absolute or relative paths

Verbosity:
- Flag: --verbose, -v
- Enables detailed logging output

Debug Mode:
- Flag: --debug
- Shows full JSON output including orchestrator plans and executions

LLM Mode Selection:
- Flag: --fast
- Uses faster, cheaper LLM mode
- Flag: --deep
- Uses more capable LLM mode (default)

Output Formatting:
- Flags: --no-markdown, --raw
- Disables markdown rendering in output

UI Style Selection:
- Flags: --ui, --ui-style
- Accepts style name as next argument
- Flag: --ui-minimal
- Uses minimal UI without colors
- Flag: --ui-claude-code
- Uses Claude Code style UI with animations (default)
- Environment variable SKILL_MANAGER_UI can set default style

Information:
- Flags: --help, -h
- Prints usage information
- Flag: --version
- Prints version number

Prompt:
- Any non-flag arguments after options are joined as the prompt
- If no prompt is provided, REPL mode is entered

## Execution Modes

### Single-Shot Mode

Activated when a prompt is provided as command-line arguments.

Processing steps:
1. Create execution context with working directory, skills directory, agent, and logger
2. Execute prompt through skills-orchestrator skill
3. Parse and format the result
4. Print result to console
5. Exit with status code 0 on success, 1 on error

Result formatting:
- Attempts to parse result as JSON
- If result contains orchestrator execution data, summarizes it unless debug mode is enabled
- In debug mode, prints full JSON output

### REPL Mode

Activated when no prompt is provided.

Initialization steps:
1. Wait for any pending skill preparations to complete
2. Create REPLSession with agent and configuration options
3. Start the interactive session

REPLSession receives:
- Working directory path
- Skills directory path
- Built-in skills directory path (for filtering user skills)
- Debug mode flag
- Markdown rendering flag
- RepoManager instance

## Initialization Sequence

1. Parse all command-line arguments
2. Configure logger based on verbose flag
3. Ensure user's .AchillesSkills directory exists (create if missing)
4. Initialize RepoManager with working directory and global repos directory
5. Get enabled skill roots from repository configuration
6. Merge all skill roots: built-in skills, bash skills, CLI-specified roots, config-specified roots
7. Initialize LLMAgent with name "skill-manager-agent"
8. Initialize RecursiveSkilledAgent with LLM agent, working directory, and all skill roots
9. Attach RepoManager to agent for editability checks
10. Initialize UI provider based on selected style
11. Branch to single-shot or REPL mode based on prompt presence

## Skill Root Sources

Skills are discovered from multiple sources, merged in this order:
1. Built-in skills bundled with the module (src/.AchillesSkills)
2. Bash command skills (bash-skills/.AchillesSkills) if directory exists
3. Skill roots specified via --skill-root CLI flags
4. Skill roots from repository configuration file

## Error Handling

- Invalid UI style causes immediate exit with error message listing available styles
- Single-shot execution errors print message and exit with status 1
- In verbose mode, full stack traces are printed on error

## Direct Execution Detection

The isRunDirectly function determines if the module is being run as a script:
- Compares the script path from process.argv with the module's file path
- Uses realpathSync to resolve symlinks for accurate comparison
- Falls back to URL-based comparison if resolution fails
