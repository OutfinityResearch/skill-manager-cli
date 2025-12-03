/**
 * Validate Skill - Validates a skill file against its schema
 */

import fs from 'node:fs';
import path from 'node:path';
import { validateSkillContent } from '../../skillSchemas.mjs';

export async function action(recursiveSkilledAgent, prompt) {
    // Parse skill name
    let skillName = null;
    if (typeof prompt === 'string') {
        try {
            const parsed = JSON.parse(prompt);
            skillName = parsed.skillName || parsed.name;
        } catch (e) {
            skillName = prompt.trim();
        }
    } else if (prompt && typeof prompt === 'object') {
        skillName = prompt.skillName || prompt.name;
    }

    if (!skillName) {
        return 'Error: skillName is required. Usage: validate-skill <skillName>';
    }

    // Use findSkillFile to locate the skill
    const skillInfo = recursiveSkilledAgent?.findSkillFile?.(skillName);

    if (!skillInfo) {
        return `Error: Skill "${skillName}" not found`;
    }

    let content;
    try {
        content = fs.readFileSync(skillInfo.filePath, 'utf8');
    } catch (error) {
        return `Error reading skill file: ${error.message}`;
    }

    // Validate
    const result = validateSkillContent(content);

    const output = [];
    output.push(`Validation: ${skillName}`);
    output.push(`File: ${path.basename(skillInfo.filePath)}`);
    output.push(`Detected Type: ${result.detectedType || 'unknown'}`);
    output.push(`Status: ${result.valid ? 'VALID' : 'INVALID'}`);

    if (result.errors && result.errors.length > 0) {
        output.push('\nErrors:');
        result.errors.forEach(e => output.push(`  - ${e}`));
    }

    if (result.warnings && result.warnings.length > 0) {
        output.push('\nWarnings:');
        result.warnings.forEach(w => output.push(`  - ${w}`));
    }

    if (result.valid && (!result.warnings || result.warnings.length === 0)) {
        output.push('\nNo issues found.');
    }

    return output.join('\n');
}

export default action;
