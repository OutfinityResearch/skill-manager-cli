# Design Spec: src/repl/SlashCommandHandler.mjs

ID: DS(/repl/SlashCommandHandler.mjs)

## Overview

**Role**: Manages slash command definitions, parsing, execution, and provides completions/hints. Acts as the registry and router for deterministic command execution.

**Pattern**: Command pattern with static registry (COMMANDS) and dynamic execution via callbacks.

**Key Collaborators**:
- `REPLSession` - provides executeSkill callback
- `ResultFormatter` - formats skill execution results
- Skills (external) - actual command implementations

## What It Does

SlashCommandHandler provides:

1. **Command Registry**: Static `COMMANDS` object mapping command names to skill configurations
2. **Command Parsing**: Extract command name and arguments from `/command args` input
3. **Command Execution**: Route to appropriate skill or handle special commands
4. **Completions**: Tab-completion suggestions for commands and arguments
5. **Hints**: Context-aware help text as user types

## How It Does It

### Static Command Registry
```javascript
static COMMANDS = {
    'ls': {
        skill: 'list-skills',
        usage: '/ls [all]',
        description: 'List skills (add "all" to include built-in)',
        args: 'optional',
        needsSkillArg: false,
    },
    'read': {
        skill: 'read-skill',
        usage: '/read <skill-name>',
        description: 'Read a skill definition file',
        args: 'required',
        needsSkillArg: true,
    },
    'exec': {
        skill: null,  // Dynamic - uses argument as skill name
        usage: '/exec <skill-name> [input]',
        description: 'Execute any skill directly',
        args: 'required',
        needsSkillArg: true,
    },
    // ... more commands
};
```

### Command Parsing
```javascript
parseSlashCommand(input) {
    const match = input.match(/^\/(\S+)(?:\s+(.*))?$/);
    if (!match) return null;
    return {
        command: match[1].toLowerCase(),
        args: match[2]?.trim() || '',
    };
}
```

### Execution with Special Cases
```javascript
async executeSlashCommand(command, args, options = {}) {
    // Built-in commands handled directly
    if (command === 'help' || command === '?') {
        this.printHelp();
        return { handled: true };
    }

    if (command === 'raw') {
        return { handled: true, toggleMarkdown: true };  // Signal to REPLSession
    }

    if (command === 'quit' || command === 'exit') {
        return { handled: true, exitRepl: true };  // Signal to exit
    }

    // Special handling for /test (picker if no args)
    if (command === 'test') {
        if (!args) {
            return { handled: true, showTestPicker: true };
        }
        // With args, run test-code skill
        const result = await this.executeSkill('test-code', args, options);
        return { handled: true, result: formatSlashResult(result) };
    }

    // Special handling for /exec (dynamic skill)
    if (command === 'exec') {
        const parts = args.split(/\s+/);
        const skillName = parts[0];
        const skillInput = parts.slice(1).join(' ') || skillName;
        const result = await this.executeSkill(skillName, skillInput, options);
        return { handled: true, result: formatSlashResult(result) };
    }

    // Standard command: look up skill and execute
    const cmdDef = SlashCommandHandler.COMMANDS[command];
    if (!cmdDef) {
        return { handled: false, error: `Unknown command: /${command}` };
    }

    if (cmdDef.args === 'required' && !args) {
        return { handled: true, error: `Usage: ${cmdDef.usage}` };
    }

    const result = await this.executeSkill(cmdDef.skill, args || '', options);
    return { handled: true, result: formatSlashResult(result) };
}
```

### Tab Completion
```javascript
getCompletions(line) {
    if (!line.startsWith('/')) {
        return [['help', 'reload', 'list', 'exit'], line];  // Basic commands
    }

    const parsed = this.parseSlashCommand(line);

    // Complete command name
    if (!parsed.args && !line.includes(' ')) {
        const matches = Object.keys(COMMANDS)
            .filter(cmd => cmd.startsWith(parsed.command))
            .map(cmd => `/${cmd}`);
        return [matches, line];
    }

    // Complete arguments (skill names for relevant commands)
    const cmdDef = COMMANDS[parsed.command];
    if (cmdDef && ['read', 'validate', 'generate', 'test'].includes(parsed.command)) {
        const skills = this.getUserSkills();
        const matches = skills
            .map(s => s.shortName || s.name)
            .filter(name => name.toLowerCase().startsWith(parsed.args.toLowerCase()))
            .map(name => `/${parsed.command} ${name}`);
        return [matches, line];
    }

    return [[], line];
}
```

