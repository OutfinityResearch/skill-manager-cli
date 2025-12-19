/**
 * Read Skill - Reads a skill definition file
 *
 * Only allows reading skills that are editable:
 * - Local skills (in working directory's .AchillesSkills)
 * - Skills from external repos marked as editable
 */

import fs from 'node:fs';
import path from 'node:path';

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
    // Parse skill name from prompt
    let skillName = null;
    if (typeof prompt === 'string') {
        try {
            const parsed = JSON.parse(prompt);
            skillName = parsed.skillName || parsed.name;
        } catch (e) {
            // Not JSON, treat as string
            skillName = prompt.trim();
        }
    } else if (prompt && typeof prompt === 'object') {
        skillName = prompt.skillName || prompt.name;
    }

    if (!skillName) {
        return 'Error: skillName is required. Usage: read-skill <skillName>';
    }

    // Use findSkillFile to locate the skill
    const skillInfo = recursiveSkilledAgent?.findSkillFile?.(skillName);

    if (!skillInfo) {
        // List available editable skills
        const repoManager = recursiveSkilledAgent?.repoManager;
        let userSkills = recursiveSkilledAgent?.getUserSkills?.() || [];
        if (repoManager) {
            userSkills = userSkills.filter(s => {
                const info = repoManager.getSkillRepoInfo(s.skillDir);
                return info.editable;
            });
        }
        const available = userSkills.map(s => s.shortName || s.name).join(', ');
        return `Error: Skill "${skillName}" not found.\nAvailable editable skills: ${available || 'none'}`;
    }

    // Check if skill is editable
    const repoManager = recursiveSkilledAgent?.repoManager;
    const skillDir = skillInfo.record?.skillDir || path.dirname(skillInfo.filePath);
    const { editable, repoName } = isSkillEditable(skillDir, repoManager);

    if (!editable) {
        return `Error: Cannot read skill "${skillName}" - it belongs to read-only repository "${repoName}".\n\nTo enable editing, run: /edit-repo ${repoName}`;
    }

    try {
        const content = fs.readFileSync(skillInfo.filePath, 'utf8');

        return `=== ${path.basename(skillInfo.filePath)} ===\nPath: ${skillInfo.filePath}\nType: ${skillInfo.type}\n\n${content}`;
    } catch (error) {
        return `Error reading skill file: ${error.message}`;
    }
}

export default action;
