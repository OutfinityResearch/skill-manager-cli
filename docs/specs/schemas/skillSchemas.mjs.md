# Design Spec: src/schemas/skillSchemas.mjs

ID: DS(/schemas/skillSchemas.mjs)

## Overview

**Role**: Defines the structure, validation rules, and templates for each skill type. Also provides utilities for loading and formatting skill specification files (`.specs.md`).

**Pattern**: Static configuration objects with pure validation functions.

**Key Collaborators**:
- Built-in skills (validate-skill, write-skill, generate-code) - use schemas
- `SlashCommandHandler` - validation on write operations
- Skills with `.specs.md` files - specs loading and formatting

## What It Does

skillSchemas provides:

1. **SKILL_TYPES**: Schema definitions for each skill type (tskill, cskill, iskill, oskill, mskill)
2. **SKILL_TEMPLATES**: Blank templates for creating new skills
3. **detectSkillType**: Determine skill type from content heuristics
4. **validateSkillContent**: Validate skill file against its schema
5. **parseSkillSections**: Extract sections from skill markdown
6. **updateSkillSection**: Modify specific sections in skill content
7. **Specs utilities**: Load and format `.specs.md` files

## How It Does It

### Skill Type Definitions
```javascript
export const SKILL_TYPES = {
    tskill: {
        fileName: 'tskill.md',
        generatedFileName: 'tskill.generated.mjs',
        description: 'Database table skill - defines entity schema with fields, validators, and business rules',
        requiredSections: ['Table Purpose', 'Fields'],
        optionalSections: ['Derived Fields', 'Business Rules', 'Relationships'],
    },
    cskill: {
        fileName: 'cskill.md',
        generatedFileName: null,
        description: 'Code skill - LLM generates and executes code based on prompt',
        requiredSections: ['Summary', 'Prompt'],
        optionalSections: ['Arguments', 'LLM Mode', 'Examples'],
    },
    iskill: {
        fileName: 'iskill.md',
        generatedFileName: null,
        description: 'Interactive skill - conversational commands with user input',
        requiredSections: ['Summary', 'Commands'],
        optionalSections: ['Roles', 'Session Storage'],
    },
    oskill: {
        fileName: 'oskill.md',
        generatedFileName: null,
        description: 'Orchestrator skill - routes intents to other skills',
        requiredSections: ['Instructions', 'Allowed Skills'],
        optionalSections: ['Intent Recognition', 'Routing Logic', 'Fallback Behavior'],
    },
    mskill: {
        fileName: 'mskill.md',
        generatedFileName: null,
        description: 'MCP skill - uses Model Context Protocol tools',
        requiredSections: ['Summary', 'MCP Tools'],
        optionalSections: ['Configuration'],
    },
};
```

### Skill Type Detection
```javascript
export function detectSkillType(content) {
    if (!content || typeof content !== 'string') return null;

    const contentLower = content.toLowerCase();

    // Table skill indicators
    if (contentLower.includes('## table purpose') ||
        contentLower.includes('## fields') ||
        contentLower.includes('### field value validator')) {
        return 'tskill';
    }

    // Orchestrator indicators
    if (contentLower.includes('## allowed skills') ||
        contentLower.includes('## intent recognition') ||
        contentLower.includes('## routing logic')) {
        return 'oskill';
    }

    // Interactive skill indicators
    if (contentLower.includes('## required arguments') ||
        (contentLower.includes('## commands') &&
            (contentLower.includes('## roles') || contentLower.includes('## session')))) {
        return 'iskill';
    }

    // MCP skill indicators
    if (contentLower.includes('## mcp tools') ||
        contentLower.includes('### server connection')) {
        return 'mskill';
    }

    // Default to code skill if has summary and prompt
    if (contentLower.includes('## summary') && contentLower.includes('## prompt')) {
        return 'cskill';
    }

    return null;
}
```

