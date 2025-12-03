/**
 * Skill Refiner - Iteratively improves skill definitions until requirements are met
 *
 * This orchestrator implements the loop:
 * read skill → generate code → test → evaluate → fix → repeat
 */

import fs from 'node:fs';
import path from 'node:path';
import { detectSkillType, parseSkillSections, loadSpecsContent } from '../../skillSchemas.mjs';
import { buildEvaluationPrompt, buildFixesPrompt } from './skillRefiner.prompts.mjs';

/**
 * Parse input to extract skill name, requirements, and options
 */
function parseInput(prompt) {
    if (typeof prompt === 'string') {
        // Try to parse as JSON
        try {
            return JSON.parse(prompt);
        } catch (e) {
            // Treat as skill name with default options
            return { skillName: prompt.trim() };
        }
    }
    return prompt || {};
}

/**
 * Evaluate test results using LLM
 */
async function evaluateWithLLM(testResult, requirements, llmAgent, specsContent = null) {
    const evalPrompt = buildEvaluationPrompt(testResult, requirements, specsContent);

    try {
        const response = await llmAgent.executePrompt(evalPrompt, {
            responseShape: 'json',
            mode: 'fast',
        });

        if (typeof response === 'string') {
            return JSON.parse(response);
        }
        return response;
    } catch (error) {
        return {
            success: false,
            failures: [{ section: 'Evaluation', field: null, reason: error.message }],
            suggestions: ['Check LLM connectivity'],
        };
    }
}

/**
 * Generate section updates based on failures
 */
async function generateFixes(skillContent, failures, history, llmAgent, specsContent = null) {
    const fixesPrompt = buildFixesPrompt(skillContent, failures, history, specsContent);

    try {
        const response = await llmAgent.executePrompt(fixesPrompt, {
            responseShape: 'json',
            mode: 'deep',
        });

        if (typeof response === 'string') {
            return JSON.parse(response);
        }
        return response;
    } catch (error) {
        return {
            fixes: [],
            explanation: `Failed to generate fixes: ${error.message}`,
        };
    }
}

/**
 * Main action function for the skill refiner
 */
export async function action(recursiveSkilledAgent, prompt) {
    // Get llmAgent from the recursiveSkilledAgent
    const llmAgent = recursiveSkilledAgent?.llmAgent;

    // Parse input
    const {
        skillName,
        requirements = {},
        maxIterations = 5,
        evaluator = 'llm',
    } = parseInput(prompt);

    if (!skillName) {
        return 'Error: skillName is required. Usage: skill-refiner {skillName, requirements?, maxIterations?}';
    }

    if (!llmAgent) {
        return 'Error: LLM agent not available for skill refinement';
    }

    // Use findSkillFile to locate the skill
    const skillInfo = recursiveSkilledAgent?.findSkillFile?.(skillName);

    if (!skillInfo) {
        return `Error: Skill "${skillName}" not found`;
    }

    const filePath = skillInfo.filePath;
    const skillDir = skillInfo.record?.skillDir || path.dirname(filePath);

    // Load specs content if available
    const specsContent = loadSpecsContent(skillDir);

    const history = [];
    const output = [];

    output.push(`Starting refinement of "${skillName}"`);
    output.push(`Max iterations: ${maxIterations}`);
    output.push(`Requirements: ${JSON.stringify(requirements)}`);
    output.push('');

    for (let iteration = 0; iteration < maxIterations; iteration++) {
        output.push(`--- Iteration ${iteration + 1}/${maxIterations} ---`);

        // 1. Read current skill content
        let skillContent;
        try {
            skillContent = fs.readFileSync(filePath, 'utf8');
        } catch (error) {
            output.push(`Error reading skill: ${error.message}`);
            break;
        }

        const skillType = detectSkillType(skillContent);
        output.push(`Skill type: ${skillType}`);

        // 2. Generate code if tskill
        let generateResult = null;
        if (skillType === 'tskill') {
            output.push('Generating code...');
            try {
                // Use the generate-code skill
                const generateSkill = recursiveSkilledAgent?.getSkillRecord?.('generate-code');
                if (generateSkill) {
                    generateResult = await recursiveSkilledAgent.executePrompt(skillName, {
                        skillName: 'generate-code',
                    });
                } else {
                    // Fallback: direct generation
                    output.push('(generate-code skill not found, skipping)');
                }
            } catch (error) {
                output.push(`Code generation error: ${error.message}`);
            }
        }

        // 3. Test the code
        let testResult = null;
        output.push('Testing code...');
        try {
            const testSkill = recursiveSkilledAgent?.getSkillRecord?.('test-code');
            if (testSkill) {
                testResult = await recursiveSkilledAgent.executePrompt(
                    JSON.stringify({ skillName, testInput: requirements.testInput }),
                    { skillName: 'test-code' }
                );
            } else {
                testResult = 'Test skill not available';
            }
            output.push(`Test result: ${typeof testResult === 'string' ? testResult.slice(0, 200) : 'OK'}`);
        } catch (error) {
            testResult = `Test error: ${error.message}`;
            output.push(testResult);
        }

        // 4. Evaluate results
        output.push('Evaluating results...');
        const evaluation = await evaluateWithLLM(testResult, requirements, llmAgent, specsContent);

        history.push({
            iteration,
            skillContent,
            testResult,
            evaluation,
        });

        // 5. Check for success
        if (evaluation.success) {
            output.push('SUCCESS: Requirements met!');
            output.push('');
            return {
                success: true,
                iterations: iteration + 1,
                output: output.join('\n'),
                history,
            };
        }

        output.push(`Failures: ${evaluation.failures?.length || 0}`);
        evaluation.failures?.forEach(f => {
            output.push(`  - ${f.section || 'Unknown'}: ${f.reason}`);
        });

        // 6. Check if last iteration
        if (iteration >= maxIterations - 1) {
            output.push('Max iterations reached');
            break;
        }

        // 7. Generate and apply fixes
        output.push('Generating fixes...');
        const fixes = await generateFixes(skillContent, evaluation.failures, history, llmAgent, specsContent);

        if (!fixes.fixes || fixes.fixes.length === 0) {
            output.push('No fixes generated, stopping');
            break;
        }

        output.push(`Applying ${fixes.fixes.length} fix(es)...`);
        for (const fix of fixes.fixes) {
            if (fix.section && fix.content) {
                // Apply fix using update-section logic
                const { updateSkillSection } = await import('../../skillSchemas.mjs');
                skillContent = updateSkillSection(skillContent, fix.section, fix.content);
                output.push(`  - Fixed: ${fix.section}`);
            }
        }

        // Write updated content
        try {
            fs.writeFileSync(filePath, skillContent, 'utf8');
            output.push('Updated skill file');
        } catch (error) {
            output.push(`Error writing fixes: ${error.message}`);
            break;
        }

        output.push('');
    }

    return {
        success: false,
        iterations: history.length,
        reason: 'max_iterations_reached',
        output: output.join('\n'),
        history,
    };
}

export default action;
