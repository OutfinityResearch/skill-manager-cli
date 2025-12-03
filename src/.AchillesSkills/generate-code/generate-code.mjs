/**
 * Generate Code - Generates .mjs code from skill definitions (tskill, iskill, oskill, cskill)
 */

import fs from 'node:fs';
import path from 'node:path';
import { detectSkillType, parseSkillSections, loadSpecsContent } from '../../schemas/skillSchemas.mjs';
import {
    buildCodeGenPrompt,
    buildIskillCodeGenPrompt,
    buildOskillCodeGenPrompt,
    buildCskillCodeGenPrompt,
} from './codeGeneration.prompts.mjs';

const SUPPORTED_TYPES = ['tskill', 'iskill', 'oskill', 'cskill'];

export async function action(recursiveSkilledAgent, prompt) {
    // Get llmAgent from the recursiveSkilledAgent
    const llmAgent = recursiveSkilledAgent?.llmAgent;

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
        return 'Error: skillName is required. Usage: generate-code <skillName>';
    }

    // Use findSkillFile to locate the skill
    const skillInfo = recursiveSkilledAgent?.findSkillFile?.(skillName);

    if (!skillInfo) {
        return `Error: Skill "${skillName}" not found`;
    }

    const filePath = skillInfo.filePath;
    const skillDir = skillInfo.record?.skillDir || path.dirname(filePath);

    let content;
    try {
        content = fs.readFileSync(filePath, 'utf8');
    } catch (error) {
        return `Error reading skill file: ${error.message}`;
    }

    // Verify it's a supported type
    const skillType = detectSkillType(content);
    if (!SUPPORTED_TYPES.includes(skillType)) {
        return `Error: Code generation is only supported for: ${SUPPORTED_TYPES.join(', ')}.\nThis skill is type: ${skillType || 'unknown'}`;
    }

    if (!llmAgent || typeof llmAgent.executePrompt !== 'function') {
        return 'Error: LLM agent not available for code generation';
    }

    // Parse sections for context
    const sections = parseSkillSections(content);

    // Load specs content if available
    const specsContent = loadSpecsContent(skillDir);

    // Generate code using LLM with appropriate prompt based on skill type
    let codeGenPrompt;
    switch (skillType) {
        case 'tskill':
            codeGenPrompt = buildCodeGenPrompt(skillName, content, sections, specsContent);
            break;
        case 'iskill':
            codeGenPrompt = buildIskillCodeGenPrompt(skillName, content, sections, specsContent);
            break;
        case 'oskill':
            codeGenPrompt = buildOskillCodeGenPrompt(skillName, content, sections, specsContent);
            break;
        case 'cskill':
            codeGenPrompt = buildCskillCodeGenPrompt(skillName, content, sections, specsContent);
            break;
        default:
            return `Error: No code generation prompt for skill type: ${skillType}`;
    }

    try {
        let generatedCode = await llmAgent.executePrompt(codeGenPrompt, {
            responseShape: 'code',
            mode: 'deep',
        });

        // Clean up response - remove markdown code blocks if present
        if (typeof generatedCode === 'string') {
            generatedCode = generatedCode
                .replace(/^```(?:javascript|js|mjs)?\n?/i, '')
                .replace(/\n?```$/i, '')
                .trim();
        }

        if (!generatedCode || typeof generatedCode !== 'string') {
            return 'Error: LLM returned empty or invalid code';
        }

        // Write the generated file - all types use .generated.mjs convention
        // tskill uses tskill.generated.mjs, others use skillName.generated.mjs
        const outFileName = skillType === 'tskill'
            ? 'tskill.generated.mjs'
            : `${skillName}.generated.mjs`;
        const outPath = path.join(skillDir, outFileName);

        fs.writeFileSync(outPath, generatedCode, 'utf8');

        return [
            `Generated: ${outFileName}`,
            `Path: ${outPath}`,
            `Size: ${generatedCode.length} bytes`,
            '',
            'Use test-code to verify the generated code works correctly.',
        ].join('\n');
    } catch (error) {
        return `Error generating code: ${error.message}`;
    }
}

export default action;
