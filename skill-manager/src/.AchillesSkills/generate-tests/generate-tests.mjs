/**
 * Generate Tests - Creates comprehensive test files from cskill specifications
 *
 * Reads cskill.md and specs/*.md to generate .tests.mjs files with test cases
 * covering examples, constraints, error handling, and edge cases.
 *
 * Specifically designed for cskill (code skill) types that use the specs/ folder
 * for natural language specifications.
 */

import fs from 'node:fs';
import path from 'node:path';
import { detectSkillType, parseSkillSections } from '../../schemas/skillSchemas.mjs';

/**
 * Parse input to extract skillName and options
 * @param {string|object} prompt - User input
 * @returns {{skillName: string|null, options: object}}
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
 * Recursively read all .md files from the specs/ folder
 * @param {string} skillDir - Path to the skill directory
 * @returns {Array<{relativePath: string, content: string}>}
 */
function readSpecsFolder(skillDir) {
    const specsDir = path.join(skillDir, 'specs');
    if (!fs.existsSync(specsDir)) {
        return [];
    }

    const specs = [];

    function walkDir(dir, prefix = '') {
        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch (e) {
            return;
        }

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

            if (entry.isDirectory()) {
                walkDir(fullPath, relativePath);
            } else if (entry.name.endsWith('.md')) {
                try {
                    const content = fs.readFileSync(fullPath, 'utf8');
                    specs.push({ relativePath, content });
                } catch (e) {
                    // Skip unreadable files
                }
            }
        }
    }

    walkDir(specsDir);
    return specs;
}

/**
 * Read generated source files from src/ folder
 * @param {string} skillDir - Path to the skill directory
 * @returns {Array<{name: string, content: string}>}
 */
function readSrcFolder(skillDir) {
    const srcDir = path.join(skillDir, 'src');
    if (!fs.existsSync(srcDir)) {
        return [];
    }

    const files = [];
    let entries;
    try {
        entries = fs.readdirSync(srcDir, { withFileTypes: true });
    } catch (e) {
        return files;
    }

    for (const entry of entries) {
        if (entry.isFile() && (entry.name.endsWith('.mjs') || entry.name.endsWith('.js'))) {
            const filePath = path.join(srcDir, entry.name);
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                files.push({ name: entry.name, content });
            } catch (e) {
                // Skip unreadable files
            }
        }
    }

    return files;
}

/**
 * Build comprehensive test generation prompt for cskill
 * @param {string} skillName - Name of the skill
 * @param {string} definition - Content of cskill.md
 * @param {object} sections - Parsed sections from cskill.md
 * @param {Array} specsFolder - Array of spec files
 * @param {Array} srcFiles - Array of generated source files
 * @returns {string} - LLM prompt for test generation
 */
function buildCskillTestPrompt(skillName, definition, sections, specsFolder, srcFiles) {
    const specsInfo = specsFolder.length > 0
        ? specsFolder.map(s =>
            `### specs/${s.relativePath}\n\`\`\`markdown\n${s.content}\n\`\`\``
        ).join('\n\n')
        : 'No specs files found in specs/ folder.';

    const srcInfo = srcFiles.length > 0
        ? srcFiles.map(s =>
            `### src/${s.name}\n\`\`\`javascript\n${s.content}\n\`\`\``
        ).join('\n\n')
        : 'No generated source files found. Run /generate first.';

    const inputFormat = sections['Input Format'] || 'Not specified';
    const outputFormat = sections['Output Format'] || 'Not specified';
    const constraints = sections['Constraints'] || 'None specified';
    const examples = sections['Examples'] || 'None provided';

    return `Generate a comprehensive test file for the "${skillName}" cskill (code skill).

## Skill Definition (cskill.md)
\`\`\`markdown
${definition}
\`\`\`

## Specification Files (from specs/ folder)
${specsInfo}

## Generated Source Files (from src/ folder)
${srcInfo}

## Key Sections from cskill.md

### Input Format
${inputFormat}

### Output Format
${outputFormat}

### Constraints
${constraints}

### Examples
${examples}

## Requirements

Create a test file that:
1. Exports a default async function returning { passed: number, failed: number, errors: string[] }
2. Tests ALL examples from the Examples section
3. Tests constraint violations (edge cases that should produce errors)
4. Tests error handling from the specs (error messages, graceful failures)
5. Tests each operation defined in the specs
6. Uses descriptive test names
7. Executes the skill via child process using spawn

## Test File Template

\`\`\`javascript
/**
 * Tests for ${skillName} skill
 * Generated from cskill.md and specs/*.md
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the skill's src/index.mjs
const skillSrcDir = path.join(__dirname, '..', '.AchillesSkills', '${skillName}', 'src');
const indexPath = path.join(skillSrcDir, 'index.mjs');

/**
 * Execute the skill with given args
 * @param {object} args - Arguments to pass to the skill
 * @returns {Promise<string>} - Result from the skill
 */
async function executeSkill(args) {
    return new Promise((resolve, reject) => {
        const child = spawn('node', [indexPath, JSON.stringify(args)], {
            cwd: skillSrcDir,
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => { stdout += data; });
        child.stderr.on('data', (data) => { stderr += data; });

        child.on('close', (code) => {
            const output = stdout.trim();
            try {
                resolve(JSON.parse(output));
            } catch (e) {
                resolve(output);
            }
        });

        child.on('error', (err) => {
            reject(new Error(\`Failed to execute skill: \${err.message}\`));
        });
    });
}

export default async function runTests() {
    const results = { passed: 0, failed: 0, errors: [] };

    async function test(name, fn) {
        try {
            await fn();
            results.passed++;
            console.log(\`  \\u2713 \${name}\`);
        } catch (error) {
            results.failed++;
            results.errors.push(\`\${name}: \${error.message}\`);
            console.log(\`  \\u2717 \${name}: \${error.message}\`);
        }
    }

    function assertEqual(actual, expected, message = '') {
        const actualStr = JSON.stringify(actual);
        const expectedStr = JSON.stringify(expected);
        if (actualStr !== expectedStr) {
            throw new Error(\`\${message}\\nExpected: \${expectedStr}\\nActual: \${actualStr}\`);
        }
    }

    function assertTrue(value, message = 'Expected true') {
        if (!value) throw new Error(message);
    }

    function assertContains(str, substring, message = '') {
        if (!str || !String(str).includes(substring)) {
            throw new Error(\`\${message}\\nExpected "\${str}" to contain "\${substring}"\`);
        }
    }

    console.log('\\n' + '='.repeat(60));
    console.log('  ${skillName} Skill Tests');
    console.log('='.repeat(60) + '\\n');

    // === EXAMPLE-BASED TESTS ===
    // Generate tests for each example from the Examples section

    // === CONSTRAINT TESTS ===
    // Generate tests for constraint violations

    // === ERROR HANDLING TESTS ===
    // Generate tests for error scenarios from specs

    // === EDGE CASE TESTS ===
    // Generate tests for: empty input, null values, missing fields, invalid types

    console.log('\\n' + '-'.repeat(60));
    console.log(\`Results: \${results.passed} passed, \${results.failed} failed\`);
    console.log('-'.repeat(60) + '\\n');

    return results;
}
\`\`\`

IMPORTANT:
- Generate ACTUAL test cases based on the Examples section - convert each example into a test
- Each constraint should have at least one test verifying it's enforced
- Include edge cases for empty input, missing required fields, invalid types
- Error messages should match what's defined in the specs
- Use descriptive test names that explain what's being tested

Output ONLY the JavaScript code, no markdown code blocks.`;
}

