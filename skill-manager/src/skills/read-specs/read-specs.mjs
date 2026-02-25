/**
 * Read Specs - Reads a skill's .specs.md specification file
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
        return 'Error: skillName is required. Usage: read-specs <skillName>';
    }

    // Use findSkillFile to locate the skill
    const skillInfo = recursiveSkilledAgent?.findSkillFile?.(skillName);

    if (!skillInfo) {
        // List available skills
        const userSkills = recursiveSkilledAgent?.getUserSkills?.() || [];
        const available = userSkills.map(s => s.shortName || s.name).join(', ');
        return `Error: Skill "${skillName}" not found.\nAvailable skills: ${available || 'none'}`;
    }

    const skillDir = skillInfo.record?.skillDir || path.dirname(skillInfo.filePath);
    const specsPath = path.join(skillDir, '.specs.md');

    if (!fs.existsSync(specsPath)) {
        return `No .specs.md file found for skill "${skillName}".\nExpected path: ${specsPath}\n\nTo create one, use: /specs-write ${skillName}`;
    }

    try {
        const content = fs.readFileSync(specsPath, 'utf8');

        // Parse sections for summary
        const sections = [];
        const sectionMatches = content.matchAll(/^##\s+(.+)$/gm);
        for (const match of sectionMatches) {
            sections.push(match[1]);
        }

        const sectionsInfo = sections.length > 0
            ? `\nSections: ${sections.join(', ')}`
            : '';

        return `=== .specs.md for ${skillName} ===${sectionsInfo}\nPath: ${specsPath}\n\n${content}`;
    } catch (error) {
        return `Error reading specs file: ${error.message}`;
    }
}

export default action;
