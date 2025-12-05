# Design Spec: src/repl/REPLSession.mjs

ID: DS(/repl/REPLSession.mjs)

## Overview

**Role**: Central coordinator for the interactive REPL session. Manages the main loop, delegates to specialized handlers, and provides session-level state.

**Pattern**: Coordinator/Facade pattern - delegates to specialized sub-modules while providing a unified interface.

**Key Collaborators**:
- `InteractivePrompt` - input capture with selectors
- `QuickCommands` - non-LLM command handling
- `NaturalLanguageProcessor` - LLM-based processing
- `SlashCommandHandler` - slash command routing
- `HistoryManager` - command history persistence
- `RecursiveSkilledAgent` - skill execution (external)

## What It Does

REPLSession orchestrates the interactive CLI experience by:

1. Initializing all sub-modules with appropriate callbacks
2. Running the main input-process-output loop
3. Routing input to the appropriate handler (quick, slash, or natural language)
4. Managing session state (markdown toggle, context object)
5. Handling special cases like test picker UI

## How It Does It

### Constructor - Dependency Assembly
```javascript
constructor(agent, options = {}) {
    // Configuration from options
    this.workingDir = options.workingDir || agent.startDir;
    this.skillsDir = options.skillsDir || path.join(this.workingDir, '.AchillesSkills');

    // Create shared context for skill execution
    this.context = {
        workingDir: this.workingDir,
        skillsDir: this.skillsDir,
        skilledAgent: agent,
        llmAgent: agent.llmAgent,
        logger: agent.logger,
    };

    // Initialize sub-modules with callbacks
    this.slashHandler = new SlashCommandHandler({
        executeSkill: (skillName, input, opts) => this._executeSkill(skillName, input, opts),
        getUserSkills: () => this.getUserSkills(),
        getSkills: () => agent.getSkills(),
    });

    this.inputPrompt = new InteractivePrompt({
        historyManager: this.historyManager,
        slashHandler: this.slashHandler,
        commandList: this.commandList,
        getUserSkills: () => this.getUserSkills(),
    });

    this.quickCommands = new QuickCommands({
        getUserSkills: () => this.getUserSkills(),
        getAllSkills: () => agent.getSkills(),
        reloadSkills: () => this.reloadSkills(),
        historyManager: this.historyManager,
    });

    this.nlProcessor = new NaturalLanguageProcessor({
        agent: this.agent,
        processPrompt: (input, opts) => this.processPrompt(input, opts),
        historyManager: this.historyManager,
        isMarkdownEnabled: () => this.markdownEnabled,
    });
}
```

### Main Loop - Input Routing
```javascript
async start() {
    this._showBanner();

    while (true) {
        const input = (await this.inputPrompt.prompt()).trim();

        if (!input) continue;

        // Exit commands
        if (['exit', 'quit', 'q'].includes(input.toLowerCase())) {
            console.log('\nGoodbye!\n');
            break;
        }

        // Route to appropriate handler
        if (this.quickCommands.isQuickCommand(input)) {
            this.quickCommands.execute(input);
            continue;
        }

        if (this.slashHandler.isSlashCommand(input)) {
            const shouldExit = await this._handleSlashCommand(input);
            if (shouldExit) break;
            continue;
        }

        // Default: natural language processing
        await this.nlProcessor.process(input);
    }
}
```

### Slash Command Handling with Special Cases
```javascript
async _handleSlashCommand(input) {
    const parsed = this.slashHandler.parseSlashCommand(input);
    const spinner = createSpinner(`Running /${parsed.command}...`);

    const result = await this.slashHandler.executeSlashCommand(parsed.command, parsed.args, {
        context: this.context,
    });

    if (result.handled) {
        if (result.exitRepl) {
            spinner.stop();
            return true;  // Signal to exit
        }
        if (result.toggleMarkdown) {
            this.markdownEnabled = !this.markdownEnabled;
            spinner.succeed(`Markdown rendering ${this.markdownEnabled ? 'enabled' : 'disabled'}`);
        }
        if (result.showTestPicker) {
            spinner.stop();
            await this._handleTestPicker();  // Interactive test selection
        }
        // ... handle other special results
    }

    return false;
}
```

