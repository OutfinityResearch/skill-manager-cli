/**
 * Write Tests - Generates test files for skills
 *
 * Creates comprehensive .tests.mjs files that can be run with /run-tests
 */

import fs from 'node:fs';
import path from 'node:path';
import { detectSkillType, parseSkillSections, loadSpecsContent } from '../../schemas/skillSchemas.mjs';

/**
 * Parse input to extract skillName and options
 */
function parseInput(prompt) {
    if (!prompt) {
        return { skillName: null, options: {} };
    }

    if (typeof prompt === 'string') {
        const trimmed = prompt.trim();

        // Try JSON parse
        try {
            const parsed = JSON.parse(trimmed);
            return {
                skillName: parsed.skillName || parsed.name,
                options: parsed.options || {},
            };
        } catch (e) {
            // Not JSON, treat as skill name
            return { skillName: trimmed, options: {} };
        }
    }

    if (typeof prompt === 'object') {
        return {
            skillName: prompt.skillName || prompt.name,
            options: prompt.options || {},
        };
    }

    return { skillName: null, options: {} };
}

/**
 * Read generated code if it exists
 */
function readGeneratedCode(skillDir, skillType, skillName) {
    // Try different generated file patterns
    const patterns = [
        path.join(skillDir, 'tskill.generated.mjs'),
        path.join(skillDir, `${skillName}.generated.mjs`),
        path.join(skillDir, `${skillName}.mjs`),
    ];

    for (const filePath of patterns) {
        if (fs.existsSync(filePath)) {
            try {
                return {
                    path: filePath,
                    content: fs.readFileSync(filePath, 'utf8'),
                };
            } catch (e) {
                // Continue to next pattern
            }
        }
    }

    return null;
}

/**
 * Build test generation prompt for tskill
 */
function buildTskillTestPrompt(skillName, definition, sections, generatedCode, specsContent) {
    const generatedInfo = generatedCode
        ? `\n\n## Generated Code (${path.basename(generatedCode.path)})\n\`\`\`javascript\n${generatedCode.content}\n\`\`\``
        : '\n\nNo generated code found yet. Generate basic structural tests.';

    const specsInfo = specsContent
        ? `\n\n## Specifications (.specs.md)\n${specsContent}`
        : '';

    return `Generate a comprehensive test file for the "${skillName}" tskill (database table skill).

## Skill Definition
\`\`\`markdown
${definition}
\`\`\`
${specsInfo}${generatedInfo}

## Requirements

Create a test file that:
1. Exports a default async function that returns { passed: number, failed: number, errors: string[] }
2. Tests all validators (validator_*, validate_*)
3. Tests all presenters (presenter_*)
4. Tests all resolvers (resolver_*)
5. Tests all enumerators (enumerator_*)
6. Tests validateRecord() if present
7. Includes both positive tests (valid inputs) and negative tests (invalid inputs)
8. Uses descriptive test names

## Test File Template

\`\`\`javascript
/**
 * Tests for ${skillName} skill
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import the generated module
let skillModule;
try {
    skillModule = await import('../.AchillesSkills/${skillName}/tskill.generated.mjs');
} catch (e) {
    skillModule = null;
}

export default async function runTests() {
    const results = { passed: 0, failed: 0, errors: [] };

    async function test(name, fn) {
        try {
            await fn();
            results.passed++;
            console.log(\`  ✓ \${name}\`);
        } catch (error) {
            results.failed++;
            results.errors.push(\`\${name}: \${error.message}\`);
            console.log(\`  ✗ \${name}: \${error.message}\`);
        }
    }

    function assertEqual(actual, expected, message = '') {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            throw new Error(\`\${message}\\nExpected: \${JSON.stringify(expected)}\\nActual: \${JSON.stringify(actual)}\`);
        }
    }

    function assertTrue(value, message = 'Expected true') {
        if (!value) throw new Error(message);
    }

    function assertFalse(value, message = 'Expected false') {
        if (value) throw new Error(message);
    }

    console.log('\\n' + '═'.repeat(60));
    console.log('  ${skillName} Skill Tests');
    console.log('═'.repeat(60) + '\\n');

    if (!skillModule) {
        results.failed++;
        results.errors.push('Could not import skill module. Run /generate ${skillName} first.');
        return results;
    }

    // ADD YOUR TESTS HERE based on the skill definition

    console.log('\\n' + '─'.repeat(60));
    console.log(\`Results: \${results.passed} passed, \${results.failed} failed\`);
    console.log('─'.repeat(60) + '\\n');

    return results;
}
\`\`\`

Generate the complete test file with actual tests based on the skill definition. Output ONLY the JavaScript code, no markdown code blocks.`;
}

