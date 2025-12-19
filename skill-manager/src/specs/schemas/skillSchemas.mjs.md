# skillSchemas Module Specification

Defines skill type schemas, templates, validation, and parsing utilities.

## Overview

This module provides the core schema definitions for all skill types, including required and optional sections, file templates, content validation, section parsing, and specs file handling.

## SKILL_TYPES Object

Registry of skill type definitions with metadata.

### tskill (Database Table Skill)
- fileName: tskill.md
- generatedFileName: tskill.generated.mjs
- description: Database table skill defining entity schema with fields, validators, and business rules
- requiredSections: Table Purpose, Fields
- optionalSections: Derived Fields, Business Rules, Relationships

### cskill (Code Skill)
- fileName: cskill.md
- generatedFileName: null (uses separate .js file)
- description: Code skill where LLM generates and executes code based on specs
- requiredSections: Summary, Input Format, Output Format
- optionalSections: Constraints, Examples

### iskill (Interactive Skill)
- fileName: iskill.md
- generatedFileName: null
- description: Interactive conversational skill with user input
- requiredSections: Summary, Commands
- optionalSections: Roles, Session Storage

### oskill (Orchestrator Skill)
- fileName: oskill.md
- generatedFileName: null
- description: Orchestrator routing intents to other skills
- requiredSections: Instructions, Allowed Skills
- optionalSections: Intent Recognition, Routing Logic, Fallback Behavior

### mskill (MCP Skill)
- fileName: mskill.md
- generatedFileName: null
- description: Skill using Model Context Protocol tools
- requiredSections: Summary, MCP Tools
- optionalSections: Configuration

### cgskill (Code Generation Skill)
- fileName: cgskill.md
- generatedFileName: null
- description: Code generation skill with LLM runtime or hand-written module
- requiredSections: Summary, Prompt
- optionalSections: Argument, LLM-Mode, Examples

## SKILL_TEMPLATES Object

Complete markdown templates for each skill type. Templates include:
- Title placeholder
- All required sections with example content
- All optional sections with example content
- Comments explaining each section's purpose

Each template follows the corresponding schema's structure and provides a starting point for skill creation.

## Functions

### detectSkillType

Detects skill type from file content using section markers.

Accepts:
- content: Skill file content string

Detection rules in order:
1. tskill: Has "## Table Purpose", "## Fields", or "### Field Value Validator"
2. oskill: Has "## Allowed Skills", "## Intent Recognition", or "## Routing Logic"
3. iskill: Has "## Required Arguments" or both "## Commands" and "## Roles/Session"
4. mskill: Has "## MCP Tools" or "### Server Connection"
5. cskill: Has both "## Input Format" and "## Output Format"
6. cgskill: Has both "## Summary" and "## Prompt"

Returns skill type string or null if unknown.

### validateSkillContent

Validates skill file against its schema.

Accepts:
- content: Skill file content
- skillType: Optional type (auto-detected if not provided)

Processing:
1. Check content is non-empty string
2. Detect or use provided type
3. Lookup schema for type
4. Check all required sections exist
5. Check title starts with #
6. Note missing optional sections as warnings
7. Run type-specific validation

Type-specific validation:
- tskill: Must have at least one field definition (###)
- cgskill: Should have ## LLM Mode section

Returns:
- valid: Boolean
- errors: Array of error messages
- warnings: Array of warning messages
- detectedType: The skill type

### parseSkillSections

Parses sections from skill content into key-value pairs.

Accepts:
- content: Skill file content

Processing:
1. Extract title from first # heading
2. Find all ## headings
3. Extract content between headings

Returns object with:
- _title: Skill title
- [sectionName]: Section content for each ## section

### updateSkillSection

Updates or adds a section in skill content.

Accepts:
- content: Original content
- sectionName: Section name without ##
- newContent: New content for the section

Processing:
1. Build regex to match existing section
2. If section exists: Replace content
3. If not exists: Append new section at end

Returns updated content string.

### loadSpecsContent

Loads .specs.md file from skill directory.

Accepts:
- skillDir: Path to skill directory

Processing:
1. Construct path to .specs.md
2. Check if file exists
3. Read and return content

Returns content string or null if not found/error.

### buildSpecsContext

Formats specs content for LLM prompts.

Accepts:
- specsContent: Content from .specs.md or null

Returns:
- If content: Formatted block with header and content
- If null: Empty string

Output format includes header explaining specs purpose and importance note.

### extractValidationRequirements

Extracts structured validation requirements from specs content.

Accepts:
- specsContent: Content from .specs.md

Processing:
1. Search for ## Validation Requirements section
2. Parse subsections:
   - ### Required Exports: Function/const exports code must have
   - ### Required Fields: Fields skill definition must have
   - ### Custom Rules: Additional rules as warnings

Returns object with arrays for each category, or null if no section found.

### validateTskillWithSpecs

Validates tskill using both generic and specs-based rules.

Accepts:
- skillName: Skill name
- content: tskill.md content
- specsContent: Optional .specs.md content

Processing:
1. Run generic tskill validation
2. If specs has validation requirements:
   - Check required fields exist
   - Add custom rules as warnings

Returns:
- isValid: Boolean
- errors: Array
- warnings: Array
- detectedType: 'tskill'

### validateGeneratedCodeWithSpecs

Validates generated code using specs requirements.

Accepts:
- code: Generated .mjs code
- skillName: Skill name
- specsContent: Optional .specs.md content

Processing:
1. Check code is non-empty
2. Warn if no default export
3. If specs has required exports: Check each exists

Returns:
- isValid: Boolean
- errors: Array
- warnings: Array

## Internal Functions

### escapeRegex

Escapes special regex characters in a string.

Used for building section-matching patterns safely.

## Exports

Named exports:
- SKILL_TYPES
- SKILL_TEMPLATES
- detectSkillType
- validateSkillContent
- parseSkillSections
- updateSkillSection
- loadSpecsContent
- buildSpecsContext
- extractValidationRequirements
- validateTskillWithSpecs
- validateGeneratedCodeWithSpecs

Default export: Object containing all exports
