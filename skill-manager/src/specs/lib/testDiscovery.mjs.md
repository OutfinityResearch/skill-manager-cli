# testDiscovery Module Specification

Discovers and runs test files for skills.

## Overview

The testDiscovery module provides utilities for finding skill test files and executing them. It follows a naming convention where tests are stored in a `tests/` directory with filenames matching skill short names.

## Test File Convention

Test files location: `{workingDir}/tests/`
Test file naming: `{skillShortName}.tests.mjs`

Examples:
- `tests/area.tests.mjs` - Tests for the 'area' skill
- `tests/equipment.tests.mjs` - Tests for the 'equipment' skill

## Test File Requirements

Test files must export one of:
- A default async function
- A `runTests` async function

The function must return an object with:
- passed: Number of passed tests
- failed: Number of failed tests
- errors: Array of error messages (optional)

## Internal Functions

### getTestsDir

Gets the tests directory path from agent context.

Accepts:
- agent: RecursiveSkilledAgent instance

Processing:
1. Try to get working directory from agent.context.workingDir
2. Fall back to agent.options.startDir
3. Fall back to agent.startDir
4. Fall back to process.cwd()
5. Construct path to tests/ subdirectory
6. Return path if exists, null otherwise

## Exported Functions

### discoverSkillTests

Discovers all skill tests across registered skills.

Accepts:
- agent: RecursiveSkilledAgent instance

Processing:
1. Return empty array if agent has no skillCatalog
2. Get tests directory (return empty if not found)
3. Iterate all entries in skillCatalog
4. For each skill, check if `{shortName}.tests.mjs` exists
5. Add test info for each found test file

Returns array of test info objects:
- skillName: Full skill name
- shortName: Skill short name
- skillType: Skill type
- testFile: Full path to test file
- skillDir: Path to skill directory

### discoverSkillTest

Discovers tests for a specific skill.

Accepts:
- agent: RecursiveSkilledAgent instance
- skillName: Name of the skill

Processing:
1. Find skill info using agent.findSkillFile
2. Return null if skill not found
3. Get tests directory (return null if not found)
4. Check if test file exists for skill's short name

Returns test info object or null if not found.

### runTestFile

Runs a single test file in a subprocess.

Accepts:
- testFile: Path to the test file
- options: Configuration object
  - timeout: Test timeout in milliseconds (default 30000)
  - verbose: Include stderr in result (default false)

Processing:
1. Record start time
2. Create wrapper code that imports and runs test module
3. Spawn node process with wrapper code
4. Collect stdout and stderr
5. Set timeout timer
6. On process close:
   - Parse JSON result from stdout
   - Extract passed/failed/errors
   - Determine success based on exit code and failed count

Returns promise resolving to:
- success: Boolean
- passed: Number of passed tests
- failed: Number of failed tests
- output: Test stdout
- errors: Array of error messages
- duration: Execution time in milliseconds
- stderr: (if verbose) Test stderr

Handles:
- Timeout: Returns failed result with timeout error
- Process error: Returns failed result with error message
- Non-JSON output: Uses exit code for success determination

### runTestFileInProcess

Runs a test file by importing directly (for in-process testing).

Accepts:
- testFile: Path to the test file

Processing:
1. Record start time
2. Dynamic import test file with cache-busting query param
3. Call default function or runTests function
4. Return result object

Returns promise resolving to:
- success: Boolean (failed === 0)
- passed: Number
- failed: Number
- errors: Array
- duration: Execution time

Catches import/execution errors and returns failed result.

### runTestSuite

Runs multiple tests and aggregates results.

Accepts:
- tests: Array of test info objects from discoverSkillTests
- options: Configuration object
  - timeout: Per-test timeout
  - verbose: Include stderr
  - parallel: Run tests in parallel (default false)

Processing:
1. Record start time
2. If parallel: Run all tests concurrently with Promise.all
3. If sequential: Run tests one at a time
4. Aggregate results:
   - Sum passed/failed counts
   - Collect all errors
   - Determine overall success

Returns:
- success: Boolean (all tests passed)
- totalTests: Number of test files
- totalPassed: Total passed test cases
- totalFailed: Total failed test cases
- results: Array of individual test results
- errors: Flattened array of all errors
- duration: Total execution time

## Exports

Named exports:
- discoverSkillTests
- discoverSkillTest
- runTestFile
- runTestFileInProcess
- runTestSuite

Default export: Object containing all functions
