# Design Spec: src/index.mjs

ID: DS(/entry/index.mjs)

## Overview

**Role**: Main CLI entry point that initializes the RecursiveSkilledAgent directly and provides both single-shot and REPL execution modes.

**Pattern**: CLI entry point with dual-mode detection (REPL vs single-shot), re-exports for library usage.

**Key Collaborators**:
- `RecursiveSkilledAgent` (external - achilles-agent-lib)
- `LLMAgent` (external - achilles-agent-lib)
- `REPLSession` (internal - manages interactive mode)
- `ResultFormatter` (internal - formats output)

## What It Does

The index.mjs file serves three primary functions:

1. **CLI Entry Point**: Parses command-line arguments and determines execution mode
2. **Library Exports**: Re-exports all public classes and functions for programmatic use
3. **Agent Initialization**: Creates and configures the RecursiveSkilledAgent with built-in skills

## How It Does It

### Argument Parsing
```javascript
for (let i = 0; i < args.length; i++) {
    if (arg === '--dir' || arg === '-d') {
        workingDir = path.resolve(args[i + 1]);
        i += 1;
    } else if (!arg.startsWith('-')) {
        prompt = args.slice(i).join(' ');  // Collect remaining as prompt
        break;
    }
    // ... other flags
}
```
- Manual argument parsing (no external dependency)
- Remaining non-flag args become the prompt
- Flags: `--dir`, `--verbose`, `--debug`, `--fast`, `--deep`, `--no-markdown`, `--version`

### Mode Detection
```javascript
if (prompt) {
    // Single-shot mode: execute prompt and exit
    const result = await agent.executePrompt(prompt, {
        skillName: 'skills-orchestrator',
        context,
        mode,
    });
    console.log(result);
} else {
    // REPL mode
    const session = new REPLSession(agent, options);
    await session.start();
}
```
- Presence of prompt argument determines mode
- Single-shot executes immediately and exits
- No prompt starts interactive REPL

### Built-in Skills Registration
```javascript
const builtInSkillsDir = path.join(__dirname, '.AchillesSkills');

const agent = new RecursiveSkilledAgent({
    llmAgent,
    startDir: workingDir,
    additionalSkillRoots: [builtInSkillsDir],  // Key: registers built-in skills
    logger,
});
```
- Built-in skills live in `src/.AchillesSkills/`
- `additionalSkillRoots` option registers them alongside user skills
- User skills in `workingDir/.AchillesSkills/` can override built-ins

### Cross-Platform Direct Execution Check
```javascript
function isRunDirectly() {
    try {
        const scriptPath = realpathSync(process.argv[1]);
        const modulePath = realpathSync(fileURLToPath(import.meta.url));
        return scriptPath === modulePath;
    } catch {
        return import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
    }
}
```
- Uses `realpathSync` to resolve symlinks (npm link scenario)
- Fallback for edge cases compares URL endings
- Prevents main() from running on import

## Why This Design

### 1. Re-exports Pattern
**Decision**: Re-export all public classes and utilities from index.mjs.

**Rationale**:
- Single import point for library consumers
- Enables `import { REPLSession, HistoryManager } from 'skill-manager-cli'`
- Cleaner than requiring users to know internal paths
- Forward compatibility - internal reorganization doesn't break imports

### 2. Manual Argument Parsing
**Decision**: Parse arguments manually without a library like `commander` or `yargs`.

**Rationale**:
- Zero external dependencies for CLI functionality
- Simple flag set doesn't justify library overhead
- Full control over parsing behavior
- Remaining-args-as-prompt pattern is non-standard

### 3. Direct Agent Initialization
**Decision**: Create `RecursiveSkilledAgent` directly in index.mjs rather than through a wrapper class.

**Rationale**:
- Reduces abstraction layers
- `additionalSkillRoots` provides multi-source skill discovery
- Agent is passed to REPLSession which owns REPL concerns
- Previous `SkillManagerCli` wrapper was eliminated as unnecessary

### 4. Shared Context Object
**Decision**: Create a context object passed to all skill executions.

**Rationale**:
- Skills need access to workingDir, skillsDir, agent, logger
- Single object is easier to extend than multiple parameters
- Consistent interface across all skill types
- Context object is the standard pattern in achilles-agent-lib

### 5. Configurable Logger
**Decision**: Create a simple logger object based on `--verbose` flag.

**Rationale**:
- Avoids global console pollution
- Skills can use `logger.log()` without checking verbose mode
- Warnings and errors always display
- Easy to replace with structured logging if needed

## Public API

### Exports
```javascript
export {
    // Core agent (from achilles-agent-lib)
    RecursiveSkilledAgent,
    LLMAgent,
    // REPL components
    REPLSession,
    SlashCommandHandler,
    // UI components
    CommandSelector,
    showCommandSelector,
    showSkillSelector,
    buildCommandList,
    // History
    HistoryManager,
    // Utilities
    summarizeResult,
    formatSlashResult,
    printREPLHelp,
    showHistory,
    searchHistory,
    // Constants
    builtInSkillsDir,
};
```

### CLI Usage
```
skill-manager [options] [prompt]

Options:
  -d, --dir <path>   Working directory (default: cwd)
  -v, --verbose      Enable verbose logging
  --debug            Show full JSON output
  --fast             Use fast LLM mode
  --deep             Use deep LLM mode (default)
  --no-markdown      Disable markdown rendering
  -h, --help         Show help
  --version          Show version
```

## Pseudocode

```javascript
// Entry point
async function main() {
    // 1. Parse arguments
    args = parseArgs(process.argv);

    // 2. Ensure skills directory exists
    ensureDir(path.join(workingDir, '.AchillesSkills'));

    // 3. Initialize LLM agent
    llmAgent = new LLMAgent({ name: 'skill-manager-agent' });

    // 4. Initialize RecursiveSkilledAgent with built-in skills
    agent = new RecursiveSkilledAgent({
        llmAgent,
        startDir: workingDir,
        additionalSkillRoots: [builtInSkillsDir],
    });

    // 5. Execute based on mode
    if (args.prompt) {
        // Single-shot: execute and exit
        result = await agent.executePrompt(args.prompt, {
            skillName: 'skills-orchestrator',
            context: buildContext(),
        });
        print(formatResult(result));
    } else {
        // REPL: start interactive session
        session = new REPLSession(agent, options);
        await session.start();
    }
}

// Run if executed directly
if (isRunDirectly()) {
    main().catch(handleFatalError);
}
```

## Notes/Constraints

- Must create `.AchillesSkills` directory if not present
- `builtInSkillsDir` is derived from `__dirname` (ESM modules)
- Single-shot mode uses `skills-orchestrator` skill by default
- Version is hardcoded (consider reading from package.json)
- Exit code 1 on errors, 0 on success
