# RepoManager Module Specification

Manages external skill repositories for skill-manager-cli.

## Overview

RepoManager provides functionality to add, remove, update, and configure external skill repositories. It supports both git repositories (with automatic cloning) and local filesystem paths, with persistent configuration via a JSON file.

## Configuration

Configuration is stored in `.skill-manager.json` in the working directory.

Configuration structure:
- version: Configuration schema version (currently 1)
- repositories: Array of repository entries

Repository entry structure:
- name: Unique repository identifier
- source: Original git URL or path
- type: "git" or "local"
- localPath: Path to repository (~ expanded for git repos)
- skillsPath: Path to .AchillesSkills directory
- branch: Git branch (for git repos only)
- enabled: Boolean for active status
- editable: Boolean for skill modification permissions
- addedAt: ISO timestamp of when added

## RepoManager Class

### Constructor

Creates a new RepoManager instance.

Accepts options object with:
- workingDir: Working directory for config file
- globalReposDir: Directory for cloned repos (defaults to ~/.skill-manager/repos)
- logger: Optional logger for warnings/errors

Initialization:
1. Store configuration paths
2. Construct config file path
3. Load existing config or create default

### Configuration Methods

#### loadConfig

Loads configuration from .skill-manager.json.

Processing:
1. Check if file exists
2. If exists: Parse JSON, migrate older versions
3. If not exists: Create default with empty repositories array

Silently uses defaults on parse errors.

#### saveConfig

Saves configuration to .skill-manager.json.

Throws ConfigFileError on write failure.

### Utility Methods

#### isGitUrl

Checks if source is a git URL.

Returns true for:
- URLs starting with git@, https://, http://, git://
- Paths ending with .git

#### generateRepoName

Generates repository name from source.

For git URLs:
- Extracts user-repo pattern
- Converts to lowercase with hyphens

For local paths:
- Uses directory basename
- Normalizes to lowercase with hyphens

#### expandPath

Expands ~ to home directory in paths.

### Git Operations

#### cloneRepository

Clones a git repository.

Accepts:
- source: Git URL
- targetDir: Target directory
- branch: Branch to clone (default "main")

Processing:
1. Ensure parent directory exists
2. Check git is available
3. Run git clone with --depth 1
4. Return success/message object

Throws:
- EnvironmentConfigurationError if git not installed
- GitOperationError on clone failure

#### pullRepository

Pulls latest changes for a git repository.

Accepts:
- repoDir: Repository directory

Processing:
1. Expand path
2. Verify directory exists
3. Run git pull

Throws:
- DirectoryNotFoundError if repo doesn't exist
- GitOperationError on pull failure

#### _runCommand

Runs a command and returns output.

Accepts:
- command: Command to run
- args: Command arguments
- options: Spawn options

Returns promise resolving to stdout on success, rejecting on failure.

### Validation Methods

#### validateRepository

Validates that a repository contains skills.

Accepts:
- repoPath: Path to repository

Processing:
1. Check for .AchillesSkills at root
2. If not found, check first-level subdirectories
3. Count skills in found directory

Returns:
- valid: Boolean
- skillsPath: Path to .AchillesSkills or null
- skillCount: Number of skill directories

#### _countSkills

Counts skill directories in .AchillesSkills.

Returns number of subdirectories.

### Repository Management Methods

#### addRepository

Adds a repository (git URL or local path).

Accepts options object:
- source: Git URL or local path (required)
- name: Optional name (auto-generated if not provided)
- branch: Branch for git repos (default "main")
- force: Overwrite existing repo with same name
- editable: Allow skill management operations

Processing:
1. Validate source is provided
2. Generate or use provided name
3. Check for duplicate (error unless force)
4. If git URL: Clone repository
5. If local path: Verify exists
6. Validate repository has skills
7. Add entry to config and save

Returns object with success, message, name, skillCount.

Throws:
- InputValidationError for missing source
- RepositoryConfigurationError for duplicate or invalid repo
- DirectoryNotFoundError for missing local path

#### removeRepository

Removes a repository from config.

Accepts:
- name: Repository name
- deleteFiles: Also delete cloned files (default false)

Processing:
1. Find repository in config
2. Optionally delete cloned files (git repos only)
3. Remove from config and save

Throws RepositoryNotFoundError if name not found.

#### updateRepository

Updates a repository (git pull).

Accepts:
- name: Repository name, or "all" for all git repos

Processing for "all":
1. Get all git repositories
2. Pull each, collecting results
3. Return aggregate success/failure

Processing for single:
1. Find repository
2. Skip if local path
3. Pull and return result

Throws RepositoryNotFoundError if name not found.

#### setRepositoryEnabled

Enables or disables a repository.

Accepts:
- name: Repository name
- enabled: Boolean

Updates config and saves.

#### setRepositoryEditable

Sets repository's editable status.

Accepts:
- name: Repository name
- editable: Boolean

Updates config and saves.

Non-editable repositories have skills that can be executed but not listed, read, or modified.

### Query Methods

#### listRepositories

Returns array of all configured repositories with their properties.

#### getEnabledSkillRoots

Returns skill root paths for all enabled repositories.

Processing:
1. Filter enabled repositories
2. Use skillsPath or validate to find it
3. Expand paths and verify existence
4. Update config with discovered paths

#### getEditableSkillRoots

Returns skill root paths for repositories that are both enabled and editable.

Same processing as getEnabledSkillRoots but also filters by editable.

#### getSkillRepoInfo

Checks if a skill path belongs to an external repository.

Accepts:
- skillDir: The skill's directory path

Returns:
- isFromRepo: Boolean
- repoName: Repository name or null
- editable: Boolean (true for local skills)

## Error Types Used

- ConfigFileError: Config file save failures
- RepositoryConfigurationError: Repository configuration issues
- EnvironmentConfigurationError: Missing required tools
- GitOperationError: Git command failures
- DirectoryNotFoundError: Missing directories
- RepositoryNotFoundError: Unknown repository name
- InputValidationError: Missing required input

## Exports

Exports:
- RepoManager class (named and default)
