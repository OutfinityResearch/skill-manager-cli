/**
 * Skill Refiner - Iteratively improves skill definitions until requirements are met
 *
 * Uses LoopAgentSession for intelligent, LLM-driven refinement loop.
 * The agent decides when to read, generate, test, evaluate, and fix.
 */

import fs from 'node:fs';
import path from 'node:path';
import { LoopAgentSession } from 'achilles-agent-lib/LLMAgents/AgenticSession.mjs';
import { detectSkillType, loadSpecsContent } from '../../schemas/skillSchemas.mjs';
import { buildSystemPrompt, buildEvaluationPrompt } from './skillRefiner.prompts.mjs';
import { runTestFile } from '../../lib/testDiscovery.mjs';
import { formatTestResult } from '../../ui/TestResultFormatter.mjs';

/**
 * Parse input to extract skill name, requirements, and options
 */
function parseInput(prompt) {
    if (typeof prompt === 'string') {
        try {
            return JSON.parse(prompt);
        } catch (e) {
            return { skillName: prompt.trim() };
        }
    }
    return prompt || {};
}

/**
 * Build tools for the agentic session
 */
function buildTools(recursiveSkilledAgent, skillName, skillInfo, requirements, specsContent) {
    const filePath = skillInfo.filePath;
    const skillDir = skillInfo.record?.skillDir || path.dirname(filePath);

    return {
        'read_skill': {
            description: `Read the current skill definition for "${skillName}". Returns the full content of the skill file.`,
            handler: async (agent, input) => {
                try {
                    const content = fs.readFileSync(filePath, 'utf8');
                    const skillType = detectSkillType(content);
                    return JSON.stringify({
                        success: true,
                        skillName,
                        skillType,
                        filePath,
                        content,
                        specsAvailable: !!specsContent
                    });
                } catch (error) {
                    return JSON.stringify({
                        success: false,
                        error: `Failed to read skill: ${error.message}`
                    });
                }
            }
        },

        'generate_code': {
            description: `Generate .mjs code from the tskill definition. Only use for tskill type skills.`,
            handler: async (agent, input) => {
                try {
                    const result = await recursiveSkilledAgent.executePrompt(skillName, {
                        skillName: 'generate-code',
                    });

                    // Extract meaningful result
                    const output = result?.result?.output || result?.result || result;
                    return JSON.stringify({
                        success: true,
                        message: 'Code generated successfully',
                        output: typeof output === 'string' ? output.slice(0, 500) : output
                    });
                } catch (error) {
                    return JSON.stringify({
                        success: false,
                        error: `Code generation failed: ${error.message}`
                    });
                }
            }
        },

        'test_code': {
            description: `Test the generated code for "${skillName}". Returns test results including any errors.`,
            handler: async (agent, input) => {
                try {
                    const testInput = requirements?.testInput || {};
                    const result = await recursiveSkilledAgent.executePrompt(
                        JSON.stringify({ skillName, testInput }),
                        { skillName: 'test-code' }
                    );

                    const output = result?.result?.output || result?.result || result;
                    return JSON.stringify({
                        success: true,
                        testResult: typeof output === 'string' ? output : JSON.stringify(output)
                    });
                } catch (error) {
                    return JSON.stringify({
                        success: false,
                        error: `Test failed: ${error.message}`
                    });
                }
            }
        },

        'run_skill_tests': {
            description: `Run the .tests.mjs file for "${skillName}" if it exists. Returns structured test results with pass/fail counts and errors. Prefer this over test_code when a .tests.mjs file exists.`,
            handler: async (agent, input) => {
                const testFile = path.join(skillDir, '.tests.mjs');

                if (!fs.existsSync(testFile)) {
                    return JSON.stringify({
                        success: false,
                        hasTestFile: false,
                        message: `No .tests.mjs file found for "${skillName}". Create one or use test_code instead.`
                    });
                }

                try {
                    const result = await runTestFile(testFile, {
                        timeout: 30000,
                        verbose: true,
                    });

                    // Format for LLM consumption
                    const content = detectSkillType(fs.readFileSync(filePath, 'utf8'));

                    return JSON.stringify({
                        success: result.success,
                        hasTestFile: true,
                        skillName,
                        skillType: content,
                        passed: result.passed || 0,
                        failed: result.failed || 0,
                        duration: result.duration,
                        errors: result.errors || [],
                        output: result.output,
                        formatted: formatTestResult({
                            skillName,
                            skillType: content,
                            ...result
                        })
                    });
                } catch (error) {
                    return JSON.stringify({
                        success: false,
                        hasTestFile: true,
                        error: `Test execution failed: ${error.message}`
                    });
                }
            }
        },

        'validate_skill': {
            description: `Validate the skill definition against its schema. Returns validation errors if any.`,
            handler: async (agent, input) => {
                try {
                    const result = await recursiveSkilledAgent.executePrompt(skillName, {
                        skillName: 'validate-skill',
                    });

                    const output = result?.result?.output || result?.result || result;
                    return JSON.stringify({
                        success: true,
                        validation: typeof output === 'string' ? output : JSON.stringify(output)
                    });
                } catch (error) {
                    return JSON.stringify({
                        success: false,
                        error: `Validation failed: ${error.message}`
                    });
                }
            }
        },

        'update_section': {
            description: `Update a specific section of the skill definition. Input must be JSON: {"section": "Section Name", "content": "new content"}`,
            handler: async (agent, input) => {
                try {
                    let parsed;
                    try {
                        parsed = JSON.parse(input);
                    } catch {
                        return JSON.stringify({
                            success: false,
                            error: 'Input must be valid JSON with "section" and "content" fields'
                        });
                    }

                    const { section, content } = parsed;
                    if (!section || !content) {
                        return JSON.stringify({
                            success: false,
                            error: 'Both "section" and "content" are required'
                        });
                    }

                    const result = await recursiveSkilledAgent.executePrompt(
                        JSON.stringify({ skillName, section, content }),
                        { skillName: 'update-section' }
                    );

                    const output = result?.result?.output || result?.result || result;
                    return JSON.stringify({
                        success: true,
                        message: `Updated section "${section}"`,
                        output: typeof output === 'string' ? output : JSON.stringify(output)
                    });
                } catch (error) {
                    return JSON.stringify({
                        success: false,
                        error: `Update failed: ${error.message}`
                    });
                }
            }
        },

        'evaluate_requirements': {
            description: `Evaluate if the current test results meet the requirements. Input: the test result to evaluate.`,
            handler: async (agent, input) => {
                const llmAgent = recursiveSkilledAgent?.llmAgent;
                if (!llmAgent) {
                    return JSON.stringify({
                        success: false,
                        error: 'LLM agent not available for evaluation'
                    });
                }

                const evalPrompt = buildEvaluationPrompt(input, requirements, specsContent);

                try {
                    const response = await llmAgent.executePrompt(evalPrompt, {
                        responseShape: 'json',
                        mode: 'fast',
                    });

                    const evaluation = typeof response === 'string' ? JSON.parse(response) : response;
                    return JSON.stringify({
                        success: true,
                        evaluation
                    });
                } catch (error) {
                    return JSON.stringify({
                        success: false,
                        error: `Evaluation failed: ${error.message}`
                    });
                }
            }
        },

        'read_specs': {
            description: `Read the .specs.md file for "${skillName}" if available. Contains code generation requirements and constraints.`,
            handler: async (agent, input) => {
                if (!specsContent) {
                    return JSON.stringify({
                        success: false,
                        message: 'No .specs.md file available for this skill'
                    });
                }
                return JSON.stringify({
                    success: true,
                    specs: specsContent
                });
            }
        }
    };
}