/**
 * Build test generation prompt for cskill/iskill/oskill
 */
function buildCodeSkillTestPrompt(skillName, skillType, definition, sections, generatedCode, specsContent) {
    const typeDesc = {
        cskill: 'code skill (LLM-generated code)',
        iskill: 'interactive skill (conversational)',
        oskill: 'orchestrator skill (routes to other skills)',
    }[skillType] || 'skill';

    const generatedInfo = generatedCode
        ? `\n\n## Generated/Implementation Code (${path.basename(generatedCode.path)})\n\`\`\`javascript\n${generatedCode.content}\n\`\`\``
        : '\n\nNo generated code found yet. Generate tests for the action function interface.';

    const specsInfo = specsContent
        ? `\n\n## Specifications (.specs.md)\n${specsContent}`
        : '';

    return `Generate a comprehensive test file for the "${skillName}" ${skillType} (${typeDesc}).

## Skill Definition
\`\`\`markdown
${definition}
\`\`\`
${specsInfo}${generatedInfo}

## Requirements

Create a test file that:
1. Exports a default async function that returns { passed: number, failed: number, errors: string[] }
2. Tests the action(agent, prompt) function with various inputs
3. Tests edge cases (empty input, invalid input, etc.)
4. Mocks the agent parameter appropriately
5. Uses descriptive test names

## Test File Template

\`\`\`javascript
/**
 * Tests for ${skillName} skill
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import the skill module
let skillModule;
try {
    skillModule = await import('../.AchillesSkills/${skillName}/${skillName}.mjs');
} catch (e) {
    try {
        skillModule = await import('../.AchillesSkills/${skillName}/${skillName}.generated.mjs');
    } catch (e2) {
        skillModule = null;
    }
}

// Mock agent for testing
function createMockAgent(overrides = {}) {
    return {
        findSkillFile: () => null,
        skillCatalog: new Map(),
        llmAgent: {
            executePrompt: async (prompt) => 'mock response',
        },
        context: { workingDir: __dirname },
        ...overrides,
    };
}

export default async function runTests() {
    const results = { passed: 0, failed: 0, errors: [] };

    async function test(name, fn) {
        try {
            await fn();
            results.passed++;
            console.log(\`  ✓ \${name}\`);
        } catch (error) {
            results.failed++;
            results.errors.push(\`\${name}: \${error.message}\`);
            console.log(\`  ✗ \${name}: \${error.message}\`);
        }
    }

    function assertEqual(actual, expected, message = '') {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            throw new Error(\`\${message}\\nExpected: \${JSON.stringify(expected)}\\nActual: \${JSON.stringify(actual)}\`);
        }
    }

    function assertTrue(value, message = 'Expected true') {
        if (!value) throw new Error(message);
    }

    function assertContains(str, substring, message = '') {
        if (!str || !str.includes(substring)) {
            throw new Error(\`\${message}\\nExpected "\${str}" to contain "\${substring}"\`);
        }
    }

    console.log('\\n' + '═'.repeat(60));
    console.log('  ${skillName} Skill Tests');
    console.log('═'.repeat(60) + '\\n');

    if (!skillModule) {
        results.failed++;
        results.errors.push('Could not import skill module');
        return results;
    }

    // ADD YOUR TESTS HERE based on the skill definition

    console.log('\\n' + '─'.repeat(60));
    console.log(\`Results: \${results.passed} passed, \${results.failed} failed\`);
    console.log('─'.repeat(60) + '\\n');

    return results;
}
\`\`\`

Generate the complete test file with actual tests based on the skill definition. Output ONLY the JavaScript code, no markdown code blocks.`;
}

