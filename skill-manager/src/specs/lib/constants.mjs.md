# Constants Module Specification

Centralized constants for skill-manager-cli providing a single source of truth.

## Overview

This module exports all constant values used throughout skill-manager-cli, including built-in skill names, timeouts, configuration values, and error codes.

## BUILT_IN_SKILLS Object

Registry of built-in skill names. Use these constants instead of hardcoding skill name strings throughout the codebase.

### Core CRUD Operations
- LIST: 'list-skills' - List skills in catalog
- READ: 'read-skill' - Read skill definition content
- WRITE: 'write-skill' - Create or update skill files
- DELETE: 'delete-skill' - Remove skill directories

### Validation and Templates
- VALIDATE: 'validate-skill' - Validate skill against schema
- GET_TEMPLATE: 'get-template' - Get blank skill template
- PREVIEW: 'preview-changes' - Show diff before applying
- UPDATE_SECTION: 'update-section' - Update specific sections

### Code Generation and Testing
- GENERATE_CODE: 'generate-code' - Generate .mjs from definitions
- TEST_CODE: 'test-code' - Run tests for specific skill
- RUN_TESTS: 'run-tests' - Run test files
- WRITE_TESTS: 'write-tests' - Generate test file

### Specs Management
- READ_SPECS: 'read-specs' - Read skill specifications
- WRITE_SPECS: 'write-specs' - Write skill specifications

### Test Generation
- GENERATE_TESTS: 'generate-tests' - Generate tests from cskill specs

### Execution and Refinement
- EXECUTE: 'execute-skill' - Execute any skill directly
- SKILL_REFINER: 'skill-refiner' - Iterative improvement loop

### Orchestrators
- ORCHESTRATOR: 'skills-orchestrator' - Main routing orchestrator

## TIMEOUTS Object

Timeout values in milliseconds for various operations.

- DEFAULT: 60000 (1 minute) - Standard operation timeout
- ORCHESTRATOR: 90000 (1.5 minutes) - Orchestrator execution timeout
- DBTABLE: 60000 (1 minute) - Database table skill timeout
- LLM_REQUEST: 120000 (2 minutes) - LLM API request timeout

## CONFIG_VERSION Constant

Current version number for configuration file schema.

Value: 1

Used for configuration file migration when format changes.

## DEFAULTS Object

Default configuration values for the application.

- UI_STYLE: 'claude-code' - Default UI style
- ORCHESTRATOR_MODE: 'fast' - Default LLM mode for orchestrator
- HISTORY_MAX_ENTRIES: 1000 - Maximum history entries to store
- MAX_VISIBLE_ITEMS: 15 - Maximum items in selectors

## ERROR_CODES Object

Error codes for typed errors enabling programmatic error handling.

### Configuration Errors
- CONFIG_ERROR: General configuration error
- REPO_CONFIG_ERROR: Repository configuration error

### Operation Errors
- OPERATION_ERROR: General operation error
- GIT_ERROR: Git command failure
- SKILL_EXEC_ERROR: Skill execution error
- SKILL_CANCELLED: Skill execution cancelled

### Validation Errors
- VALIDATION_ERROR: General validation error
- SCHEMA_VALIDATION_ERROR: Schema validation failure
- FIELD_VALIDATION_ERROR: Field validation failure

### Resource Errors
- RESOURCE_ERROR: General resource error
- SKILL_NOT_FOUND: Skill not found in catalog
- REPO_NOT_FOUND: Repository not found
- FILE_NOT_FOUND: File not found

## Utility Functions

### getAllBuiltInSkillNames

Returns array of all built-in skill names.

Processing:
- Extract all values from BUILT_IN_SKILLS object

Returns string array.

### isBuiltInSkill

Checks if a skill name is a built-in skill.

Accepts:
- skillName: Name to check

Returns boolean indicating if name is in built-in skills list.

## Usage Pattern

Import specific constants:
```javascript
import { BUILT_IN_SKILLS, TIMEOUTS } from './lib/constants.mjs';

// Use constants instead of string literals
const skillName = BUILT_IN_SKILLS.LIST;
const timeout = TIMEOUTS.DEFAULT;
```

Check if built-in:
```javascript
import { isBuiltInSkill } from './lib/constants.mjs';

if (isBuiltInSkill(skillName)) {
    // Handle built-in skill
}
```

## Exports

Named exports:
- BUILT_IN_SKILLS
- TIMEOUTS
- CONFIG_VERSION
- DEFAULTS
- ERROR_CODES
- getAllBuiltInSkillNames
- isBuiltInSkill