### User Skills Filtering
```javascript
getUserSkills() {
    const skills = this.agent.getSkills();
    if (!this.builtInSkillsDir) {
        return skills;
    }
    // Exclude built-in skills by path prefix
    return skills.filter(s => !s.skillDir?.startsWith(this.builtInSkillsDir));
}
```

## Why This Design

### 1. Coordinator Pattern
**Decision**: REPLSession acts as a coordinator, delegating to specialized handlers.

**Rationale**:
- Single point of control for the REPL
- Sub-modules can be tested independently
- Clear separation of concerns
- Easy to add new input types (just add a handler)

### 2. Callback-Based Sub-Module Initialization
**Decision**: Pass callbacks to sub-modules rather than passing `this`.

**Rationale**:
- Sub-modules don't depend on REPLSession internals
- Callbacks define the contract explicitly
- Easier to mock in tests
- Avoids circular dependencies

### 3. Context Object
**Decision**: Create a shared context object passed to all skill executions.

**Rationale**:
- Skills need various pieces of context
- Single object is easier to extend
- Consistent with achilles-agent-lib patterns
- Avoids long parameter lists

### 4. Built-in Skills Filtering
**Decision**: Filter skills by checking if `skillDir` starts with `builtInSkillsDir`.

**Rationale**:
- User skills appear in `/ls` without built-ins
- `/ls all` shows everything
- Path-based filtering is simple and reliable
- Works regardless of skill naming

### 5. Special Result Handling
**Decision**: SlashCommandHandler returns special flags (exitRepl, toggleMarkdown, showTestPicker).

**Rationale**:
- REPLSession owns session state (markdownEnabled)
- REPLSession owns interactive pickers
- Handler doesn't need to know about UI specifics
- Clean separation between routing and state management

## Public API

### Constructor
```javascript
new REPLSession(agent, {
    workingDir,       // Working directory path
    skillsDir,        // Skills directory path
    builtInSkillsDir, // For filtering user skills
    historyManager,   // Optional, created if not provided
    debug,            // Enable debug mode
    renderMarkdown,   // Initial markdown state
})
```

### Methods
```javascript
async start()                    // Start the REPL loop
processPrompt(input, opts)       // Execute prompt through orchestrator
getUserSkills()                  // Get skills excluding built-ins
reloadSkills()                   // Reload skills from disk
```

## Pseudocode

```javascript
class REPLSession {
    constructor(agent, options) {
        // Store agent and options
        // Create context object
        // Initialize HistoryManager
        // Initialize SlashCommandHandler with callbacks
        // Initialize InteractivePrompt with callbacks
        // Initialize QuickCommands with callbacks
        // Initialize NaturalLanguageProcessor with callbacks
    }

    async start() {
        showBanner();

        while (true) {
            input = await inputPrompt.prompt();

            if (isExitCommand(input)) break;

            if (quickCommands.isQuickCommand(input)) {
                quickCommands.execute(input);
            } else if (slashHandler.isSlashCommand(input)) {
                handled = await handleSlashCommand(input);
                if (handled.exit) break;
            } else {
                await nlProcessor.process(input);
            }
        }
    }

    async _handleSlashCommand(input) {
        result = await slashHandler.executeSlashCommand(input);

        if (result.exitRepl) return true;
        if (result.toggleMarkdown) toggleMarkdown();
        if (result.showTestPicker) await showTestPicker();
        // ... handle result

        return false;
    }

    processPrompt(input, opts) {
        // Execute through skills-orchestrator
        return agent.executePrompt(input, {
            skillName: opts.skillName || 'skills-orchestrator',
            context: this.context,
            ...opts,
        });
    }
}
```

## Notes/Constraints

- Banner shows LLM model info from agent's invoker strategy
- Markdown toggle is session-level state
- Test pickers use interactive UI (showTestSelector)
- History is saved only for successful commands
- Empty input is ignored (continues loop)
- Exit commands are case-insensitive
