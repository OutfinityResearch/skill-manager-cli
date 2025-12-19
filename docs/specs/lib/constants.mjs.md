# Design Spec: src/lib/constants.mjs

ID: DS(/lib/constants.mjs)

## Overview

**Role**: Centralized constants registry providing single source of truth for skill names, timeouts, configuration values, and error codes throughout skill-manager-cli.

**Pattern**: Module-level constants with grouped exports. No classes or state - pure constant definitions with utility functions for lookups.

**Key Collaborators**:
- `SlashCommandHandler` - uses BUILT_IN_SKILLS for command mapping
- `REPLSession` - uses TIMEOUTS and DEFAULTS
- All error handling - uses ERROR_CODES
- Configuration systems - uses CONFIG_VERSION

## What It Does

constants.mjs provides:

1. **BUILT_IN_SKILLS**: Registry of all built-in skill names
2. **TIMEOUTS**: Standard timeout values in milliseconds
3. **CONFIG_VERSION**: Configuration file schema version
4. **DEFAULTS**: Default configuration values
5. **ERROR_CODES**: Typed error codes for programmatic handling
6. **Utility functions**: Lookups and checks against constants

## How It Does It

### Built-in Skills Registry
```javascript
export const BUILT_IN_SKILLS = {
    // Core CRUD operations
    LIST: 'list-skills',
    READ: 'read-skill',
    WRITE: 'write-skill',
    DELETE: 'delete-skill',

    // Validation and templates
    VALIDATE: 'validate-skill',
    GET_TEMPLATE: 'get-template',
    PREVIEW: 'preview-changes',
    UPDATE_SECTION: 'update-section',

    // Code generation and testing
    GENERATE_CODE: 'generate-code',
    TEST_CODE: 'test-code',
    RUN_TESTS: 'run-tests',
    WRITE_TESTS: 'write-tests',

    // Specs management
    READ_SPECS: 'read-specs',
    WRITE_SPECS: 'write-specs',

    // Test generation (spec-driven)
    GENERATE_TESTS: 'generate-tests',

    // Execution and refinement
    EXECUTE: 'execute-skill',
    SKILL_REFINER: 'skill-refiner',

    // Orchestrators
    ORCHESTRATOR: 'skills-orchestrator',
};
```

### Timeout Configuration
```javascript
export const TIMEOUTS = {
    DEFAULT: 60000,       // 1 minute - standard operations
    ORCHESTRATOR: 90000,  // 1.5 minutes - multi-skill orchestration
    DBTABLE: 60000,       // 1 minute - database operations
    LLM_REQUEST: 120000,  // 2 minutes - LLM API calls
};
```

### Default Values
```javascript
export const DEFAULTS = {
    UI_STYLE: 'claude-code',
    ORCHESTRATOR_MODE: 'fast',
    HISTORY_MAX_ENTRIES: 1000,
    MAX_VISIBLE_ITEMS: 15,
};
```

### Error Codes
```javascript
export const ERROR_CODES = {
    // Configuration errors
    CONFIG_ERROR: 'CONFIG_ERROR',
    REPO_CONFIG_ERROR: 'REPO_CONFIG_ERROR',

    // Operation errors
    OPERATION_ERROR: 'OPERATION_ERROR',
    GIT_ERROR: 'GIT_ERROR',
    SKILL_EXEC_ERROR: 'SKILL_EXEC_ERROR',
    SKILL_CANCELLED: 'SKILL_CANCELLED',

    // Validation errors
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    SCHEMA_VALIDATION_ERROR: 'SCHEMA_VALIDATION_ERROR',
    FIELD_VALIDATION_ERROR: 'FIELD_VALIDATION_ERROR',

    // Resource errors
    RESOURCE_ERROR: 'RESOURCE_ERROR',
    SKILL_NOT_FOUND: 'SKILL_NOT_FOUND',
    REPO_NOT_FOUND: 'REPO_NOT_FOUND',
    FILE_NOT_FOUND: 'FILE_NOT_FOUND',
};
```

