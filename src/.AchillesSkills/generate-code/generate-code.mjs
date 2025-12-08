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
import { runTestFile } from '../../lib/testDiscovery.mjs';
import { formatTestResult } from '../../ui/TestResultFormatter.mjs';

const SUPPORTED_TYPES = ['tskill', 'iskill', 'oskill', 'cskill'];

/**
 * Check if regeneration is needed by comparing file modification times.
 * Returns true if sources are newer than the generated file.
 * @param {string} generatedPath - Path to the .generated.mjs file
 * @param {string[]} sourcePaths - Paths to source files (.md, .specs.md, etc.)
 * @returns {{needsRegen: boolean, reason: string}}
 */
function checkNeedsRegeneration(generatedPath, sourcePaths) {
    // If generated file doesn't exist, we need to generate
    if (!fs.existsSync(generatedPath)) {
        return { needsRegen: true, reason: 'generated file does not exist' };
    }

    let generatedMtime;
    try {
        generatedMtime = fs.statSync(generatedPath).mtimeMs;
    } catch (error) {
        return { needsRegen: true, reason: 'could not stat generated file' };
    }

    // Check each source file
    for (const sourcePath of sourcePaths) {
        if (!fs.existsSync(sourcePath)) {
            continue; // Skip non-existent optional files like .specs.md
        }

        try {
            const sourceMtime = fs.statSync(sourcePath).mtimeMs;
            if (sourceMtime > generatedMtime) {
                const fileName = path.basename(sourcePath);
                return { needsRegen: true, reason: `${fileName} is newer than generated file` };
            }
        } catch (error) {
            // If we can't stat a source file, assume we need to regenerate
            return { needsRegen: true, reason: `could not stat source file: ${sourcePath}` };
        }
    }

    return { needsRegen: false, reason: 'generated file is up to date' };
}

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

    // Determine output file path
    const outFileName = skillType === 'tskill'
        ? 'tskill.generated.mjs'
        : `${skillName}.generated.mjs`;
    const outPath = path.join(skillDir, outFileName);

    // Build list of source files to check (skill definition + optional specs)
    const specsPath = path.join(skillDir, '.specs.md');
    const sourcePaths = [filePath];
    if (fs.existsSync(specsPath)) {
        sourcePaths.push(specsPath);
    }

    // Check if regeneration is needed based on file timestamps
    const { needsRegen, reason } = checkNeedsRegeneration(outPath, sourcePaths);
    if (!needsRegen) {
        return `Skipped: ${outFileName} is up to date (no source files modified since last generation)`;
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

        // Write the generated file
        fs.writeFileSync(outPath, generatedCode, 'utf8');

        const outputLines = [
            `Generated: ${outFileName}`,
            `Path: ${outPath}`,
            `Size: ${generatedCode.length} bytes`,
        ];

        // Auto-run tests from the tests folder in the working directory
        const workingDir = recursiveSkilledAgent?.startDir || process.cwd();
        const testsDir = path.join(workingDir, 'tests');

        // Look for test files matching the skill name
        const testPatterns = [
            path.join(testsDir, `${skillName}.test.mjs`),
            path.join(testsDir, `${skillName}.tests.mjs`),
        ];

        const testFile = testPatterns.find(f => fs.existsSync(f));

        if (testFile) {
            outputLines.push('');
            outputLines.push(`[Auto-running tests from ${path.relative(workingDir, testFile)}...]`);

            try {
                const testResult = await runTestFile(testFile, {
                    timeout: 30000,
                    verbose: false,
                });

                // Add skill info to result for formatting
                const fullResult = {
                    skillName,
                    skillType,
                    ...testResult,
                };

                outputLines.push(formatTestResult(fullResult));
            } catch (testError) {
                outputLines.push(`Test error: ${testError.message}`);
            }
        } else {
            outputLines.push('');
            outputLines.push(`No test file found for "${skillName}" in tests/ folder.`);
        }

        return outputLines.join('\n');
    } catch (error) {
        return `Error generating code: ${error.message}`;
    }
}

export default action;
