/**
 * Skill Refiner Prompts
 * Prompts used by the skill-refiner skill for the LoopAgentSession
 */

/**
 * Build the system prompt for the agentic session
 * @param {string} skillName - Name of the skill being refined
 * @param {Object} requirements - The requirements to meet
 * @param {string|null} specsContent - Optional .specs.md content
 * @returns {string} The system prompt
 */
export function buildSystemPrompt(skillName, requirements, specsContent = null) {
    const specsBlock = specsContent ? `
## Skill Specifications (.specs.md)
This skill has a specifications file that defines code generation requirements and constraints.
You can read it using the read_specs tool. These specifications MUST be respected.
` : '';

    const requirementsBlock = requirements && Object.keys(requirements).length > 0
        ? `## Requirements to Meet
${JSON.stringify(requirements, null, 2)}`
        : `## Requirements
All tests should pass without errors.
Generated code should be valid and follow best practices.`;

    return `You are an expert Skill Refiner agent. Your job is to iteratively improve the skill "${skillName}" until it meets all requirements and passes all tests.

## Your Capabilities
You have access to these tools:
- read_skill: Read the current skill definition
- generate_code: Generate .mjs code from tskill definitions
- test_code: Run tests on the generated code
- validate_skill: Validate the skill definition against its schema
- update_section: Update a specific section of the skill definition
- evaluate_requirements: Check if test results meet requirements
- read_specs: Read the .specs.md file if available
- final_answer: Report success when all requirements are met
- cannot_complete: Report failure if the skill cannot be fixed

## Workflow
1. **Read**: Start by reading the skill definition to understand its structure
2. **Generate**: If it's a tskill, generate the .mjs code
3. **Test**: Run tests to check for errors
4. **Evaluate**: Use evaluate_requirements to check if tests meet requirements
5. **Fix**: If there are failures, analyze them and use update_section to fix issues
6. **Repeat**: Continue until all requirements are met or you determine it cannot be fixed

## Important Guidelines
- Always read the skill first before making changes
- For tskills, always regenerate code after updating sections
- Be specific when updating sections - don't change working code
- If a test fails, analyze the error message carefully
- Look at the .specs.md file for code generation constraints
- Maximum attempts should be respected - don't loop forever

${specsBlock}

${requirementsBlock}

## Success Criteria
- All tests pass
- No validation errors
- Requirements are satisfied
- Generated code follows specifications

When you achieve success, call final_answer with a summary.
If you cannot fix the skill after multiple attempts, call cannot_complete with the reason.`;
}

/**
 * Build the prompt for evaluating test results against requirements
 * @param {*} testResult - The result from running tests
 * @param {Object} requirements - The requirements to check against
 * @param {string|null} specsContent - Optional .specs.md content
 * @returns {string} The prompt for the LLM
 */
export function buildEvaluationPrompt(testResult, requirements, specsContent = null) {
    const specsBlock = specsContent ? `
## Skill Specifications
${specsContent}

---
` : '';

    return `Evaluate if this test result meets the requirements.
${specsBlock}
## Requirements:
${JSON.stringify(requirements, null, 2)}

## Test Result:
${typeof testResult === 'string' ? testResult : JSON.stringify(testResult, null, 2)}

## Instructions:
Analyze if the test passed and meets all requirements.
Identify any failures or issues that need to be fixed.

Respond in JSON format:
{
    "success": true/false,
    "failures": [
        { "section": "Section Name", "field": "field_name", "reason": "what went wrong" }
    ],
    "suggestions": ["suggestion 1", "suggestion 2"]
}`;
}

/**
 * Build the prompt for generating fixes based on failures
 * @param {string} skillContent - The current skill definition content
 * @param {Array} failures - Array of failure objects from evaluation
 * @param {Array} history - Array of previous iteration results
 * @param {string|null} specsContent - Optional .specs.md content
 * @returns {string} The prompt for the LLM
 */
export function buildFixesPrompt(skillContent, failures, history, specsContent = null) {
    const historyContext = history.map((h, i) =>
        `Iteration ${i + 1}: ${h.evaluation?.failures?.map(f => f.reason).join(', ') || 'No failures recorded'}`
    ).join('\n');

    const specsBlock = specsContent ? `
## Skill Specifications
These specifications must be respected:

${specsContent}

---
` : '';

    return `You need to fix a skill definition based on test failures.
${specsBlock}
## Current Skill Definition:
${skillContent}

## Failures to Fix:
${JSON.stringify(failures, null, 2)}

## Previous Attempts:
${historyContext || 'This is the first attempt'}

## Instructions:
1. Analyze each failure
2. Determine which sections need to be modified
3. Generate the fixed content for each section

Respond in JSON format:
{
    "fixes": [
        {
            "section": "Section Name",
            "content": "The new content for this section"
        }
    ],
    "explanation": "Brief explanation of what was fixed"
}`;
}

export default {
    buildSystemPrompt,
    buildEvaluationPrompt,
    buildFixesPrompt,
};
