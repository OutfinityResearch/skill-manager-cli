/**
 * Validate Skill - Validates a skill file against its schema
 *
 * Only validates skills that are editable:
 * - Local skills (in working directory's .AchillesSkills)
 * - Skills from external repos marked as editable
 */

import fs from 'node:fs';
import path from 'node:path';
import { validateSkillContent } from '../../schemas/skillSchemas.mjs';

/**
 * Check if a skill is editable (local or from editable repo).
 */
function isSkillEditable(skillDir, repoManager) {
    if (!repoManager || !skillDir) {
        return { editable: true, repoName: null };
    }
    const repoInfo = repoManager.getSkillRepoInfo(skillDir);
    return { editable: repoInfo.editable, repoName: repoInfo.repoName };
}

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

    // Check if skill is editable
    const repoManager = recursiveSkilledAgent?.repoManager;
    const skillDir = skillInfo.record?.skillDir || path.dirname(skillInfo.filePath);
    const { editable, repoName } = isSkillEditable(skillDir, repoManager);

    if (!editable) {
        return `Error: Cannot validate skill "${skillName}" - it belongs to read-only repository "${repoName}".\n\nTo enable management, run: /edit-repo ${repoName}`;
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