/**
 * Main action function for the skill refiner using LoopAgentSession
 */
export async function action(recursiveSkilledAgent, prompt) {
    const llmAgent = recursiveSkilledAgent?.llmAgent;

    // Parse input
    const {
        skillName,
        requirements = {},
        maxIterations = 5,
    } = parseInput(prompt);

    if (!skillName) {
        return 'Error: skillName is required. Usage: skill-refiner {skillName, requirements?, maxIterations?}';
    }

    if (!llmAgent) {
        return 'Error: LLM agent not available for skill refinement';
    }

    // Find the skill
    const skillInfo = recursiveSkilledAgent?.findSkillFile?.(skillName);
    if (!skillInfo) {
        return `Error: Skill "${skillName}" not found`;
    }

    const skillDir = skillInfo.record?.skillDir || path.dirname(skillInfo.filePath);
    const specsContent = loadSpecsContent(skillDir);

    // Build tools
    const tools = buildTools(recursiveSkilledAgent, skillName, skillInfo, requirements, specsContent);

    // Build system prompt
    const systemPrompt = buildSystemPrompt(skillName, requirements, specsContent);

    // Create agentic session
    const session = new LoopAgentSession({
        agent: llmAgent,
        tools,
        options: {
            maxStepsPerTurn: maxIterations * 4, // Allow multiple tool calls per iteration
            maxErrors: 5,
            mode: 'deep',
            systemPrompt,
        }
    });

    console.log(`[SkillRefiner] Starting refinement of "${skillName}"`);
    console.log(`[SkillRefiner] Max iterations: ${maxIterations}`);
    console.log(`[SkillRefiner] Requirements: ${JSON.stringify(requirements)}`);

    try {
        // Run the agentic session
        const initialPrompt = `Refine the skill "${skillName}" until it meets all requirements and tests pass.

Your workflow should be:
1. First, read_skill to understand the current definition
2. If it's a tskill, use generate_code to create the .mjs file
3. Run tests using either:
   - run_skill_tests (preferred) - runs .tests.mjs file if available
   - test_code - runs basic code tests
4. Use evaluate_requirements to check if tests meet requirements
5. If evaluation shows failures, use update_section to fix the problematic sections
6. Repeat steps 2-5 until all requirements are met

${specsContent ? 'Note: This skill has a .specs.md file with additional requirements. Use read_specs to view them.' : ''}

Requirements to meet:
${JSON.stringify(requirements, null, 2) || 'All tests should pass without errors.'}

Start by reading the skill definition.`;

        const result = await session.newPrompt(initialPrompt);

        // Analyze session results
        const hasFailures = session.hasFailedTurns();
        const toolCallCount = session.toolCalls?.length || 0;

        // Build summary
        const summary = {
            success: !hasFailures,
            skillName,
            iterations: Math.ceil(toolCallCount / 4), // Approximate iterations
            toolCalls: toolCallCount,
            finalResult: result,
            history: session.toolCalls?.map(tc => ({
                tool: tc.tool,
                result: typeof tc.result === 'string'
                    ? tc.result.slice(0, 200)
                    : JSON.stringify(tc.result).slice(0, 200)
            }))
        };

        if (hasFailures) {
            summary.reason = 'refinement_incomplete';
            summary.failedTurns = session.failedTurns?.length || 0;
        }

        console.log(`[SkillRefiner] Completed: ${summary.success ? 'SUCCESS' : 'INCOMPLETE'}`);
        console.log(`[SkillRefiner] Tool calls: ${toolCallCount}`);

        return summary;

    } catch (error) {
        console.error(`[SkillRefiner] Error: ${error.message}`);
        return {
            success: false,
            skillName,
            error: error.message,
            history: session.toolCalls || []
        };
    }
}

export default action;
