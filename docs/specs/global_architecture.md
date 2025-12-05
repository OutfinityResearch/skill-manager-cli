# Global Architecture and Design Model

ID: DS(/global_architecture)

This design specification captures the cross-cutting architecture, module relationships, and key design decisions that apply to the entire skill-manager-cli application. It complements the module-level DS files and provides global context for understanding the system.

## Scope

- Describe the layered architecture and module responsibilities
- Define the data flow patterns used throughout the application
- Document the dual-interface approach (natural language + slash commands)
- Explain the dependency relationships between modules

## System Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         SKILL-MANAGER-CLI Architecture                        │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────┐     ┌─────────────────────────────────────────────────┐   │
│   │   CLI       │     │              Entry Layer                        │   │
│   │   Args      │────►│  index.mjs  │  Main entry, arg parsing, mode    │   │
│   │   User      │     │             │  detection (REPL vs single-shot)  │   │
│   └─────────────┘     └─────────────────────────────────────────────────┘   │
│                                          │                                   │
│                                          ▼                                   │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                         REPL Layer                                   │   │
│   │  ┌──────────────┐  ┌──────────────────┐  ┌────────────────────────┐ │   │
│   │  │ REPLSession  │  │ InteractivePrompt│  │  SlashCommandHandler   │ │   │
│   │  │  (session    │  │  (input capture  │  │  (command definitions  │ │   │
│   │  │   manager)   │  │   with selectors)│  │   and execution)       │ │   │
│   │  └──────────────┘  └──────────────────┘  └────────────────────────┘ │   │
│   │  ┌──────────────┐  ┌──────────────────┐  ┌────────────────────────┐ │   │
│   │  │QuickCommands │  │ NaturalLanguage  │  │    HistoryManager      │ │   │
│   │  │  (no-LLM)    │  │   Processor      │  │  (persistent history)  │ │   │
│   │  └──────────────┘  └──────────────────┘  └────────────────────────┘ │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                          │                                   │
│                                          ▼                                   │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                          UI Layer                                    │   │
│   │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────────┐ │   │
│   │  │CommandSelect │  │   Spinner    │  │   ResultFormatter          │ │   │
│   │  │   (picker)   │  │ (animation)  │  │  (output formatting)       │ │   │
│   │  └──────────────┘  └──────────────┘  └────────────────────────────┘ │   │
│   │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────────┐ │   │
│   │  │  LineEditor  │  │  HelpPrinter │  │   MarkdownRenderer         │ │   │
│   │  │ (text input) │  │  (help text) │  │  (terminal markdown)       │ │   │
│   │  └──────────────┘  └──────────────┘  └────────────────────────────┘ │   │
│   │  ┌──────────────┐                                                   │   │
│   │  │TestResult    │                                                   │   │
│   │  │ Formatter    │                                                   │   │
│   │  └──────────────┘                                                   │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                          │                                   │
│                                          ▼                                   │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                        Support Layer                                 │   │
│   │  ┌──────────────┐  ┌──────────────────────────────────────────────┐ │   │
│   │  │skillSchemas  │  │           testDiscovery                      │ │   │
│   │  │ (validation) │  │  (test file discovery and execution)         │ │   │
│   │  └──────────────┘  └──────────────────────────────────────────────┘ │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                          │                                   │
│                                          ▼                                   │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                  ACHILLES-AGENT-LIB (External Dependency)            │   │
│   │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────────┐ │   │
│   │  │Recursive     │  │   LLMAgent   │  │    ActionReporter          │ │   │
│   │  │SkilledAgent  │  │ (invocation) │  │  (progress feedback)       │ │   │
│   │  └──────────────┘  └──────────────┘  └────────────────────────────┘ │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Dual-Interface Architecture

