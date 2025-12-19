# Design Spec: src/lib/RepoManager.mjs

ID: DS(/lib/RepoManager.mjs)

## Overview

**Role**: Manages external skill repositories for skill-manager-cli. Supports git repositories (auto-clone) and local filesystem paths with persistent configuration.

**Pattern**: Manager class with configuration file persistence (`.skill-manager.json`), combining git operations with filesystem path management.

**Key Collaborators**:
- `index.mjs` - creates RepoManager at startup
- `REPLSession` - passes to context for skill operations
- `SlashCommandHandler` - handles `/repos`, `/add-repo`, `/remove-repo`, etc.
- `RecursiveSkilledAgent` - consumes skill roots for discovery
- Built-in skills - check editability before operations

## What It Does

RepoManager provides:

1. **Configuration persistence**: Load/save `.skill-manager.json`
2. **Repository operations**: Add, remove, update, enable/disable
3. **Git integration**: Clone and pull repositories
4. **Validation**: Check for `.AchillesSkills` directory
5. **Editability control**: Mark repos as editable or read-only
6. **Skill root discovery**: Provide paths for skill discovery

## How It Does It

### Configuration Structure
```javascript
// .skill-manager.json
{
    "version": 1,
    "repositories": [
        {
            "name": "my-skills",
            "source": "https://github.com/user/repo.git",
            "type": "git",
            "localPath": "~/.skill-manager/repos/my-skills",
            "skillsPath": "/home/user/.skill-manager/repos/my-skills/.AchillesSkills",
            "branch": "main",
            "enabled": true,
            "editable": false,
            "addedAt": "2024-01-15T10:30:00.000Z"
        }
    ]
}
```

### Add Repository Flow
```javascript
async addRepository({ source, name, branch = 'main', force = false, editable = false }) {
    if (!source) {
        throw new InputValidationError('source', 'Repository source is required');
    }

    const repoName = name || this.generateRepoName(source);

    // Check for duplicate
    const existing = this.config.repositories.find((r) => r.name === repoName);
    if (existing && !force) {
        throw new RepositoryConfigurationError(repoName, 'Repository already exists');
    }

    let localPath;
    let type;

    if (this.isGitUrl(source)) {
        type = 'git';
        localPath = path.join(this.globalReposDir, repoName);
        await this.cloneRepository(source, this.expandPath(localPath), branch);
    } else {
        type = 'local';
        localPath = path.resolve(source);
        if (!fs.existsSync(localPath)) {
            throw new DirectoryNotFoundError(source);
        }
    }

    // Validate repository has .AchillesSkills
    const validation = this.validateRepository(localPath);
    if (!validation.valid) {
        if (type === 'git') {
            fs.rmSync(this.expandPath(localPath), { recursive: true, force: true });
        }
        throw new RepositoryConfigurationError(repoName, 'No skills found');
    }

    // Add to config
    const repoEntry = {
        name: repoName,
        source,
        type,
        localPath: type === 'git' ? `~/.skill-manager/repos/${repoName}` : localPath,
        skillsPath: validation.skillsPath,
        branch: type === 'git' ? branch : undefined,
        enabled: true,
        editable,
        addedAt: new Date().toISOString(),
    };

    this.config.repositories.push(repoEntry);
    this.saveConfig();

    return { success: true, name: repoName, skillCount: validation.skillCount };
}
```

### Repository Validation
```javascript
validateRepository(repoPath) {
    const expandedPath = this.expandPath(repoPath);

    // Check for .AchillesSkills at root
    let skillsPath = path.join(expandedPath, '.AchillesSkills');
    if (fs.existsSync(skillsPath) && fs.statSync(skillsPath).isDirectory()) {
        const skills = this._countSkills(skillsPath);
        return { valid: true, skillsPath, skillCount: skills };
    }

    // Check common subdirectories (e.g., achilles-cli/.AchillesSkills)
    const subdirs = fs.readdirSync(expandedPath).filter((f) => {
        const fullPath = path.join(expandedPath, f);
        return fs.statSync(fullPath).isDirectory() && !f.startsWith('.');
    });

    for (const subdir of subdirs) {
        skillsPath = path.join(expandedPath, subdir, '.AchillesSkills');
        if (fs.existsSync(skillsPath) && fs.statSync(skillsPath).isDirectory()) {
            const skills = this._countSkills(skillsPath);
            return { valid: true, skillsPath, skillCount: skills };
        }
    }

    return { valid: false, skillsPath: null, skillCount: 0 };
}
```

### Editability Checking
```javascript
getSkillRepoInfo(skillDir) {
    if (!skillDir) {
        return { isFromRepo: false, repoName: null, editable: true };
    }

    for (const repo of this.config.repositories) {
        if (!repo.skillsPath) continue;

        const expandedPath = this.expandPath(repo.skillsPath);
        if (skillDir.startsWith(expandedPath)) {
            return {
                isFromRepo: true,
                repoName: repo.name,
                editable: repo.editable || false,
            };
        }
    }

    // Not from any external repo - it's a local skill
    return { isFromRepo: false, repoName: null, editable: true };
}
```

