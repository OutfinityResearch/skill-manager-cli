# Design Specifications

This folder contains detailed design specifications for each module in the skill-manager-cli codebase. Each specification documents:

- **What** the module does
- **How** it accomplishes its tasks
- **Why** particular design decisions were made

## Quick Navigation

### Global Architecture
- [global_architecture.md](./global_architecture.md) - System-wide architecture, data flow, and design principles

### Entry Point
- [entry/index.mjs.md](./entry/index.mjs.md) - CLI entry point and library exports

### REPL Layer
| File | Description |
|------|-------------|
| [repl/REPLSession.mjs.md](./repl/REPLSession.mjs.md) | Central coordinator for interactive sessions |
| [repl/InteractivePrompt.mjs.md](./repl/InteractivePrompt.mjs.md) | Input capture with command/skill selectors |
| [repl/SlashCommandHandler.mjs.md](./repl/SlashCommandHandler.mjs.md) | Slash command routing and execution |
| [repl/QuickCommands.mjs.md](./repl/QuickCommands.mjs.md) | Non-LLM instant commands |
| [repl/NaturalLanguageProcessor.mjs.md](./repl/NaturalLanguageProcessor.mjs.md) | LLM processing with abort capability |
| [repl/HistoryManager.mjs.md](./repl/HistoryManager.mjs.md) | Persistent command history |

### UI Layer
| File | Description |
|------|-------------|
| [ui/CommandSelector.mjs.md](./ui/CommandSelector.mjs.md) | Interactive pickers for commands/skills/tests |
| [ui/LineEditor.mjs.md](./ui/LineEditor.mjs.md) | Line editing with cursor navigation |
| [ui/spinner.mjs.md](./ui/spinner.mjs.md) | Animated progress indicators |
| [ui/ResultFormatter.mjs.md](./ui/ResultFormatter.mjs.md) | Skill result formatting |
| [ui/MarkdownRenderer.mjs.md](./ui/MarkdownRenderer.mjs.md) | Terminal markdown rendering |
| [ui/HelpPrinter.mjs.md](./ui/HelpPrinter.mjs.md) | Help screens and history display |
| [ui/TestResultFormatter.mjs.md](./ui/TestResultFormatter.mjs.md) | Test result formatting |

### Schema Layer
| File | Description |
|------|-------------|
| [schemas/skillSchemas.mjs.md](./schemas/skillSchemas.mjs.md) | Skill type definitions and validation |

### Library Layer
| File | Description |
|------|-------------|
| [lib/testDiscovery.mjs.md](./lib/testDiscovery.mjs.md) | Test discovery and execution |

## Document Format

Each specification follows a consistent structure:

```markdown
# Design Spec: src/path/to/file.mjs

ID: DS(/path/file.mjs)

## Overview
- **Role**: High-level purpose
- **Pattern**: Design patterns used
- **Key Collaborators**: Dependencies and consumers

## What It Does
Functional description of capabilities

## How It Does It
Implementation details with code snippets

## Why This Design
Numbered design decisions with rationale

## Public API
Exported classes, functions, and interfaces

## Pseudocode
Simplified algorithm representation

## Notes/Constraints
Additional considerations and limitations
```

## Key Design Principles

1. **Separation of Concerns**: Each module has a single, well-defined responsibility
2. **Callback-Based DI**: Modules receive callbacks rather than direct object references
3. **Raw Terminal Control**: Custom ANSI handling for interactive features
4. **Zero Dependencies**: UI components use native terminal capabilities
5. **Graceful Degradation**: Features work in degraded mode when unavailable

## Architecture Layers

```
┌──────────────────────────────────────┐
│           Entry (index.mjs)          │  CLI entry, exports
├──────────────────────────────────────┤
│              REPL Layer              │  Session, prompts, commands
├──────────────────────────────────────┤
│               UI Layer               │  Pickers, spinners, formatters
├──────────────────────────────────────┤
│            Support Layer             │  Schemas, test discovery
├──────────────────────────────────────┤
│       achilles-agent-lib (ext)       │  Agent, LLM, skill execution
└──────────────────────────────────────┘
```

## Using These Specs

### For Understanding Code
Start with `global_architecture.md` for the big picture, then dive into specific module specs as needed.

### For Making Changes
Review the "Why This Design" section to understand constraints before modifying code.

### For Adding Features
Check collaborators and public API sections to understand integration points.

### For Debugging
The "How It Does It" sections contain implementation details that help trace execution flow.
