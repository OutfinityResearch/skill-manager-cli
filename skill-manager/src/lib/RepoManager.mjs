/**
 * RepoManager - Manages external skill repositories for skill-manager-cli.
 *
 * Supports:
 * - Git repositories (auto-clone)
 * - Local filesystem paths
 * - Persistent configuration via .skill-manager.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import os from 'node:os';

const CONFIG_FILE_NAME = '.skill-manager.json';
const CONFIG_VERSION = 1;

/**
 * RepoManager class for managing external skill repositories.
 */
export class RepoManager {
    /**
     * Create a new RepoManager.
     *
     * @param {Object} options
     * @param {string} options.workingDir - Working directory for config file
     * @param {string} options.globalReposDir - Directory for cloned repos (~/.skill-manager/repos)
     * @param {Object} [options.logger] - Optional logger
     */
    constructor({ workingDir, globalReposDir, logger }) {
        this.workingDir = workingDir;
        this.globalReposDir = globalReposDir || path.join(os.homedir(), '.skill-manager', 'repos');
        this.logger = logger;
        this.configPath = path.join(workingDir, CONFIG_FILE_NAME);
        this.config = null;

        // Load config on construction
        this.loadConfig();
    }

    /**
     * Load configuration from .skill-manager.json.
     * Creates default config if file doesn't exist.
     */
    loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const content = fs.readFileSync(this.configPath, 'utf8');
                this.config = JSON.parse(content);

