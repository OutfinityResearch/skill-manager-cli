import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const repoSpecs = [
    {
        name: 'achillesAgentLib',
        url: 'https://github.com/OutfinityResearch/achillesAgentLib.git',
    },
    {
        name: 'GAMPSkills',
        url: 'https://github.com/OutfinityResearch/GAMPSkills.git',
    },
    {
        name: 'marketingskills',
        url: 'https://github.com/coreyhaines31/marketingskills.git',
    },
];

const projectRoot = process.cwd();
const nodeModulesDir = path.join(projectRoot, 'node_modules');

if (!fs.existsSync(nodeModulesDir)) {
    fs.mkdirSync(nodeModulesDir, { recursive: true });
}

for (const repo of repoSpecs) {
    const targetDir = path.join(nodeModulesDir, repo.name);
    if (fs.existsSync(targetDir)) {
        continue;
    }

    execSync(`git clone ${repo.url} ${repo.name}`, {
        cwd: nodeModulesDir,
        stdio: 'inherit',
    });
}
