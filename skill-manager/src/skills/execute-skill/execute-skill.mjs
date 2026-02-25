/**
 * Execute Skill - Executes a user skill and returns its output
 */

export async function action(recursiveSkilledAgent, prompt) {
    if (!recursiveSkilledAgent) {
        return 'Error: No recursiveSkilledAgent available';
    }

    // Parse input - can be:
    // - "skillName" - just the skill name
    // - "skillName with some input" - skill name followed by input
    // - { skillName: "x", input: "y" } - object form
    let skillName = null;
    let skillInput = '';

    if (typeof prompt === 'string' && prompt.trim()) {
        const trimmed = prompt.trim();
        // Handle multi-line input: only take the first line for skill name parsing
        const firstLine = trimmed.split('\n')[0].trim();
        const restLines = trimmed.split('\n').slice(1).join('\n').trim();

        // Check for common patterns like "execute joker with topic=programming"
        // or "joker topic=programming" or just "joker"
        const withMatch = firstLine.match(/^(\S+)\s+(?:with\s+)?(.+)$/i);
        if (withMatch) {
            skillName = withMatch[1];
            // Combine the rest of first line with any additional lines
            skillInput = restLines ? `${withMatch[2]}\n${restLines}` : withMatch[2];
        } else {
            skillName = firstLine;
            skillInput = restLines;
        }
    } else if (prompt && typeof prompt === 'object') {
        skillName = prompt.skillName || prompt.name || prompt.skill;
        skillInput = prompt.input || prompt.skillInput || prompt.args || '';
    }

    if (!skillName) {
        return 'Error: skillName is required.\nUsage: execute-skill <skillName> [input]\nExample: execute-skill joker topic=programming';
    }

    // Normalize skill name
    const normalizedName = skillName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    // Find the skill record
    const skillRecord = recursiveSkilledAgent.getSkillRecord?.(normalizedName)
        || recursiveSkilledAgent.getSkillRecord?.(skillName);

    if (!skillRecord) {
        // List available user skills
        const userSkills = recursiveSkilledAgent.getUserSkills?.() || [];
        const skillNames = userSkills.map(s => s.shortName || s.name).join(', ');
        return `Error: Skill "${skillName}" not found.\nAvailable user skills: ${skillNames || 'none'}`;
    }

    // Check if it's a built-in skill (we only want to execute user skills)
    if (recursiveSkilledAgent.isBuiltInSkill?.(skillRecord)) {
        return `Error: "${skillName}" is a built-in management skill, not a user skill.\nUse the skill directly (e.g., "read-skill joker") instead of execute-skill.`;
    }

    // Execute the skill
    try {
        const result = await recursiveSkilledAgent.executeWithReviewMode(
            skillInput || `Execute ${skillName}`,
            { skillName: skillRecord.name },
            'none'
        );

        // Format the result
        if (result && typeof result === 'object') {
            if (result.result !== undefined) {
                // Handle different result types
                if (typeof result.result === 'string') {
                    return `=== ${skillName} Output ===\n${result.result}`;
                }
                return `=== ${skillName} Output ===\n${JSON.stringify(result.result, null, 2)}`;
            }
            return `=== ${skillName} Output ===\n${JSON.stringify(result, null, 2)}`;
        }

        return `=== ${skillName} Output ===\n${String(result)}`;
    } catch (error) {
        return `Error executing skill "${skillName}": ${error.message}`;
    }
}

export default action;