                // Migrate older config versions if needed
                if (!this.config.version) {
                    this.config.version = CONFIG_VERSION;
                    this.config.repositories = this.config.repositories || [];
                }
            } else {
                // Create default config
                this.config = {
                    version: CONFIG_VERSION,
                    repositories: [],
                };
            }
        } catch (error) {
            this.logger?.warn?.(`Failed to load config: ${error.message}. Using defaults.`);
            this.config = {
                version: CONFIG_VERSION,
                repositories: [],
            };
        }
    }

    /**
     * Save configuration to .skill-manager.json.
     */
    saveConfig() {
        try {
            const content = JSON.stringify(this.config, null, 2);
            fs.writeFileSync(this.configPath, content, 'utf8');
        } catch (error) {
            throw new Error(`Failed to save config: ${error.message}`);
        }
    }

    /**
     * Check if a source is a git URL.
     *
     * @param {string} source - Repository source
     * @returns {boolean}
     */
    isGitUrl(source) {
        if (!source) return false;
        // Match git@, https://, http://, or .git suffix
        return /^(git@|https?:\/\/|git:\/\/)/.test(source) || source.endsWith('.git');
    }

    /**
     * Generate a repository name from a git URL or path.
     *
     * @param {string} source - Repository source
     * @returns {string}
     */
    generateRepoName(source) {
        if (this.isGitUrl(source)) {
            // Extract repo name from URL
            // https://github.com/user/repo.git -> user-repo
            // git@github.com:user/repo.git -> user-repo
            const match = source.match(/[\/:]([^\/]+)\/([^\/]+?)(\.git)?$/);
            if (match) {
                return `${match[1]}-${match[2]}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
            }
        }
        // Use directory name for local paths
        return path.basename(source).toLowerCase().replace(/[^a-z0-9-]/g, '-');
    }

    /**
     * Expand ~ to home directory in paths.
     *
     * @param {string} filepath - Path that may contain ~
     * @returns {string}
     */
    expandPath(filepath) {
        if (filepath.startsWith('~/')) {
            return path.join(os.homedir(), filepath.slice(2));
        }
        return filepath;
    }

    /**
     * Clone a git repository.
     *
     * @param {string} source - Git URL
     * @param {string} targetDir - Target directory
     * @param {string} [branch] - Branch to clone
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async cloneRepository(source, targetDir, branch = 'main') {
        // Ensure parent directory exists
        const parentDir = path.dirname(targetDir);
        if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
        }

        // Check if git is available
        try {
            await this._runCommand('git', ['--version']);
        } catch {
            throw new Error('Git is required but not installed. Please install git and try again.');
        }

        const args = ['clone', '--depth', '1'];
        if (branch) {
            args.push('--branch', branch);
        }
        args.push(source, targetDir);

        try {
            await this._runCommand('git', args);
            return { success: true, message: `Cloned ${source} to ${targetDir}` };
        } catch (error) {
            throw new Error(`Failed to clone repository: ${error.message}`);
        }
    }

    /**
     * Pull latest changes for a git repository.
     *
     * @param {string} repoDir - Repository directory
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async pullRepository(repoDir) {
        const expandedDir = this.expandPath(repoDir);

        if (!fs.existsSync(expandedDir)) {
            throw new Error(`Repository directory not found: ${repoDir}`);
        }

        try {
            await this._runCommand('git', ['pull'], { cwd: expandedDir });
            return { success: true, message: `Updated ${repoDir}` };
        } catch (error) {
            throw new Error(`Failed to update repository: ${error.message}`);
        }
    }

    /**
     * Run a command and return the output.
     *
     * @param {string} command - Command to run
     * @param {string[]} args - Command arguments
     * @param {Object} [options] - Spawn options
     * @returns {Promise<string>}
     */
    _runCommand(command, args, options = {}) {
        return new Promise((resolve, reject) => {
            const proc = spawn(command, args, {
                ...options,
                stdio: ['ignore', 'pipe', 'pipe'],
            });

            let stdout = '';
            let stderr = '';

            proc.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            proc.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            proc.on('close', (code) => {
                if (code === 0) {
                    resolve(stdout);
                } else {
                    reject(new Error(stderr || `Command failed with code ${code}`));
                }
            });

            proc.on('error', (error) => {
                reject(error);
            });
        });
    }

    /**
     * Validate that a repository contains .AchillesSkills.
     *
     * @param {string} repoPath - Path to repository
     * @returns {{valid: boolean, skillsPath: string|null, skillCount: number}}
     */
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

    /**
     * Count skills in a .AchillesSkills directory.
     *
     * @param {string} skillsDir - Path to .AchillesSkills
     * @returns {number}
     */
    _countSkills(skillsDir) {
        try {
            const entries = fs.readdirSync(skillsDir);
            return entries.filter((e) => {
                const fullPath = path.join(skillsDir, e);
                return fs.statSync(fullPath).isDirectory();
            }).length;
        } catch {
            return 0;
        }
    }

    /**
     * Add a repository (git URL or local path).
     *
     * @param {Object} options
     * @param {string} options.source - Git URL or local path
     * @param {string} [options.name] - Optional name (auto-generated if not provided)
     * @param {string} [options.branch] - Branch for git repos
     * @param {boolean} [options.force] - Overwrite existing repo with same name
     * @returns {Promise<{success: boolean, message: string, name: string, skillCount: number}>}
     */
    async addRepository({ source, name, branch = 'main', force = false }) {
        if (!source) {
            throw new Error('Repository source is required');
        }

        const repoName = name || this.generateRepoName(source);

        // Check for duplicate
        const existing = this.config.repositories.find((r) => r.name === repoName);
        if (existing && !force) {
            throw new Error(
                `Repository "${repoName}" already exists. Use a different name or --force to overwrite.`
            );
        }

        let localPath;
        let type;

        if (this.isGitUrl(source)) {
            // Clone git repository
            type = 'git';
            localPath = path.join(this.globalReposDir, repoName);

            // Remove existing if force
            if (existing && force && fs.existsSync(this.expandPath(localPath))) {
                fs.rmSync(this.expandPath(localPath), { recursive: true, force: true });
            }

            await this.cloneRepository(source, this.expandPath(localPath), branch);
        } else {
            // Local path
            type = 'local';
            localPath = path.resolve(source);

            if (!fs.existsSync(localPath)) {
                throw new Error(`Local path does not exist: ${source}`);
            }
        }

        // Validate repository has .AchillesSkills
        const validation = this.validateRepository(localPath);
        if (!validation.valid) {
            // Clean up cloned repo if invalid
            if (type === 'git') {
                const expandedPath = this.expandPath(localPath);
                if (fs.existsSync(expandedPath)) {
                    fs.rmSync(expandedPath, { recursive: true, force: true });
                }
            }
            throw new Error(
                `No skills found in repository. Expected .AchillesSkills directory in ${source}`
            );
        }

        // Remove existing entry if force
        if (existing && force) {
            this.config.repositories = this.config.repositories.filter((r) => r.name !== repoName);
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
            addedAt: new Date().toISOString(),
        };

        this.config.repositories.push(repoEntry);
        this.saveConfig();

        return {
            success: true,
            message: `Repository "${repoName}" added successfully. ${validation.skillCount} skill(s) found.`,
            name: repoName,
            skillCount: validation.skillCount,
        };
    }

    /**
     * Remove a repository from config.
     *
     * @param {string} name - Repository name
     * @param {boolean} [deleteFiles] - Also delete cloned files
     * @returns {{success: boolean, message: string}}
     */
    removeRepository(name, deleteFiles = false) {
        const repo = this.config.repositories.find((r) => r.name === name);
        if (!repo) {
            throw new Error(`Repository "${name}" not found`);
        }

        // Optionally delete cloned files
        if (deleteFiles && repo.type === 'git') {
            const expandedPath = this.expandPath(repo.localPath);
            if (fs.existsSync(expandedPath)) {
                fs.rmSync(expandedPath, { recursive: true, force: true });
            }
        }

        this.config.repositories = this.config.repositories.filter((r) => r.name !== name);
        this.saveConfig();

        return {
            success: true,
            message: `Repository "${name}" removed${deleteFiles ? ' and files deleted' : ''}`,
        };
    }

    /**
     * Update a repository (git pull).
     *
     * @param {string} name - Repository name, or "all" for all git repos
     * @returns {Promise<{success: boolean, message: string, results?: Array}>}
     */
    async updateRepository(name) {
        if (name === 'all') {
            const gitRepos = this.config.repositories.filter((r) => r.type === 'git');
            if (gitRepos.length === 0) {
                return { success: true, message: 'No git repositories to update' };
            }

            const results = [];
            for (const repo of gitRepos) {
                try {
                    await this.pullRepository(repo.localPath);
                    results.push({ name: repo.name, success: true });
                } catch (error) {
                    results.push({ name: repo.name, success: false, error: error.message });
                }
            }

            const successCount = results.filter((r) => r.success).length;
            return {
                success: true,
                message: `Updated ${successCount}/${results.length} repositories`,
                results,
            };
        }

        const repo = this.config.repositories.find((r) => r.name === name);
        if (!repo) {
            throw new Error(`Repository "${name}" not found`);
        }

        if (repo.type !== 'git') {
            return { success: true, message: `"${name}" is a local path, no update needed` };
        }

        await this.pullRepository(repo.localPath);
        return { success: true, message: `Repository "${name}" updated` };
    }

    /**
     * Enable or disable a repository.
     *
     * @param {string} name - Repository name
     * @param {boolean} enabled - Enable or disable
     * @returns {{success: boolean, message: string}}
     */
    setRepositoryEnabled(name, enabled) {
        const repo = this.config.repositories.find((r) => r.name === name);
        if (!repo) {
            throw new Error(`Repository "${name}" not found`);
        }

        repo.enabled = enabled;
        this.saveConfig();

        return {
            success: true,
            message: `Repository "${name}" ${enabled ? 'enabled' : 'disabled'}`,
        };
    }

    /**
     * List all configured repositories.
     *
     * @returns {Array}
     */
    listRepositories() {
        return this.config.repositories.map((r) => ({
            name: r.name,
            source: r.source,
            type: r.type,
            localPath: r.localPath,
            skillsPath: r.skillsPath,
            enabled: r.enabled,
            addedAt: r.addedAt,
        }));
    }

    /**
     * Get skill root paths for all enabled repositories.
     *
     * @returns {string[]}
     */
    getEnabledSkillRoots() {
        const roots = [];

        for (const repo of this.config.repositories) {
            if (!repo.enabled) continue;

            // Use skillsPath if available, otherwise find it
            let skillsPath = repo.skillsPath;

            if (!skillsPath) {
                const validation = this.validateRepository(repo.localPath);
                if (validation.valid) {
                    skillsPath = validation.skillsPath;
                    // Update config with discovered path
                    repo.skillsPath = skillsPath;
                }
            }

            if (skillsPath) {
                const expandedPath = this.expandPath(skillsPath);
                if (fs.existsSync(expandedPath)) {
                    roots.push(expandedPath);
                }
            }
        }

        // Save any updates to skillsPath
        this.saveConfig();

        return roots;
    }
}

export default RepoManager;
