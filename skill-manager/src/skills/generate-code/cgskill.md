# Generate Code

Generates .mjs code from skill definitions (tskill, oskill, cskill).

## Description
Uses LLM to generate JavaScript code from skill definitions:
- **tskill**: Generates validators, presenters, resolvers for database table skills
- **oskill**: Generates specs and action function for orchestrator skills with routing logic
- **cskill**: Generates specs and action function wrapper for code skills

## Prompt
Analyze the skill definition and generate corresponding JavaScript/ESM code with all required exports.

## Arguments
- skillName: Name of the skill to generate code for (tskill, oskill, or cskill)

## LLM-Mode
deep