/**
 * Main action function
 * @param {object} recursiveSkilledAgent - The agent instance
 * @param {string|object} prompt - User input
 * @returns {Promise<string>} - Result message
 */
export async function action(recursiveSkilledAgent, prompt) {
    const llmAgent = recursiveSkilledAgent?.llmAgent;
    const { skillName, options } = parseInput(prompt);
    const force = options.force || false;

    if (!skillName) {
        return 'Error: skillName is required.\n\nUsage: /gen-tests <skill-name>\n\nGenerates test file from cskill.md and specs/*.md';
    }

    // Find the skill
    const skillInfo = recursiveSkilledAgent?.findSkillFile?.(skillName);
    if (!skillInfo) {
        return `Error: Skill "${skillName}" not found.\n\nMake sure the skill exists in a .AchillesSkills directory.`;
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

    // Detect skill type - this skill is specifically for cskill
    const skillType = detectSkillType(definition);
    if (skillType !== 'cskill') {
        return `Error: generate-tests is designed for cskill types.\n\nThis skill is type: ${skillType || 'unknown'}\n\nUse /write-tests for other skill types.`;
    }

    // Check for specs folder
    const specsFolder = readSpecsFolder(skillDir);
    if (specsFolder.length === 0) {
        return `Error: No specs found in ${skillDir}/specs/\n\ngenerate-tests requires a specs/ folder with .md specification files.\n\nAlternatively, use /write-tests for skills without specs.`;
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
        return `Test file already exists: ${outPath}\n\nUse { "force": true } or /gen-tests ${skillName} --force to overwrite.`;
    }

    // Ensure tests directory exists
    if (!fs.existsSync(testsDir)) {
        fs.mkdirSync(testsDir, { recursive: true });
    }

    // Read src folder (generated code)
    const srcFiles = readSrcFolder(skillDir);

    // Parse sections
    const sections = parseSkillSections(definition);

    // Check LLM availability
    if (!llmAgent || typeof llmAgent.executePrompt !== 'function') {
        return 'Error: LLM agent not available for test generation.\n\nThis skill requires an LLM to generate tests.';
    }

    // Build prompt
    const testGenPrompt = buildCskillTestPrompt(
        skillName,
        definition,
        sections,
        specsFolder,
        srcFiles
    );

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
            return 'Error: LLM returned empty or invalid test code.\n\nTry again or check the skill definition.';
        }

        // Count approximate number of tests
        const testCount = (generatedTests.match(/await test\(/g) || []).length;

        // Write the test file
        fs.writeFileSync(outPath, generatedTests, 'utf8');

        const outputLines = [
            `Generated: ${path.basename(outPath)}`,
            `Path: ${outPath}`,
            `Skill: ${skillName} [cskill]`,
            `Specs read: ${specsFolder.length} file(s)`,
            `Src files: ${srcFiles.length} file(s)`,
            `Tests: ~${testCount} test case(s)`,
            `Size: ${generatedTests.length} bytes`,
            '',
            'Run tests with:',
            `  /run-tests ${shortName}`,
            '',
            'Refine skill if tests fail:',
            `  /refine ${shortName}`,
        ];

        return outputLines.join('\n');
    } catch (error) {
        return `Error generating tests: ${error.message}`;
    }
}

export default action;
