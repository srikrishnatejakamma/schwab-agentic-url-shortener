import fs from 'node:fs/promises';
import path from 'node:path';

import { config } from '../config.js';
import { WorkflowEngine } from '../orchestration/workflowEngine.js';
import { policyRegistry } from '../orchestration/policies.js';
import { createScenarioCatalog } from './catalog.js';

function getScenarioNameFromArgs(argv: string[]): string | undefined {
  return argv[2];
}

async function main(): Promise<void> {
  const scenarioName = getScenarioNameFromArgs(process.argv);
  const catalog = createScenarioCatalog();

  if (!scenarioName || !catalog[scenarioName]) {
    console.error(`Unknown scenario '${scenarioName ?? ''}'. Available scenarios: ${Object.keys(catalog).join(', ')}`);
    process.exitCode = 1;
    return;
  }

  const engine = new WorkflowEngine(policyRegistry);
  const definition = catalog[scenarioName];
  const result = await engine.execute(definition, {
    input: scenarioName === 'ambiguous' ? { requirementClarity: 'ambiguous' } : { requirementClarity: 'clear' },
    approvals: {
      'release-readiness': {
        approved: true,
        approver: 'human-reviewer',
        reason: 'Demo approval for the prototype.'
      }
    },
    inputResolver: async (node, request) => {
      if (node.id === 'collect-clarifications' && request.key === 'clarification') {
        return {
          clarification: {
            retentionDays: 30,
            audience: 'internal-only',
            aliasPolicy: 'reserved'
          }
        };
      }

      return undefined;
    }
  });

  await fs.mkdir(config.artifactsDir, { recursive: true });
  const filePath = path.join(config.artifactsDir, `${scenarioName}.json`);
  await fs.writeFile(filePath, JSON.stringify(result, null, 2), 'utf8');

  console.log(JSON.stringify({ scenario: scenarioName, artifact: filePath, status: result.status, metrics: result.metrics }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});