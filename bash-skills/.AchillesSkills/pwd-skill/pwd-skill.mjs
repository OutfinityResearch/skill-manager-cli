/**
 * pwd-skill - Print working directory
 */

import { executeWithPermission } from '../_shared/executor.mjs';

export async function action(agent, prompt) {
    const context = agent?.context || {};
    const result = await executeWithPermission('pwd', [], agent, { context });

    if (result.denied) {
        return `Execution denied: ${result.error}`;
    }

    if (!result.success) {
        return `Error: ${result.error}`;
    }

    return result.output;
}

export default action;