### Context-Aware Hints
```javascript
getInputHint(line) {
    if (!line.startsWith('/')) return null;

    const parsed = this.parseSlashCommand(line);
    const cmdDef = COMMANDS[parsed.command];

    if (!cmdDef) {
        // Check for partial matches
        const partialMatches = Object.keys(COMMANDS)
            .filter(cmd => cmd.startsWith(parsed.command));
        if (partialMatches.length > 0) {
            return `Did you mean: ${partialMatches.map(c => '/' + c).join(', ')}?`;
        }
        return 'Unknown command. Type /help for available commands.';
    }

    // Show usage if args required but not provided
    if (cmdDef.args === 'required' && !parsed.args) {
        return `${cmdDef.description} — ${cmdDef.usage}`;
    }

    return cmdDef.description;
}
```

## Why This Design

### 1. Static Command Registry
**Decision**: Define commands as a static object rather than dynamic registration.

**Rationale**:
- Commands are known at compile time
- Easy to see all available commands in one place
- No runtime registration complexity
- Enables static analysis and documentation generation

### 2. Separation of Definition and Execution
**Decision**: Commands define `skill` name, execution callback handles actual invocation.

**Rationale**:
- Handler doesn't need agent reference
- Same command definition can work with different skill implementations
- Enables testing with mock executeSkill
- Clean separation of concerns

### 3. Return Value Signaling
**Decision**: Return objects with flags like `exitRepl`, `toggleMarkdown`, `showTestPicker`.

**Rationale**:
- Handler doesn't own session state
- REPLSession decides what to do with signals
- Clean contract between handler and session
- Easy to add new signal types

### 4. needsSkillArg Flag
**Decision**: Commands declare if they need a skill argument.

**Rationale**:
- Enables automatic skill picker in InteractivePrompt
- UI can adapt to command requirements
- Reduces errors from missing arguments
- Better UX through anticipation

### 5. Aliases via Multiple Entries
**Decision**: Use multiple COMMANDS entries rather than an aliases array.

**Rationale**:
- `/ls` and `/list` both point to same skill
- Simple key lookup (O(1))
- Each alias can have different usage text
- Easy to understand

## Public API

### Constructor
```javascript
new SlashCommandHandler({
    executeSkill,    // (skillName, input, opts) => Promise
    getUserSkills,   // () => skills[]
    getSkills,       // () => allSkills[]
})
```

### Static Properties
```javascript
SlashCommandHandler.COMMANDS  // Command definitions object
```

### Methods
```javascript
isSlashCommand(input)                            // Returns boolean
parseSlashCommand(input)                         // Returns {command, args} or null
executeSlashCommand(command, args, options)      // Returns {handled, result?, error?, ...signals}
getCompletions(line)                             // Returns [completions[], line]
getInputHint(line)                               // Returns hint string or null
printHelp()                                      // Prints help to console
```

## Command Definition Schema

```javascript
{
    skill: string | null,    // Skill to execute (null = special handling)
    usage: string,           // Usage string for help
    description: string,     // Description for help/hints
    args: 'required' | 'optional',
    needsSkillArg: boolean,  // Triggers skill picker in UI
}
```

## Pseudocode

```javascript
class SlashCommandHandler {
    static COMMANDS = {
        'ls': { skill: 'list-skills', args: 'optional', needsSkillArg: false },
        'read': { skill: 'read-skill', args: 'required', needsSkillArg: true },
        'exec': { skill: null, args: 'required', needsSkillArg: true },
        // ...
    };

    constructor({ executeSkill, getUserSkills, getSkills }) {
        this.executeSkill = executeSkill;
        this.getUserSkills = getUserSkills;
        this.getSkills = getSkills;
    }

    async executeSlashCommand(command, args, options) {
        // Handle built-in commands
        if (command === 'help') {
            this.printHelp();
            return { handled: true };
        }
        if (command === 'quit') {
            return { handled: true, exitRepl: true };
        }

        // Handle special commands
        if (command === 'test' && !args) {
            return { handled: true, showTestPicker: true };
        }
        if (command === 'exec') {
            return await executeDynamicSkill(args);
        }

        // Standard command
        cmdDef = COMMANDS[command];
        if (!cmdDef) return { handled: false, error: 'Unknown command' };
        if (cmdDef.args === 'required' && !args) {
            return { handled: true, error: `Usage: ${cmdDef.usage}` };
        }

        result = await this.executeSkill(cmdDef.skill, args, options);
        return { handled: true, result: formatSlashResult(result) };
    }
}
```

## Notes/Constraints

- Command names are case-insensitive (lowercased during parsing)
- `/help` and `/?` are handled identically
- `/exec` is the only command with dynamic skill mapping
- `/test` and `/run-tests` show pickers when called without args
- Completions return full command strings (e.g., `/read equipment`)
- Hints update as user types for immediate feedback
