/**
 * Write Specs - Creates or updates a skill's .specs.md specification file
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * Generate a basic specs template for a skill
 */
function generateSpecsTemplate(skillName, skillType) {
    const entityName = skillName.replace(/-skill.*$/, '').replace(/-tskill$/, '').toLowerCase();

    if (skillType === 'tskill') {
        return `# ${skillName} - Technical Specification

## Overview

The **${skillName}** skill is a database table skill (tskill) that manages ${entityName} records.

## Skill Type

- **Type**: \`tskill\` (Table Skill / Database Table Skill)
- **Generated File**: \`tskill.generated.mjs\`
- **Definition File**: \`tskill.md\`

## Purpose

[Describe the purpose of this skill]

## Schema Definition

### Primary Key

| Field | Format | Description |
|-------|--------|-------------|
| \`${entityName}_id\` | \`PREFIX-####\` | Auto-generated unique identifier |

### Core Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| \`${entityName}_id\` | String | Yes | Primary key |
| \`name\` | String | Yes | Display name |
| \`created_at\` | DateTime | Yes | Creation timestamp |

## Code Generation Prompt

Generate JavaScript/ESM code for this database table skill.

### Skill Info
- Skill Name: {{skillName}}
- Entity: ${entityName}
- Primary Key Field: ${entityName}_id

### Skill Definition
{{content}}

### Required Function Signatures

#### 1. generatePKValues(record, existingRecords)
\`\`\`javascript
export function generatePKValues(record, existingRecords = []) {
    if (record.${entityName}_id) return {};
    const prefix = 'PREFIX-';
    let maxNum = 0;
    for (const r of existingRecords) {
        const match = (r.${entityName}_id || '').match(/PREFIX-(\\d+)/);
        if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
    }
    return { ${entityName}_id: prefix + String(maxNum + 1).padStart(4, '0') };
}
\`\`\`

#### 2. Validators Return JSON Error Strings
\`\`\`javascript
export function validator_name(value, record) {
    if (!value || typeof value !== 'string' || value.trim().length < 2) {
        return JSON.stringify({
            field: 'name',
            error: 'Name is required',
            value: value
        });
    }
    return '';
}
\`\`\`

#### 3. validateRecord Returns { isValid, errors }
\`\`\`javascript
export function validateRecord(record) {
    const errors = [];
    // Run validators and collect errors
    return { isValid: errors.length === 0, errors };
}
\`\`\`

#### 4. prepareRecord is ASYNC
\`\`\`javascript
export async function prepareRecord(record, context = {}) {
    const prepared = { ...record };
    if (!prepared.created_at) prepared.created_at = new Date().toISOString();
    prepared.updated_at = new Date().toISOString();
    return prepared;
}
\`\`\`

Generate ONLY JavaScript code, no markdown code blocks, no explanations.

## Validation Requirements

### Required Exports
- generatePKValues
- prepareRecord
- validateRecord
- validator_${entityName}_id
- validator_name

### Required Fields
- ${entityName}_id
- name
- created_at

### Custom Rules
- Validators must return JSON.stringify({ field, error, value }) or empty string
- validateRecord must return { isValid: boolean, errors: Array }
- prepareRecord must be async
`;
    }

    // Generic template for other skill types
    return `# ${skillName} - Technical Specification

## Overview

[Describe the ${skillName} skill]

## Skill Type

- **Type**: \`${skillType || 'cskill'}\`

## Purpose

[Describe the purpose of this skill]

## Implementation Details

[Add implementation details here]

## Usage Examples

[Add usage examples here]
`;
}

export async function action(recursiveSkilledAgent, prompt) {
    const skillsDir = recursiveSkilledAgent?.getSkillsDir?.();

    if (!skillsDir) {
        return 'Error: skillsDir not available (agent.getSkillsDir() returned null)';
    }

    // Parse arguments
    let args;
    if (typeof prompt === 'string') {
        try {
            args = JSON.parse(prompt);
        } catch (e) {
            // Check if it's just a skill name (for template generation)
            const trimmed = prompt.trim();
            if (trimmed && !trimmed.includes('{')) {
                args = { skillName: trimmed, generateTemplate: true };
            } else {
                return `Error: Invalid input. Expected: {skillName, content} or just skillName for template. Got: ${prompt.slice(0, 100)}`;
            }
        }
    } else {
        args = prompt || {};
    }

    const { skillName, content, generateTemplate, section, sectionContent } = args;

    if (!skillName) {
        return 'Error: skillName is required';
    }

    // Find the skill to get its directory
    const skillInfo = recursiveSkilledAgent?.findSkillFile?.(skillName);

    let skillDir;
    if (skillInfo) {
        skillDir = skillInfo.record?.skillDir || path.dirname(skillInfo.filePath);
    } else {
        // Skill doesn't exist yet - create in skillsDir
        skillDir = path.join(skillsDir, skillName);
    }

    const specsPath = path.join(skillDir, '.specs.md');

    // Handle section update
    if (section && sectionContent !== undefined) {
        if (!fs.existsSync(specsPath)) {
            return `Error: No .specs.md file exists for "${skillName}". Create one first with: /specs-write ${skillName}`;
        }

        try {
            let existingContent = fs.readFileSync(specsPath, 'utf8');

            // Find and replace the section
            const sectionRegex = new RegExp(
                `(##\\s+${section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\n)([\\s\\S]*?)(?=\\n##\\s|$)`,
                'i'
            );

            if (existingContent.match(sectionRegex)) {
                existingContent = existingContent.replace(sectionRegex, `$1${sectionContent}\n`);
            } else {
                // Section doesn't exist, append it
                existingContent += `\n## ${section}\n\n${sectionContent}\n`;
            }

            fs.writeFileSync(specsPath, existingContent, 'utf8');
            return `Updated section "${section}" in ${skillName}/.specs.md`;
        } catch (error) {
            return `Error updating section: ${error.message}`;
        }
    }

    // Handle full content write or template generation
    let finalContent = content;

    if (!finalContent && generateTemplate) {
        const skillType = skillInfo?.type || 'cskill';
        finalContent = generateSpecsTemplate(skillName, skillType);
    }

    if (!finalContent) {
        return `Error: content is required. Use {skillName, content} to write specs, or just skillName to generate a template.`;
    }

    try {
        // Create directory if needed
        if (!fs.existsSync(skillDir)) {
            fs.mkdirSync(skillDir, { recursive: true });
        }

        const existed = fs.existsSync(specsPath);
        fs.writeFileSync(specsPath, finalContent, 'utf8');

        const action = existed ? 'Updated' : 'Created';
        return `${action}: ${skillName}/.specs.md (${finalContent.length} bytes)\nPath: ${specsPath}`;
    } catch (error) {
        return `Error writing specs file: ${error.message}`;
    }
}

export default action;
