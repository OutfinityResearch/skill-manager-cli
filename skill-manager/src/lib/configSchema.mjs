/**
 * JSON Schema and validation for .skill-manager.json configuration.
 *
 * Used by:
 * - RepoManager for config file validation
 * - Config class for runtime validation
 */

import { SchemaValidationError, FieldValidationError } from './errors/index.mjs';

/**
 * JSON Schema for .skill-manager.json configuration file.
 */
export const skillManagerConfigSchema = {
    type: 'object',
    properties: {
        version: {
            type: 'number',
            minimum: 1,
            description: 'Configuration file version',
        },
        repositories: {
            type: 'array',
            description: 'List of external skill repositories',
            items: {
                type: 'object',
                required: ['name', 'source'],
                properties: {
                    name: {
                        type: 'string',
                        minLength: 1,
                        description: 'Unique repository identifier',
                    },
                    source: {
                        type: 'string',
                        minLength: 1,
                        description: 'Git URL or local filesystem path',
                    },
                    type: {
                        enum: ['local', 'git'],
                        description: 'Repository type',
                    },
                    localPath: {
                        type: 'string',
                        description: 'Local filesystem path to the repository',
                    },
                    skillsPath: {
                        type: 'string',
                        description: 'Path to .AchillesSkills directory',
                    },
                    branch: {
                        type: 'string',
                        description: 'Git branch (for git repositories)',
                    },
                    enabled: {
                        type: 'boolean',
                        default: true,
                        description: 'Whether the repository is active',
                    },
                    editable: {
                        type: 'boolean',
                        default: false,
                        description: 'Whether skills can be modified',
                    },
                    addedAt: {
                        type: 'string',
                        format: 'date-time',
                        description: 'When the repository was added',
                    },
                },
            },
        },
    },
};

/**
 * Validation result object.
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {string[]} errors - List of validation error messages
 */

/**
 * Validate a .skill-manager.json configuration object.
 *
 * @param {Object} config - Configuration object to validate
 * @returns {ValidationResult} Validation result
 */
export function validateSkillManagerConfig(config) {
    const errors = [];

    // Check version
    if (config.version !== undefined) {
        if (typeof config.version !== 'number') {
            errors.push('version must be a number');
        } else if (config.version < 1) {
            errors.push('version must be at least 1');
        }
    }

    // Check repositories
    if (config.repositories !== undefined) {
        if (!Array.isArray(config.repositories)) {
            errors.push('repositories must be an array');
        } else {
            config.repositories.forEach((repo, index) => {
                const prefix = `repositories[${index}]`;

                if (!repo.name || typeof repo.name !== 'string') {
                    errors.push(`${prefix}.name is required and must be a string`);
                }
                if (!repo.source || typeof repo.source !== 'string') {
                    errors.push(`${prefix}.source is required and must be a string`);
                }
                if (repo.type !== undefined && !['local', 'git'].includes(repo.type)) {
                    errors.push(`${prefix}.type must be 'local' or 'git'`);
                }
                if (repo.enabled !== undefined && typeof repo.enabled !== 'boolean') {
                    errors.push(`${prefix}.enabled must be a boolean`);
                }
                if (repo.editable !== undefined && typeof repo.editable !== 'boolean') {
                    errors.push(`${prefix}.editable must be a boolean`);
                }
            });
        }
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Validate and throw if invalid.
 *
 * @param {Object} config - Configuration object to validate
 * @param {string} [source='config'] - Source identifier for error messages
 * @throws {SchemaValidationError} If validation fails
 */
export function assertValidConfig(config, source = 'config') {
    const result = validateSkillManagerConfig(config);
    if (!result.valid) {
        throw new SchemaValidationError(source, result.errors);
    }
}

/**
 * Schema for repository entry validation.
 */
export const repositoryEntrySchema = {
    required: ['name', 'source'],
    properties: skillManagerConfigSchema.properties.repositories.items.properties,
};

/**
 * Validate a single repository entry.
 *
 * @param {Object} repo - Repository entry to validate
 * @returns {ValidationResult} Validation result
 */
export function validateRepositoryEntry(repo) {
    const errors = [];

    if (!repo.name || typeof repo.name !== 'string' || repo.name.trim() === '') {
        errors.push('name is required and must be a non-empty string');
    }
    if (!repo.source || typeof repo.source !== 'string' || repo.source.trim() === '') {
        errors.push('source is required and must be a non-empty string');
    }
    if (repo.type !== undefined && !['local', 'git'].includes(repo.type)) {
        errors.push("type must be 'local' or 'git'");
    }

    return { valid: errors.length === 0, errors };
}

export default {
    skillManagerConfigSchema,
    validateSkillManagerConfig,
    assertValidConfig,
    repositoryEntrySchema,
    validateRepositoryEntry,
};
