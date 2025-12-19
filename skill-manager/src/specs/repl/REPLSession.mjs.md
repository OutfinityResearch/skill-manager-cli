# REPLSession Module Specification

Manages the interactive REPL session for skill-manager, coordinating input handling, command processing, and result display.

## Overview

REPLSession is the main orchestrator for interactive CLI sessions. It coordinates between three sub-modules (InteractivePrompt, QuickCommands, NaturalLanguageProcessor) to provide a complete interactive experience with command history, slash commands, and natural language processing.

## Constructor

Creates a new REPLSession instance.

Accepts:
- agent: A RecursiveSkilledAgent instance for skill execution
- options: Configuration object with the following optional fields:
  - workingDir: Working directory path (defaults to agent's start directory)
  - skillsDir: Skills directory path (defaults to workingDir/.AchillesSkills)
  - builtInSkillsDir: Path to built-in skills directory for filtering user skills
  - historyManager: Pre-configured HistoryManager instance
  - repoManager: RepoManager instance for external skill repositories
  - debug: Enable debug mode showing full JSON output
  - renderMarkdown: Enable markdown rendering (default true)

Initialization sequence:
1. Store agent and options
2. Resolve working and skills directories
3. Create or use provided HistoryManager
4. Build execution context object
5. Create SlashCommandHandler with callback functions
6. Build command list for interactive selector
7. Initialize InteractivePrompt sub-module
8. Initialize QuickCommands sub-module
9. Initialize NaturalLanguageProcessor sub-module

## Execution Context

The context object passed to skill executions contains:
- workingDir: Path to the working directory
- skillsDir: Path to the skills directory
- skilledAgent: Reference to the RecursiveSkilledAgent
- llmAgent: Reference to the LLM agent
- logger: Reference to the logger
- repoManager: Reference to the repository manager

## Public Methods

### start

Starts the interactive REPL session.

Processing:
1. Display startup banner with session information
2. Enter main loop
3. Get input from InteractivePrompt
4. Skip empty input
5. Check for exit commands (exit, quit, q) and break loop
6. Check for quick commands and delegate to QuickCommands
7. Check for slash commands and delegate to slash handler
8. Otherwise process as natural language through NaturalLanguageProcessor

Returns when user exits the session.

### processPrompt

Processes a user prompt through the skills-orchestrator.

Accepts:
- userPrompt: The natural language prompt
- opts: Optional execution options including skillName override

Processing:
1. Extract skillName from opts, defaulting to skills-orchestrator
2. Execute prompt through agent with context
3. Parse JSON responses for orchestrator results
4. In debug mode, return full JSON or raw result
5. In normal mode, summarize orchestrator results

Returns the processed result as a string.

### getUserSkills

Returns the list of user skills (excludes built-in skills).

Processing:
1. Get all skills from agent
2. If builtInSkillsDir is set, filter out skills from that directory
3. Return filtered list

### reloadSkills

Triggers skill re-discovery from disk.

Delegates to agent's reloadSkills method.

## Private Methods

### _executeSkill

Directly executes a skill without going through the orchestrator.

Accepts:
- skillName: Name of the skill to execute
- input: Input to pass to the skill
- opts: Additional execution options

Processing:
1. Call agent.executePrompt with skillName specified
2. Include context in execution options

### _showBanner

Displays the startup banner with session information.

Content displayed:
1. Header bar with "Skill Manager" title
2. Current working directory (shortened)
3. LLM model information and mode (fast/deep)
4. Skills summary grouped by type (max 4 skills per type shown)
5. History entry count if history exists
6. Usage hint about "/" for commands

Uses UIContext theme for styling.

### _handleSlashCommand

Handles execution of a slash command.

Processing:
1. Parse the slash command input
2. Create spinner for progress indication
3. Execute command through slash handler
4. Handle special result types:
   - exitRepl: Return true to exit session
   - toggleMarkdown: Toggle markdown rendering
   - showTestPicker: Show interactive test selector
   - showRunTestsPicker: Show test runner selector
   - showHelpPicker: Show help topic selector
   - error: Display error via spinner
   - result: Display result with markdown rendering if enabled
5. Save successful commands to history

Returns true if REPL should exit, false otherwise.

### _handleTestPicker

Shows interactive test selector when /test is called without arguments.

Processing:
1. Discover available tests using test discovery
2. If no tests found, inform user
3. Show interactive selector with test options
4. Run selected test with spinner
5. Format and display test results
6. Save command to history

### _handleRunTestsPicker

Shows interactive selector for /run-tests with "run all" option.

Processing:
1. Discover available tests
2. Add "Run All Tests" as first option
3. Show interactive selector
4. If "all" selected, run full test suite
5. Otherwise run selected individual test
6. Format and display results
7. Save command to history

### _handleHelpPicker

Shows interactive help topic selector.

Processing:
1. Get available help topics
2. Get command help entries
3. Combine into single list with type indicators
4. Show interactive selector
5. Display selected help content
6. Save command to history

## Dependencies

- InteractivePrompt: Handles user input with selectors
- QuickCommands: Handles quick commands not requiring LLM
- NaturalLanguageProcessor: Processes natural language through LLM
- SlashCommandHandler: Parses and executes slash commands
- HistoryManager: Manages command history
- UIContext: Provides theming
- createSpinner: Creates progress spinners
- summarizeResult: Formats orchestrator results
- renderMarkdown: Renders markdown content
- discoverSkillTests, runTestFile, runTestSuite: Test execution
- formatTestResult, formatSuiteResults: Test result formatting
- showHelp, getHelpTopics, getCommandHelp: Help system