## Why This Design

### 1. Per-Project Configuration
**Decision**: Store configuration in `.skill-manager.json` in working directory.

**Rationale**:
- Different projects have different skill needs
- Configuration can be version controlled
- No global state pollution
- Easy to inspect and edit manually

### 2. Git + Local Path Support
**Decision**: Support both git URLs and local filesystem paths.

**Rationale**:
- Git repos enable sharing and versioning
- Local paths enable development workflows
- Different use cases need different source types
- Unified interface regardless of source

### 3. Shallow Clone
**Decision**: Clone with `--depth 1` by default.

**Rationale**:
- Skills don't need full history
- Much faster clone times
- Less disk space usage
- Still supports pull updates

### 4. Editable vs Read-Only
**Decision**: Separate `enabled` and `editable` flags.

**Rationale**:
- Enabled controls skill discovery/execution
- Editable controls modification permissions
- External repos often shouldn't be modified
- Prevents accidental changes to shared skills

### 5. Path Tilde Expansion
**Decision**: Store git repo paths with `~` prefix, expand on use.

**Rationale**:
- Config files are portable
- Different users have different home directories
- Relative to home is intuitive
- Absolute paths would break sharing

### 6. Validation on Add
**Decision**: Validate `.AchillesSkills` exists before accepting repository.

**Rationale**:
- Fail fast with clear error
- Don't pollute config with invalid repos
- Check subdirectories for flexibility
- Clean up cloned repo on failure

## Public API

### Constructor
```javascript
new RepoManager({
    workingDir: string,     // For .skill-manager.json
    globalReposDir: string, // For cloned repos (~/.skill-manager/repos)
    logger: object,         // Optional logger
})
```

### Repository Operations
```javascript
addRepository({ source, name, branch, force, editable })  // Add git/local repo
removeRepository(name, deleteFiles)                        // Remove from config
updateRepository(name)                                     // Git pull (or "all")
setRepositoryEnabled(name, enabled)                        // Enable/disable
setRepositoryEditable(name, editable)                      // Set edit permissions
```

### Query Methods
```javascript
listRepositories()          // All repos with metadata
getEnabledSkillRoots()     // Paths for skill discovery
getEditableSkillRoots()    // Paths for editable repos only
getSkillRepoInfo(skillDir) // Check if skill is from repo
```

### Utility Methods
```javascript
isGitUrl(source)           // Check if source is git URL
generateRepoName(source)   // Generate name from URL/path
expandPath(filepath)       // Expand ~ to home directory
validateRepository(path)   // Check for .AchillesSkills
```

## Pseudocode

```javascript
class RepoManager {
    constructor({ workingDir, globalReposDir }) {
        this.configPath = join(workingDir, '.skill-manager.json');
        this.globalReposDir = globalReposDir || '~/.skill-manager/repos';
        this.loadConfig();
    }

    loadConfig() {
        if (exists(this.configPath)) {
            this.config = JSON.parse(read(this.configPath));
        } else {
            this.config = { version: 1, repositories: [] };
        }
    }

    async addRepository({ source, name, branch, editable }) {
        repoName = name || generateRepoName(source);

        if (isGitUrl(source)) {
            localPath = join(globalReposDir, repoName);
            await cloneRepository(source, localPath, branch);
        } else {
            localPath = resolve(source);
        }

        validation = validateRepository(localPath);
        if (!validation.valid) {
            cleanup if git;
            throw error;
        }

        config.repositories.push({
            name: repoName,
            source,
            type: isGitUrl ? 'git' : 'local',
            localPath,
            skillsPath: validation.skillsPath,
            enabled: true,
            editable,
        });

        saveConfig();
        return { success: true, skillCount: validation.skillCount };
    }

    getEnabledSkillRoots() {
        roots = [];
        for (repo of config.repositories) {
            if (repo.enabled && exists(repo.skillsPath)) {
                roots.push(expandPath(repo.skillsPath));
            }
        }
        return roots;
    }
}
```

## Error Types

```javascript
ConfigFileError           // Config file read/write failure
RepositoryConfigurationError // Invalid repo config
EnvironmentConfigurationError // Missing git
GitOperationError         // Clone/pull failure
DirectoryNotFoundError    // Path doesn't exist
RepositoryNotFoundError   // Unknown repo name
InputValidationError      // Missing required input
```

## Notes/Constraints

- Config file created on first write, not on construction
- Git must be installed for git repository operations
- Shallow clones may not work with all git setups
- Local paths must be absolute after resolution
- `~` expansion only at start of path
- Validation checks root and one level of subdirectories
- Removing repo with `deleteFiles=true` only removes git clones
- Local path repos are never deleted on remove
