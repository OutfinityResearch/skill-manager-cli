/**
 * calculator - Code Skill
 * Performs basic math operations.
 */

export const specs = {
    name: 'calculator',
    description: 'Performs basic math operations.',
    type: 'code',
    llmMode: 'fast',
    arguments: {
        operation: {
            description: 'The operation to perform',
            type: 'string',
            required: true,
        },
        number1: {
            description: 'The first number',
            type: 'number',
            required: true,
        },
        number2: {
            description: 'The second number',
            type: 'number',
            required: true,
        },
    },
};

export async function action(input, context) {
    const { llmAgent, arguments } = context;
    const { operation, number1, number2 } = arguments;

    if (!llmAgent) {
        throw new Error('LLM agent required for code skill execution');
    }

    if (![number1, number2, operation].every(value => value !== undefined)) {
        throw new Error('Missing required arguments: operation, number1, number2');
    }

    // The prompt from the skill definition
    const systemPrompt = `Perform the basic math operation provided. Operation: ${operation}, Number1: ${number1}, Number2: ${number2}`;

    // Build the full prompt with user input
    const fullPrompt = `${systemPrompt}

User input: ${typeof input === 'string' ? input : JSON.stringify(input)}`;

    // Execute with the specified LLM mode
    const result = await llmAgent.executePrompt(fullPrompt, {
        mode: specs.llmMode,
    });

    return result;
}

export default { specs, action };