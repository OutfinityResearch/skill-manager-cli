/**
 * Write Skill - Creates or updates a skill definition file
 */

import fs from 'node:fs';
import path from 'node:path';
import { SKILL_FILE_NAMES } from 'achillesAgentLib/RecursiveSkilledAgents';

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
            return `Error: Invalid JSON input. Expected: {skillName, fileName, content}. Got: ${prompt.slice(0, 100)}`;
        }
    } else {
        args = prompt || {};
    }

    const { skillName, fileName, content } = args;

    if (!skillName) {
        return 'Error: skillName is required';
    }
    if (!fileName) {
        return 'Error: fileName is required (e.g., cgskill.md, tskill.md, cskill.md)';
    }
    if (content === undefined || content === null) {
        return 'Error: content is required';
    }

    // Validate fileName
    const isSkillFile = SKILL_FILE_NAMES.includes(fileName) || fileName.endsWith('.mjs') || fileName.endsWith('.js');
    if (!isSkillFile) {
        return `Warning: "${fileName}" is not a standard skill file. Valid skill files: ${SKILL_FILE_NAMES.join(', ')}`;
    }

    const skillDir = path.join(skillsDir, skillName);
    const filePath = path.join(skillDir, fileName);

    try {
        // Create directory if needed
        if (!fs.existsSync(skillDir)) {
            fs.mkdirSync(skillDir, { recursive: true });
        }

        // Check if file exists (for messaging)
        const existed = fs.existsSync(filePath);

        // Write file
        fs.writeFileSync(filePath, content, 'utf8');

        const action = existed ? 'Updated' : 'Created';

        // Auto-reload skills so the new skill is immediately available
        let reloadMessage = '';
        if (recursiveSkilledAgent && typeof recursiveSkilledAgent.reloadSkills === 'function') {
            try {
                const count = recursiveSkilledAgent.reloadSkills();
                reloadMessage = `\nSkills reloaded (${count} skill(s) registered).`;
            } catch (e) {
                reloadMessage = '\nNote: Could not auto-reload skills. Use "reload" command.';
            }
        }

        return `${action}: ${skillName}/${fileName} (${content.length} bytes)${reloadMessage}`;
    } catch (error) {
        return `Error writing file: ${error.message}`;
    }
}

export default action;