/**
 * Main action function
 */
export async function action(recursiveSkilledAgent, prompt) {
    const llmAgent = recursiveSkilledAgent?.llmAgent;
    const { skillName, options } = parseInput(prompt);
    const force = options.force || false;

    if (!skillName) {
        return 'Error: skillName is required. Usage: /write-tests <skill-name>';
    }

    // Find the skill
    const skillInfo = recursiveSkilledAgent?.findSkillFile?.(skillName);
    if (!skillInfo) {
        return `Error: Skill "${skillName}" not found`;
    }

    const filePath = skillInfo.filePath;
    const skillDir = skillInfo.record?.skillDir || path.dirname(filePath);

    // Read skill definition
    let definition;
    try {
        definition = fs.readFileSync(filePath, 'utf8');
    } catch (error) {
        return `Error reading skill file: ${error.message}`;
    }

    // Detect skill type
    const skillType = detectSkillType(definition);
    if (!skillType) {
        return 'Error: Could not detect skill type';
    }

    // Determine tests directory and output path
    const workingDir = recursiveSkilledAgent?.context?.workingDir
        || recursiveSkilledAgent?.options?.startDir
        || process.cwd();

    const testsDir = path.join(workingDir, 'tests');
    const shortName = skillInfo.record?.shortName || skillName;
    const outPath = path.join(testsDir, `${shortName}.tests.mjs`);

    // Check if test file already exists
    if (fs.existsSync(outPath) && !force) {
        return `Test file already exists: ${outPath}\n\nUse { "force": true } to overwrite.`;
    }

    // Ensure tests directory exists
    if (!fs.existsSync(testsDir)) {
        fs.mkdirSync(testsDir, { recursive: true });
    }

    // Read generated code if available
    const generatedCode = readGeneratedCode(skillDir, skillType, skillName);

    // Load specs content if available
    const specsContent = loadSpecsContent(skillDir);

    // Parse sections
    const sections = parseSkillSections(definition);

    // Check LLM availability
    if (!llmAgent || typeof llmAgent.executePrompt !== 'function') {
        return 'Error: LLM agent not available for test generation';
    }

    // Build prompt based on skill type
    let testGenPrompt;
    if (skillType === 'tskill') {
        testGenPrompt = buildTskillTestPrompt(skillName, definition, sections, generatedCode, specsContent);
    } else {
        testGenPrompt = buildCodeSkillTestPrompt(skillName, skillType, definition, sections, generatedCode, specsContent);
    }

    // Generate tests using LLM
    try {
        let generatedTests = await llmAgent.executePrompt(testGenPrompt, {
            responseShape: 'code',
            mode: 'deep',
        });

        // Clean up response - remove markdown code blocks if present
        if (typeof generatedTests === 'string') {
            generatedTests = generatedTests
                .replace(/^```(?:javascript|js|mjs)?\n?/i, '')
                .replace(/\n?```$/i, '')
                .trim();
        }

        if (!generatedTests || typeof generatedTests !== 'string') {
            return 'Error: LLM returned empty or invalid test code';
        }

        // Write the test file
        fs.writeFileSync(outPath, generatedTests, 'utf8');

        const outputLines = [
            `Generated: ${path.basename(outPath)}`,
            `Path: ${outPath}`,
            `Skill: ${skillName} [${skillType}]`,
            `Size: ${generatedTests.length} bytes`,
            '',
            'Run tests with:',
            `  /run-tests ${shortName}`,
        ];

        return outputLines.join('\n');
    } catch (error) {
        return `Error generating tests: ${error.message}`;
    }
}

export default action;
