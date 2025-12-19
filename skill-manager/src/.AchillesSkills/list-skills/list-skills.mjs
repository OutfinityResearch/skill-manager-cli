/**
 * List Skills - Returns all registered skills from the catalog
 *
 * By default, only shows skills that can be edited:
 * - Local skills (in working directory's .AchillesSkills)
 * - Skills from external repos marked as editable
 *
 * Use "list all skills" to include built-in skills (but still excludes non-editable repo skills).
 */

import { Sanitiser } from 'achillesAgentLib/utils/Sanitiser.mjs';

/**
 * Check if a skill is editable (local or from editable repo).
 */
function isSkillEditable(skillRecord, repoManager) {
    if (!repoManager || !skillRecord?.skillDir) {
        return true; // No repo manager means no external repos, all skills are editable
    }

    const repoInfo = repoManager.getSkillRepoInfo(skillRecord.skillDir);
    return repoInfo.editable;
}

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
    let skills = showAllSkills
        ? recursiveSkilledAgent.getSkills()
        : (typeof recursiveSkilledAgent.getUserSkills === 'function'
            ? recursiveSkilledAgent.getUserSkills()
            : recursiveSkilledAgent.getSkills());

    // Filter out non-editable external repo skills
    const repoManager = recursiveSkilledAgent.repoManager;
    if (repoManager) {
        skills = skills.filter(s => isSkillEditable(s, repoManager));
    }

    if (skills.length === 0) {
        return showAllSkills
            ? 'No editable skills currently registered. Create one with write-skill or use get-template.'
            : 'No editable user skills found. Create one with write-skill or use get-template.\n\nNote: Skills from read-only repos are hidden. Use /edit-repo <name> to enable editing.';
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