The skill-manager-cli provides two complementary interfaces for user interaction:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        DUAL-INTERFACE PATTERN                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   NATURAL LANGUAGE PATH                 SLASH COMMAND PATH                      │
│   ═══════════════════                   ════════════════                        │
│   Flexible, exploratory                 Fast, deterministic                     │
│                                                                                 │
│   ┌───────────────┐                     ┌───────────────┐                       │
│   │  User types   │                     │  User types   │                       │
│   │ "list skills" │                     │   "/ls"       │                       │
│   └───────────────┘                     └───────────────┘                       │
│          │                                     │                                │
│          ▼                                     ▼                                │
│   ┌───────────────┐                     ┌───────────────┐                       │
│   │NaturalLanguage│                     │SlashCommand   │                       │
│   │  Processor    │                     │  Handler      │                       │
│   └───────────────┘                     └───────────────┘                       │
│          │                                     │                                │
│          ▼                                     ▼                                │
│   ┌───────────────┐                     ┌───────────────┐                       │
│   │  LLM Call     │                     │ Direct Skill  │                       │
│   │ (orchestrator)│                     │  Execution    │                       │
│   └───────────────┘                     └───────────────┘                       │
│          │                                     │                                │
│          └─────────────────┬───────────────────┘                                │
│                            ▼                                                    │
│                     ┌───────────────┐                                           │
│                     │ Skill Engine  │                                           │
│                     │(achilles-lib) │                                           │
│                     └───────────────┘                                           │
│                                                                                 │
│   TRADE-OFFS:                                                                   │
│   • Natural: More flexible, slower, uses LLM tokens                             │
│   • Slash: Instant execution, predictable, no LLM cost                          │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Input Processing Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         INPUT PROCESSING FLOW                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   User Input                                                                    │
│       │                                                                         │
│       ▼                                                                         │
│   ┌───────────────────────────────────────────────────────────────┐            │
│   │                    InteractivePrompt                          │            │
│   │  • Raw terminal mode for "/" detection                        │            │
│   │  • History navigation (↑/↓)                                   │            │
│   │  • Shows CommandSelector when "/" typed alone                 │            │
│   └───────────────────────────────────────────────────────────────┘            │
│       │                                                                         │
│       ▼                                                                         │
│   ┌───────────────────────────────────────────────────────────────┐            │
│   │                    REPLSession.start()                        │            │
│   │  Decision tree:                                               │            │
│   │                                                               │            │
│   │  exit/quit?  ───► Exit loop                                   │            │
│   │      │                                                        │            │
│   │  QuickCommand? ───► QuickCommands.execute()                   │            │
│   │      │              (help, list, reload, history)             │            │
│   │      │                                                        │            │
│   │  SlashCommand? ───► SlashCommandHandler.executeSlashCommand() │            │
│   │      │              (direct skill execution)                  │            │
│   │      │                                                        │            │
│   │  Otherwise ───► NaturalLanguageProcessor.process()            │            │
│   │                 (LLM-based processing)                        │            │
│   └───────────────────────────────────────────────────────────────┘            │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Module Dependency Graph

```
                                 index.mjs
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
              REPLSession    RecursiveSkilledAgent  LLMAgent
                    │              (external)       (external)
        ┌───────────┼───────────┬─────────────┐
        ▼           ▼           ▼             ▼
  Interactive   QuickCommands  NaturalLanguage  SlashCommand
    Prompt                     Processor         Handler
        │                          │                 │
        │           ┌──────────────┘                 │
        ▼           ▼                                ▼
    LineEditor  ActionReporter              formatSlashResult
        │        (external)                  (ResultFormatter)
        │
        ▼
  CommandSelector ◄────── skillSchemas
        │
        ▼
  showCommandSelector
  showSkillSelector
  showTestSelector
```

## Data Flow Rules

The following rules govern data flow throughout the application:

### 1. Command Routing
- All input flows through REPLSession as the central coordinator
- Quick commands are handled locally without LLM invocation
- Slash commands bypass the orchestrator for direct skill execution
- Natural language prompts go through the skills-orchestrator

### 2. History Management
- Commands are saved to history only on successful execution
- Interrupted operations (ESC) do not add to history
- History is per-project (stored in `.skill-manager-history`)
- Navigation uses index-based tracking (-1 = new input)

### 3. Skill Execution
- Context object is passed to all skill executions
- Context includes: workingDir, skillsDir, skilledAgent, llmAgent, logger
- Built-in skills are registered via `additionalSkillRoots`

