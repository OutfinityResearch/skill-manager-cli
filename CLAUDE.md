# Skill Manager CLI - Architecture Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Core Components](#core-components)
4. [Dependency Architecture](#dependency-architecture)
5. [Design Decisions & Rationale](#design-decisions--rationale)
6. [Skill System](#skill-system)
7. [Data Flow](#data-flow)
8. [Module Reference](#module-reference)

---

## Overview

The **skill-manager-cli** is a command-line interface for managing, generating, and testing skill definition files in `.AchillesSkills` directories. It provides both an interactive REPL mode and single-shot command execution, powered by LLM-based natural language understanding.

### Key Capabilities

- **Skill CRUD Operations**: Create, read, update, and delete skill definition files
- **Schema Validation**: Validate skill files against their type schemas
- **Code Generation**: Generate executable `.mjs` code from skill definitions
- **Iterative Refinement**: Auto-improve skills until tests pass
- **Interactive REPL**: Natural language interface with command history
- **Dual Interface**: Both slash commands and natural language processing

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              SKILL MANAGER CLI                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                           Entry Point (index.mjs)                         │   │
│  │  • CLI argument parsing                                                   │   │
│  │  • Single-shot vs REPL mode detection                                     │   │
│  │  • Logger configuration                                                   │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                       │                                          │
│                                       ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                        SkillManagerCli (Core)                             │   │
│  │  ┌─────────────────────────────────────────────────────────────────────┐ │   │
│  │  │ • RecursiveSkilledAgent (from achilles-agent-lib)                   │ │   │
│  │  │ • LLMAgent (LLM invocation)                                         │ │   │
│  │  │ • HistoryManager (command persistence)                              │ │   │
│  │  │ • SlashCommandHandler (direct commands)                             │ │   │
│  │  │ • ActionReporter (real-time feedback)                               │ │   │
│  │  └─────────────────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                      │                                    │                      │
│          ┌───────────┴───────────┐              ┌─────────┴─────────┐           │
│          ▼                       ▼              ▼                   ▼           │
│  ┌──────────────┐    ┌────────────────┐   ┌──────────┐    ┌──────────────────┐ │
│  │ REPLSession  │    │SlashCommand    │   │Result    │    │CommandSelector   │ │
│  │              │    │Handler         │   │Formatter │    │                  │ │
│  │ • Input loop │    │ • /ls, /read   │   │ • Output │    │ • Arrow nav      │ │
│  │ • History    │    │ • /write, etc  │   │   format │    │ • Filtering      │ │
│  │ • ESC cancel │    │ • Skill exec   │   │ • Summary│    │ • Skill picker   │ │
│  └──────────────┘    └────────────────┘   └──────────┘    └──────────────────┘ │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          ACHILLES-AGENT-LIB (Dependency)                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────┐     │
│  │                     RecursiveSkilledAgent                              │     │
│  │  • Skill discovery from .AchillesSkills directories                    │     │
│  │  • Skill catalog management                                            │     │
│  │  • Subsystem routing                                                   │     │
│  │  • Prompt execution                                                    │     │
│  └────────────────────────────────────────────────────────────────────────┘     │
│                                       │                                          │
│              ┌────────────────────────┼────────────────────────┐                │
│              ▼                        ▼                        ▼                │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────────┐       │
│  │ LLMAgent          │  │ Skill Subsystems  │  │ Utils                 │       │
│  │ • Model invocation│  │ • CodeSkills      │  │ • ActionReporter      │       │
│  │ • Multi-provider  │  │ • Orchestrator    │  │ • DebugLogger         │       │
│  │ • Fast/Deep modes │  │ • Interactive     │  │ • Sanitiser           │       │
│  └───────────────────┘  │ • DBTable         │  │ • FlexSearch          │       │
│                         │ • MCP             │  └───────────────────────┘       │
│                         └───────────────────┘                                   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          BUILT-IN SKILLS (.AchillesSkills)                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                  │
│  │  skill-manager  │  │  list-skills    │  │  read-skill     │                  │
│  │  (Orchestrator) │  │  (Code Skill)   │  │  (Code Skill)   │                  │
│  │                 │  │                 │  │                 │                  │
│  │  Routes all     │  │  Lists catalog  │  │  Reads .md      │                  │
│  │  user requests  │  │  entries        │  │  definitions    │                  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                  │
│                                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                  │
│  │  write-skill    │  │  validate-skill │  │  generate-code  │                  │
│  │  (Code Skill)   │  │  (Code Skill)   │  │  (Code Skill)   │                  │
│  │                 │  │                 │  │                 │                  │
│  │  Creates/updates│  │  Schema checks  │  │  .md → .mjs     │                  │
│  │  skill files    │  │                 │  │  conversion     │                  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                  │
│                                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                  │
│  │  skill-refiner  │  │  test-code      │  │  execute-skill  │                  │
│  │  (Orchestrator) │  │  (Code Skill)   │  │  (Code Skill)   │                  │
│  │                 │  │                 │  │                 │                  │
│  │  Iterative      │  │  Runs tests     │  │  Direct skill   │                  │
│  │  improvement    │  │  in sandbox     │  │  invocation     │                  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. Entry Point (`src/index.mjs`)

The main CLI entry point that initializes `RecursiveSkilledAgent` directly.

**Responsibilities:**
- Parse command-line arguments
- Initialize `RecursiveSkilledAgent` with `additionalSkillRoots` for built-in skills
- Create `REPLSession` for interactive mode
- Handle single-shot command execution

**Key Design Decision:**
> The CLI uses `RecursiveSkilledAgent` directly (no wrapper class) with `additionalSkillRoots` to register built-in skills. This reduces abstraction layers while still supporting multi-source skill discovery. The `REPLSession` owns all REPL-specific concerns (history, formatting, UI).

### 2. REPLSession (`src/REPLSession.mjs`)

Manages the interactive command-line session. Takes a `RecursiveSkilledAgent` and options.

**Constructor signature:**
```javascript
new REPLSession(agent, {
  workingDir,      // Working directory path
  skillsDir,       // Skills directory path
  builtInSkillsDir, // For filtering user skills
  historyManager,   // Optional, created if not provided
  debug,           // Enable debug mode
})
```

**Responsibilities:**
- Handle raw terminal input with custom key handling
- Provide command history navigation (↑/↓ arrows)
- Show interactive command/skill selectors ("/" triggers)
- Support ESC key for operation cancellation
- Manage spinner animations during LLM calls
- Own `HistoryManager` instance
- Build context object for skill execution
- Process prompts through skill-manager orchestrator

**Key Design Decision:**
> Raw terminal mode (`stdin.setRawMode(true)`) is used instead of standard readline for precise control over key handling. This enables features like the "/" command picker, real-time hints, and ESC cancellation that wouldn't be possible with buffered input. REPLSession owns its dependencies (HistoryManager, context) rather than receiving them from a wrapper.

### 3. SlashCommandHandler (`src/SlashCommandHandler.mjs`)

Maps slash commands to skill executions.

**Responsibilities:**
- Define slash command → skill mappings
- Parse command syntax (`/command <args>`)
- Provide tab completion and hints
- Execute skills directly (bypassing orchestrator)

**Key Design Decision:**
> Slash commands provide deterministic, fast access to specific skills without LLM interpretation. This dual-interface approach (slash commands + natural language) gives users control when they know exactly what they want, while still supporting flexible natural language when exploring.

### 4. CommandSelector (`src/CommandSelector.mjs`)

Interactive picker for commands and skills.

**Responsibilities:**
- Render filterable command list
- Handle arrow key navigation
- Support real-time filtering as user types
- Clean terminal output management

**Key Design Decision:**
> The selector uses a scroll-windowed approach (`maxVisible`) rather than showing all options at once. This scales gracefully as the number of skills grows and keeps the UI clean.

### 5. HistoryManager (`src/HistoryManager.mjs`)

Persists command history per project.

**Responsibilities:**
- Store history in `.skill-manager-history` per working directory
- Provide navigation and search APIs
- Auto-trim to max entries

**Key Design Decision:**
> Per-directory history (stored in `.skill-manager-history` within each project) rather than global history. This provides context-relevant suggestions and keeps different project histories isolated.

### 6. ResultFormatter (`src/ResultFormatter.mjs`)

Transforms raw execution results for display.

**Responsibilities:**
- Summarize orchestrator execution results
- Extract meaningful output from nested result structures
- Format for human readability in non-debug mode

**Key Design Decision:**
> Stateless utility functions extracted from the main CLI class. This follows the principle of separating concerns: the CLI handles orchestration, the formatter handles presentation.

### 7. Spinner (`src/spinner.mjs`)

Animated progress indicator.

**Responsibilities:**
- Show elapsed time during operations
- Support pause/resume for user input prompts
- Display optional interrupt hints
- Multiple visual styles (dots, line, clock, etc.)

**Key Design Decision:**
> The spinner writes to `stderr` by default, keeping `stdout` clean for actual command output. This enables proper piping and redirection of results.

### 8. skillSchemas (`src/skillSchemas.mjs`)

Schema definitions and validation.

**Responsibilities:**
- Define required/optional sections for each skill type
- Provide templates for new skills
- Detect skill type from file content
- Validate skill files against schemas
- Load and format skill specification files (`.specs.md`)

**Key Design Decision:**
> Skill type detection uses content-based heuristics (checking for specific section headers) rather than relying on file names alone. This is more robust when files are renamed or copied.

**Utility Functions:**
- `loadSpecsContent(skillDir)` - Lazily loads `.specs.md` from a skill directory
- `buildSpecsContext(specsContent)` - Formats specs for inclusion in LLM prompts

---

## Dependency Architecture

### achilles-agent-lib

The `skill-manager-cli` depends on `achilles-agent-lib` (linked locally via `file:../AchillesAgentLib`) for its core agent functionality.

```
achilles-agent-lib/
├── LLMAgents/
│   ├── LLMAgent.mjs           # LLM invocation with multi-provider support
│   ├── LLMAgentRegistry.mjs   # Agent instance management
│   └── envAutoConfig.mjs      # Auto-configure from environment
│
├── RecursiveSkilledAgents/
│   └── RecursiveSkilledAgent.mjs  # Core skill discovery & execution
│       ├── additionalSkillRoots   # NEW: Register extra skill directories
│       ├── getSkills()            # NEW: Get all registered skills
│       └── reloadSkills()         # NEW: Re-discover and re-register
│
├── *SkillsSubsystem/              # Skill type handlers
│   ├── CodeSkillsSubsystem        # cskill: LLM-generated code
│   ├── OrchestratorSkillsSubsystem # oskill: Skill routing
│   ├── InteractiveSkillsSubsystem  # iskill: Conversational
│   ├── DBTableSkillsSubsystem      # tskill: Database entities
│   ├── MCPSkillsSubsystem          # mskill: MCP protocol
│   └── ClaudeSkillsSubsystem       # Generic skills
│
└── utils/
    ├── ActionReporter.mjs      # Real-time progress feedback
    ├── Sanitiser.mjs           # Name normalization
    └── flexsearchAdapter.mjs   # Full-text search for skills
```

**Key Addition: `additionalSkillRoots`**

The `RecursiveSkilledAgent` now accepts an `additionalSkillRoots` option:

```javascript
new RecursiveSkilledAgent({
  startDir: workingDir,
  additionalSkillRoots: [builtInSkillsDir],  // Extra skill sources
  llmAgent,
})
```

This enables multi-source skill discovery without wrapper classes. The CLI uses this to register built-in skills alongside user skills.

**Why This Dependency Structure?**

> The agent library provides reusable skill infrastructure that can power multiple applications (CLIs, web apps, APIs). By extracting the skill system into a separate library, the CLI remains focused on user interaction while the complex skill orchestration, LLM integration, and subsystem management lives in a shared, testable core.

---

## Design Decisions & Rationale

### 1. Skills as Markdown Files

**Decision:** Skills are defined in Markdown files (`.md`) with structured sections.

**Rationale:**
- Human-readable and editable without special tools
- Version control friendly (diff, merge)
- LLMs understand Markdown natively
- Easy to generate documentation from definitions
- Supports embedded code blocks, examples, and rich formatting

### 2. Skill Type System

**Decision:** Five distinct skill types with different execution models.

| Type | File | Purpose |
|------|------|---------|
| `tskill` | `tskill.md` | Database table entities with validators/presenters |
| `cskill` | `cskill.md` | LLM generates and executes code on-the-fly |
| `iskill` | `iskill.md` | Interactive conversations with user input collection |
| `oskill` | `oskill.md` | Orchestrators that route to other skills |
| `mskill` | `mskill.md` | MCP (Model Context Protocol) tool integration |

**Rationale:**
- Different use cases require different execution models
- Allows specialized handling (code gen for tskill, routing for oskill)
- Clear mental model for skill authors
- Enables type-specific validation and templates

### 3. Two-Layer Skill Discovery

**Decision:** Skills are loaded from two locations:
1. Built-in skills (bundled with the CLI in `src/.AchillesSkills/`)
2. User skills (in the working directory's `.AchillesSkills/`)

**Rationale:**
- Built-in skills provide core functionality (list, read, write, validate)
- User skills extend the system for project-specific needs
- Clear precedence: user skills can override built-in behavior if desired
- Portable: built-in skills ship with the CLI package

### 4. Orchestrator-First Routing

**Decision:** All natural language prompts go through the `skill-manager` orchestrator by default.

**Rationale:**
- Single entry point for intent classification
- Orchestrator has context about available operations
- Can plan multi-step operations (read → modify → validate)
- Provides consistent behavior regardless of input phrasing

### 5. Slash Commands for Determinism

**Decision:** Direct `/command` syntax bypasses LLM interpretation.

**Rationale:**
- Fast execution (no LLM call needed for routing)
- Predictable behavior for scripting
- Power users can work efficiently without waiting
- Tab completion makes commands discoverable

### 6. ESC for Cancellation

**Decision:** ESC key cancels running LLM operations.

**Rationale:**
- Standard terminal convention for cancellation
- AbortController pattern provides clean cancellation
- Users can quickly abort expensive operations
- Spinner updates to show cancellation state

### 7. Action Reporter for Feedback

**Decision:** Real-time status updates via `ActionReporter` pattern.

**Rationale:**
- LLM operations can take seconds; users need feedback
- Stack-based tracking handles nested operations
- Supports different output modes (spinner, log, silent, custom)
- Decoupled from CLI—same reporter works in other contexts

### 8. Per-Project History

**Decision:** Command history stored in `.skill-manager-history` per project.

**Rationale:**
- Different projects have different skill sets
- History suggestions are context-relevant
- Multiple developers on same machine don't share history
- Easy to gitignore if desired

### 9. Native File Operations

**Decision:** File operations (read, write, validate) are implemented as native tools, not LLM-generated code.

**Rationale:**
- Reliability: No risk of LLM hallucinating file paths
- Speed: Direct fs operations, no LLM round-trip
- Security: Controlled file access patterns
- Predictability: Same operation = same behavior

### 10. Code Generation for tskills

**Decision:** LLM generates `.mjs` code from `tskill.md` definitions.

**Rationale:**
- tskill definitions are declarative; code is imperative
- Validators, presenters, resolvers require JavaScript logic
- LLM can interpret natural language validation rules
- Generated code can be tested and refined iteratively

### 11. Skill Refiner Loop

**Decision:** Automated edit → generate → test → fix loop.

**Rationale:**
- Code generation often requires iteration
- Automated loop reduces manual intervention
- LLM can analyze test failures and suggest fixes
- Max iterations prevent infinite loops

### 12. Modular Architecture

**Decision:** Extract components into separate files (REPLSession, SlashCommandHandler, etc.).

**Rationale:**
- Reduces cognitive load when reading code
- Enables independent testing of components
- Follows single responsibility principle
- Makes the codebase navigable for new contributors

### 13. Skill Specifications via `.specs.md`

**Decision:** Optional `.specs.md` files provide additional context for LLM operations on skills.

**Rationale:**
- Separates implementation requirements from skill definition
- Provides constraints without cluttering the main skill file
- Loaded lazily to avoid overhead for skills without specs
- Automatically included in code generation and refinement prompts
- Hidden file (dot prefix) keeps skill directories clean

---

## Skill System

### Built-in Skills

The CLI ships with these built-in skills in `src/.AchillesSkills/`:

| Skill | Type | Purpose |
|-------|------|---------|
| `skill-manager` | oskill | Main orchestrator—routes all user requests |
| `list-skills` | cskill | Lists skills in the catalog |
| `read-skill` | cskill | Reads skill definition content |
| `write-skill` | cskill | Creates/updates skill files |
| `delete-skill` | cskill | Removes skill directories |
| `validate-skill` | cskill | Validates against schema |
| `get-template` | cskill | Returns blank skill templates |
| `update-section` | cskill | Updates specific sections |
| `preview-changes` | cskill | Shows diff before applying |
| `generate-code` | cskill | Generates `.mjs` from definitions |
| `test-code` | cskill | Tests generated code |
| `skill-refiner` | oskill | Iterative improvement loop |
| `execute-skill` | cskill | Executes any skill directly |

### Skill Specifications (`.specs.md`)

Skills can optionally include a `.specs.md` file that defines requirements and constraints for the skill. When present, this file is automatically included in LLM context during:
- Code generation (`generate-code`)
- Skill refinement (`skill-refiner`)
- Skill reading (`read-skill` displays specs alongside the skill definition)

**Example `.specs.md`:**
```markdown
# Specifications for MySkill

## Requirements
- All generated code must use arrow functions
- Error messages must be in JSON format
- Maximum response length: 500 characters

## Constraints
- Must handle null/undefined inputs gracefully
- Must include JSDoc comments for all exports
```

**How it works:**
1. Specs are loaded lazily when a skill is modified (not at registration)
2. `loadSpecsContent(skillDir)` reads the file if present
3. `buildSpecsContext(specsContent)` formats it for LLM prompts
4. Prompt builders include specs alongside skill definitions
5. Skills without specs work unchanged (null handling)

### Skill Discovery Process

```
1. RecursiveSkilledAgent constructor called
       │
       ▼
2. findAchillesSkillRoots() scans directories
   • Searches upward from startDir by default
   • Finds all .AchillesSkills directories
       │
       ▼
3. registerSkillsFromRoot() for each root
   • Iterates subdirectories
   • Looks for recognized skill files (tskill.md, cskill.md, etc.)
       │
       ▼
4. parseSkillDocument() extracts metadata
   • Title, summary, sections
   • Builds searchable text for routing
       │
       ▼
5. ensureSubsystem() creates appropriate handler
   • CodeSkillsSubsystem for cskill
   • OrchestratorSkillsSubsystem for oskill
   • etc.
       │
       ▼
6. Skills registered in:
   • skillCatalog (canonical name → record)
   • skillAliases (all aliases → record)
   • skillToSubsystem (name → subsystem type)
```

---

## Data Flow

### Natural Language Prompt Flow

```
User types: "list all skills"
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ REPLSession._processNaturalLanguage()                       │
│ • Creates ActionReporter (spinner mode)                     │
│ • Sets up ESC cancellation handler                          │
│ • Calls cli.processPrompt()                                 │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ SkillManagerCli.processPrompt()                             │
│ • Delegates to skilledAgent.executePrompt()                 │
│ • skillName defaults to 'skill-manager'                     │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ RecursiveSkilledAgent.executeWithReviewMode()               │
│ • Looks up skill-manager in catalog                         │
│ • Gets OrchestratorSkillsSubsystem                          │
│ • Calls subsystem.executeSkillPrompt()                      │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ OrchestratorSkillsSubsystem                                 │
│ • Reads skill-manager oskill.md                             │
│ • Sends prompt + instructions to LLM                        │
│ • LLM returns plan: [{skill: "list-skills", input: ""}]     │
│ • Executes each step via recursiveAgent                     │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ list-skills (cskill)                                        │
│ • CodeSkillsSubsystem executes                              │
│ • Returns formatted skill list                              │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ Result bubbles back up                                      │
│ • Orchestrator collects execution results                   │
│ • summarizeResult() formats for display                     │
│ • REPLSession prints to terminal                            │
└─────────────────────────────────────────────────────────────┘
```

### Slash Command Flow

```
User types: "/read my-skill"
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ REPLSession detects "/" prefix                              │
│ • slashHandler.isSlashCommand() returns true                │
│ • slashHandler.parseSlashCommand() extracts {command, args} │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ SlashCommandHandler.executeSlashCommand()                   │
│ • Looks up "read" in COMMANDS map                           │
│ • Gets skill: "read-skill"                                  │
│ • Calls executeSkill("read-skill", "my-skill", options)     │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ SkillManagerCli.executeSkill()                              │
│ • Direct execution (no orchestrator)                        │
│ • skilledAgent.executePrompt() with skillName specified     │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ CodeSkillsSubsystem executes read-skill                     │
│ • Reads skill file content                                  │
│ • Returns formatted result                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Module Reference

| Module | Lines | Purpose |
|--------|-------|---------|
| `index.mjs` | ~200 | CLI entry point, argument parsing, mode detection |
| `SkillManagerCli.mjs` | ~310 | Core orchestration, agent initialization |
| `REPLSession.mjs` | ~830 | Interactive session, input handling |
| `SlashCommandHandler.mjs` | ~390 | Slash command definitions and execution |
| `CommandSelector.mjs` | ~460 | Interactive command/skill picker |
| `HistoryManager.mjs` | ~210 | Command history persistence |
| `ResultFormatter.mjs` | ~90 | Output formatting utilities |
| `HelpPrinter.mjs` | ~100 | Help screen rendering |
| `spinner.mjs` | ~220 | Animated progress indicator |
| `skillSchemas.mjs` | ~520 | Schema definitions, validation, and specs utilities |

---

## Summary

The skill-manager-cli is designed around these core principles:

1. **Separation of Concerns**: CLI handles interaction, agent library handles skill execution
2. **Dual Interface**: Natural language for flexibility, slash commands for speed
3. **Extensibility**: User skills extend built-in capabilities
4. **Transparency**: Real-time feedback shows what's happening
5. **Reliability**: Native file ops, schema validation, iterative refinement

The architecture enables a powerful skill management system while keeping the CLI codebase focused and maintainable.