### Utility Functions
```javascript
export function getAllBuiltInSkillNames() {
    return Object.values(BUILT_IN_SKILLS);
}

export function isBuiltInSkill(skillName) {
    return getAllBuiltInSkillNames().includes(skillName);
}
```

## Why This Design

### 1. Central Registry
**Decision**: All constants in one file rather than scattered across modules.

**Rationale**:
- Single source of truth
- Easy to find and update values
- No circular dependencies
- Import exactly what you need

### 2. Named Constants vs Magic Strings
**Decision**: Use `BUILT_IN_SKILLS.LIST` instead of `'list-skills'`.

**Rationale**:
- Typos caught at import time
- IDE autocomplete works
- Refactoring is safer
- Clear documentation of available skills

### 3. Grouped by Category
**Decision**: Separate objects for skills, timeouts, defaults, errors.

**Rationale**:
- Related constants together
- Different usage patterns (skills vs timeouts)
- Selective imports possible
- Clear organization

### 4. Millisecond Timeouts
**Decision**: Timeouts in milliseconds, not seconds.

**Rationale**:
- Matches Node.js conventions (setTimeout, etc.)
- No conversion needed in most uses
- Consistent with JavaScript ecosystem
- Comments clarify human-readable duration

### 5. Utility Functions
**Decision**: Provide helper functions for common lookups.

**Rationale**:
- `isBuiltInSkill()` cleaner than manual lookup
- Encapsulates implementation details
- Consistent checking across codebase
- Easy to extend (e.g., add caching)

### 6. Config Version
**Decision**: Include CONFIG_VERSION for schema migrations.

**Rationale**:
- Future-proof configuration files
- Enables backward-compatible changes
- Migration logic can check version
- Clear contract with stored configs

## Public API

### Constants
```javascript
BUILT_IN_SKILLS    // { LIST, READ, WRITE, DELETE, ... }
TIMEOUTS           // { DEFAULT, ORCHESTRATOR, DBTABLE, LLM_REQUEST }
CONFIG_VERSION     // 1
DEFAULTS           // { UI_STYLE, ORCHESTRATOR_MODE, ... }
ERROR_CODES        // { CONFIG_ERROR, SKILL_NOT_FOUND, ... }
```

### Functions
```javascript
getAllBuiltInSkillNames()    // string[] - all skill name values
isBuiltInSkill(skillName)    // boolean - check if name is built-in
```

## Usage Examples

### Command Mapping
```javascript
import { BUILT_IN_SKILLS } from '../lib/constants.mjs';

const COMMANDS = {
    'ls': { skill: BUILT_IN_SKILLS.LIST },
    'read': { skill: BUILT_IN_SKILLS.READ },
    // ...
};
```

### Timeout Usage
```javascript
import { TIMEOUTS } from '../lib/constants.mjs';

const result = await executeWithTimeout(operation, {
    timeout: TIMEOUTS.LLM_REQUEST,
});
```

### Error Handling
```javascript
import { ERROR_CODES } from '../lib/constants.mjs';

class SkillNotFoundError extends Error {
    code = ERROR_CODES.SKILL_NOT_FOUND;
}
```

### Checking Built-in Skills
```javascript
import { isBuiltInSkill } from '../lib/constants.mjs';

if (isBuiltInSkill(skillName)) {
    return 'Cannot execute built-in skill with execute-skill';
}
```

## Pseudocode

```javascript
// Constants are static - no logic needed
BUILT_IN_SKILLS = {
    LIST: 'list-skills',
    READ: 'read-skill',
    // ...
};

TIMEOUTS = {
    DEFAULT: 60_000,
    ORCHESTRATOR: 90_000,
    // ...
};

// Utility functions
function getAllBuiltInSkillNames() {
    return values(BUILT_IN_SKILLS);
}

function isBuiltInSkill(name) {
    return getAllBuiltInSkillNames().includes(name);
}
```

## Notes/Constraints

- Constants are frozen (Object.freeze could be added)
- Changing skill names requires updating built-in skill directories
- Timeout values chosen based on typical LLM response times
- ERROR_CODES should match error class implementations
- CONFIG_VERSION increment requires migration logic
- Adding new skills requires updating BUILT_IN_SKILLS
