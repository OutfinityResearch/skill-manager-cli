/**
 * List Skills - Returns all registered skills from the catalog
 */

import { Sanitiser } from 'achillesAgentLib/utils/Sanitiser.mjs';

export async function action(recursiveSkilledAgent, prompt) {
    if (!recursiveSkilledAgent || typeof recursiveSkilledAgent.getSkills !== 'function') {
        return 'Error: No skill catalog available';
    }

    // Parse filter from input
    let filter = null;
    let showAllSkills = false;

    // Phrases that should NOT be treated as filters
    const ignorePatterns = [
        'list skills', 'list all skills', 'show skills', 'show all skills',
        'get skills', 'skills', 'all', 'all skills', 'list', 'show',
    ];

    // Check if user wants all skills (including built-in)
    const allSkillPatterns = [
        'list all skills', 'show all skills', 'all', 'all skills',
    ];

    // If input looks like a full command/sentence (has spaces and multiple words), ignore it as a filter
    const looksLikeCommand = (str) => {
        const words = str.split(/\s+/).length;
        return words > 3 || str.includes('"') || str.includes("'");
    };

    if (typeof prompt === 'string' && prompt.trim()) {
        const trimmed = prompt.trim().toLowerCase();
        // Check if user explicitly wants all skills
        if (allSkillPatterns.includes(trimmed)) {
            showAllSkills = true;
        }
        // Only use as filter if it's not a common command phrase or full command
        else if (!ignorePatterns.includes(trimmed) && !looksLikeCommand(trimmed)) {
            filter = trimmed;
        }
    } else if (prompt && typeof prompt === 'object' && prompt.filter) {
        filter = prompt.filter.toLowerCase();
    }

    // Get user skills only (exclude built-in) unless explicitly requested all
    const skills = showAllSkills
        ? recursiveSkilledAgent.getSkills()
        : (typeof recursiveSkilledAgent.getUserSkills === 'function'
            ? recursiveSkilledAgent.getUserSkills()
            : recursiveSkilledAgent.getSkills());

    if (skills.length === 0) {
        return showAllSkills
            ? 'No skills currently registered. Create one with write-skill or use get-template.'
            : 'No user skills found. Create one with write-skill or use get-template.';
    }

    // Apply filter if provided
    const filtered = filter
        ? skills.filter(s => s.type === filter || s.type.includes(filter))
        : skills;

    if (filtered.length === 0) {
        return `No skills found matching filter: "${filter}"\nAvailable types: ${[...new Set(skills.map(s => s.type))].join(', ')}`;
    }

    // Format output
    const output = filtered.map(s => {
        const toolName = `execute_${Sanitiser.sanitiseName(s.name).replace(/-/g, '_')}`;
        return [
            `[${s.type}] ${s.shortName || s.name}`,
            `   Summary: ${s.descriptor?.summary || 'No summary'}`,
            `   Path: ${s.skillDir || 'unknown'}`,
        ].join('\n');
    });

    const skillsLabel = showAllSkills ? 'skill(s)' : 'user skill(s)';
    const header = filter
        ? `Found ${filtered.length} ${skillsLabel} matching "${filter}":`
        : `Found ${filtered.length} ${skillsLabel}:`;

    return `${header}\n\n${output.join('\n\n')}`;
}

export default action;
