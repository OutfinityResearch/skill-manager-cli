/**
 * Read Skill - Reads a skill definition file
 */

import fs from 'node:fs';
import path from 'node:path';

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
        // List available skills
        const userSkills = recursiveSkilledAgent?.getUserSkills?.() || [];
        const available = userSkills.map(s => s.shortName || s.name).join(', ');
        return `Error: Skill "${skillName}" not found.\nAvailable skills: ${available || 'none'}`;
    }

    try {
        const content = fs.readFileSync(skillInfo.filePath, 'utf8');
        const skillDir = skillInfo.record?.skillDir || path.dirname(skillInfo.filePath);

        // Check for specs file
        let specsSection = '';
        const specsPath = path.join(skillDir, '.specs.md');
        if (fs.existsSync(specsPath)) {
            try {
                const specsContent = fs.readFileSync(specsPath, 'utf8');
                specsSection = `\n\n=== .specs.md ===\nPath: ${specsPath}\n\n${specsContent}`;
            } catch (e) {
                // Ignore errors reading specs file
            }
        }

        return `=== ${path.basename(skillInfo.filePath)} ===\nPath: ${skillInfo.filePath}\nType: ${skillInfo.type}\n\n${content}${specsSection}`;
    } catch (error) {
        return `Error reading skill file: ${error.message}`;
    }
}

export default action;