### 4. Terminal I/O
- Raw mode is used for interactive features (command picker, ESC detection)
- Spinner output goes to stderr, preserving stdout for results
- ANSI codes are used directly (no external dependency)

## Key Design Decisions

### 1. Modular Decomposition
**Decision:** Split REPLSession concerns into dedicated modules (InteractivePrompt, QuickCommands, NaturalLanguageProcessor, SlashCommandHandler).

**Rationale:**
- Single responsibility principle
- Files remain under 500 lines each
- Easier testing and maintenance
- Clear boundaries between concerns

### 2. Callback-Based Dependency Injection
**Decision:** Pass callbacks (getUserSkills, executeSkill) rather than direct object references.

**Rationale:**
- Reduces coupling between modules
- Enables easier mocking in tests
- Modules don't need to know about agent internals
- Flexibility to change implementation without interface changes

### 3. Raw Terminal Mode for Input
**Decision:** Use `stdin.setRawMode(true)` instead of readline for interactive features.

**Rationale:**
- Detect single keystrokes (especially "/")
- Custom arrow key handling for selectors
- ESC key interception for cancellation
- Full control over terminal rendering

### 4. Stateless Utility Functions
**Decision:** ResultFormatter, HelpPrinter, TestResultFormatter are pure functions without state.

**Rationale:**
- Easy to test (pure input → output)
- No initialization required
- Can be used from any context
- Avoids shared mutable state

### 5. Per-Project History
**Decision:** Store history in `.skill-manager-history` in the working directory.

**Rationale:**
- Different projects have different skill sets
- Relevant suggestions per context
- Easy to gitignore
- No global state pollution

## Error Handling Patterns

### 1. Graceful Degradation
- Non-TTY environments fall back to basic readline
- Missing specs files are silently ignored
- History file errors don't crash the application

### 2. User Feedback
- Spinner shows progress during LLM operations
- ESC cancellation updates spinner to "Cancelled" state
- Error messages include context (skill name, operation)

### 3. Abort Controller Pattern
- NaturalLanguageProcessor uses AbortController for cancellation
- Signal is passed to skill execution
- Clean resource cleanup in finally block

## Module Reference

| Layer   | Module                   | Lines | Purpose |
|---------|--------------------------|-------|---------|
| Entry   | index.mjs                | ~265  | CLI entry, exports, main() |
| REPL    | REPLSession.mjs          | ~454  | Session coordination |
| REPL    | InteractivePrompt.mjs    | ~547  | Input with selectors |
| REPL    | QuickCommands.mjs        | ~168  | Non-LLM commands |
| REPL    | NaturalLanguageProcessor | ~148  | LLM processing |
| REPL    | SlashCommandHandler.mjs  | ~495  | Slash command routing |
| REPL    | HistoryManager.mjs       | ~211  | History persistence |
| UI      | CommandSelector.mjs      | ~616  | Interactive pickers |
| UI      | LineEditor.mjs           | ~403  | Text input with cursor |
| UI      | spinner.mjs              | ~216  | Progress animation |
| UI      | ResultFormatter.mjs      | ~88   | Output formatting |
| UI      | MarkdownRenderer.mjs     | ~153  | Terminal markdown |
| UI      | HelpPrinter.mjs          | ~98   | Help screens |
| UI      | TestResultFormatter.mjs  | ~182  | Test output |
| Schema  | skillSchemas.mjs         | ~654  | Validation & templates |
| Lib     | testDiscovery.mjs        | ~317  | Test discovery & runner |

## Summary

The skill-manager-cli is designed around these core architectural principles:

1. **Separation of Concerns**: Each module has a single, well-defined responsibility
2. **Dual Interface**: Natural language for flexibility, slash commands for speed
3. **Dependency Injection**: Callbacks enable loose coupling and testability
4. **Graceful Degradation**: System works in degraded mode when features unavailable
5. **User Feedback**: Real-time progress indication for all operations
6. **Per-Project Isolation**: History and skills are project-specific