### Content Validation
```javascript
export function validateSkillContent(content, skillType = null) {
    const errors = [];
    const warnings = [];

    if (!content || typeof content !== 'string') {
        return { valid: false, errors: ['Content is empty or invalid'], warnings: [] };
    }

    // Auto-detect type if not provided
    const type = skillType || detectSkillType(content);
    if (!type) {
        return { valid: false, errors: ['Could not determine skill type'], warnings: [] };
    }

    const schema = SKILL_TYPES[type];
    if (!schema) {
        return { valid: false, errors: [`Unknown skill type: ${type}`], warnings: [] };
    }

    // Check required sections
    for (const section of schema.requiredSections) {
        const sectionPattern = new RegExp(`##\\s+${section}`, 'i');
        if (!sectionPattern.test(content)) {
            errors.push(`Missing required section: ## ${section}`);
        }
    }

    // Check for title
    if (!content.trim().startsWith('#')) {
        errors.push('Skill file should start with a # title');
    }

    // Warn about missing optional sections
    for (const section of schema.optionalSections || []) {
        const sectionPattern = new RegExp(`##\\s+${section.replace(/-/g, '[\\s-]+')}`, 'i');
        if (!sectionPattern.test(content)) {
            warnings.push(`Optional section not present: ## ${section}`);
        }
    }

    // Type-specific validation
    if (type === 'tskill') {
        if (!content.includes('### ')) {
            errors.push('Table skill should define at least one field (### field_name)');
        }
    }

    if (type === 'cskill') {
        const hasLLMMode = /##\s+llm[\s-]+mode/i.test(content);
        if (!hasLLMMode) {
            warnings.push('Code skill should specify ## LLM Mode (fast or deep)');
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
        detectedType: type,
    };
}
```

### Section Parsing and Updating
```javascript
export function parseSkillSections(content) {
    const sections = {};
    if (!content) return sections;

    // Extract title
    const titleMatch = content.match(/^#\s+(.+)$/m);
    if (titleMatch) {
        sections._title = titleMatch[1].trim();
    }

    // Extract all ## sections
    const sectionRegex = /^##\s+(.+)$\n([\s\S]*?)(?=^##\s+|\n*$)/gm;
    let match;

    while ((match = sectionRegex.exec(content)) !== null) {
        const sectionName = match[1].trim();
        const sectionContent = match[2].trim();
        sections[sectionName] = sectionContent;
    }

    return sections;
}

export function updateSkillSection(content, sectionName, newContent) {
    const sectionRegex = new RegExp(
        `(^##\\s+${escapeRegex(sectionName)}\\s*\\n)([\\s\\S]*?)(?=^##\\s+|\\n*$)`,
        'mi'
    );

    if (sectionRegex.test(content)) {
        // Section exists, replace it
        return content.replace(sectionRegex, `$1${newContent}\n\n`);
    } else {
        // Section doesn't exist, append it
        return `${content.trim()}\n\n## ${sectionName}\n${newContent}\n`;
    }
}
```

### Specs File Utilities
```javascript
export function loadSpecsContent(skillDir) {
    if (!skillDir) return null;
    const specsPath = path.join(skillDir, '.specs.md');
    try {
        if (fs.existsSync(specsPath)) {
            return fs.readFileSync(specsPath, 'utf8');
        }
    } catch (error) {
        // Specs are optional, silently ignore errors
    }
    return null;
}

export function buildSpecsContext(specsContent) {
    if (!specsContent) return '';
    return `
## Skill Specifications (.specs.md)
The following specifications define requirements and constraints for this skill:

${specsContent}

---
IMPORTANT: Ensure all modifications comply with the above specifications.
`;
}

export function extractValidationRequirements(specsContent) {
    if (!specsContent) return null;

    const validationMatch = specsContent.match(
        /##\s+Validation\s+Requirements\s*\n([\s\S]*?)(?=\n##\s+|$)/i
    );

    if (validationMatch) {
        const requirements = {
            requiredExports: [],
            requiredFields: [],
            customRules: [],
        };

        // Parse subsections
        const lines = validationMatch[1].split('\n');
        let currentSection = null;

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('### Required Exports')) {
                currentSection = 'requiredExports';
            } else if (trimmed.startsWith('### Required Fields')) {
                currentSection = 'requiredFields';
            } else if (trimmed.startsWith('### Custom Rules')) {
                currentSection = 'customRules';
            } else if (trimmed.startsWith('- ') && currentSection) {
                requirements[currentSection].push(trimmed.slice(2));
            }
        }

        return requirements;
    }

    return null;
}
```

## Why This Design

### 1. Content-Based Type Detection
**Decision**: Detect skill type from content heuristics rather than filename.

**Rationale**:
- Files may be renamed or copied
- More robust than relying on naming conventions
- Works with partial content
- Automatic type inference

### 2. Required vs Optional Sections
**Decision**: Separate required sections (errors) from optional sections (warnings).

**Rationale**:
- Required sections are minimum for valid skill
- Optional sections improve quality but aren't mandatory
- Warnings guide improvement without blocking
- Progressive enhancement model

### 3. Static Templates
**Decision**: Pre-defined templates as string literals.

**Rationale**:
- Easy to edit and format
- No runtime generation
- Copy-paste friendly
- Complete examples

### 4. Specs File Convention
**Decision**: Use `.specs.md` as a hidden file for specifications.

**Rationale**:
- Hidden file keeps skill directory clean
- Markdown format for consistency
- Lazily loaded (only when needed)
- Optional (skills work without it)

### 5. Regex-Based Section Parsing
**Decision**: Use regex to extract markdown sections.

**Rationale**:
- Markdown is semi-structured
- Regex handles common patterns
- No markdown parser dependency
- Fast for small files

## Public API

### Constants
```javascript
SKILL_TYPES           // Schema definitions by type
SKILL_TEMPLATES       // Blank templates by type
```

### Functions
```javascript
detectSkillType(content)                                    // Returns type string or null
validateSkillContent(content, skillType?)                   // Returns validation result
parseSkillSections(content)                                 // Returns sections object
updateSkillSection(content, sectionName, newContent)        // Returns updated content

// Specs utilities
loadSpecsContent(skillDir)                                  // Returns specs content or null
buildSpecsContext(specsContent)                             // Returns formatted specs block
extractValidationRequirements(specsContent)                 // Returns requirements object

// Specs-based validation
validateTskillWithSpecs(skillName, content, specsContent?)  // Returns validation result
validateGeneratedCodeWithSpecs(code, skillName, specs?)     // Returns validation result
```

## Skill Types Summary

| Type | File | Generated | Required Sections |
|------|------|-----------|-------------------|
| tskill | tskill.md | tskill.generated.mjs | Table Purpose, Fields |
| cskill | cskill.md | - | Summary, Prompt |
| iskill | iskill.md | - | Summary, Commands |
| oskill | oskill.md | - | Instructions, Allowed Skills |
| mskill | mskill.md | - | Summary, MCP Tools |

## Validation Result Structure

```javascript
{
    valid: boolean,           // true if no errors
    errors: string[],         // Required section issues
    warnings: string[],       // Optional section issues
    detectedType: string,     // Auto-detected skill type
}
```

## Notes/Constraints

- Section names are case-insensitive in detection
- Hyphenated sections match space-separated (e.g., "LLM-Mode" matches "LLM Mode")
- parseSkillSections uses `_title` key for H1 heading
- updateSkillSection appends if section doesn't exist
- Template strings use backticks for multi-line
- escapeRegex helper prevents regex injection from section names
- Specs validation is additive (runs after generic validation)
