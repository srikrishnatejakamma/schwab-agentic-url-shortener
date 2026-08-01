import { describe, expect, it } from 'vitest';

import { WorkflowEngine } from '../src/orchestration/workflowEngine.js';
import { policyRegistry } from '../src/orchestration/policies.js';
import { createScenarioCatalog } from '../src/scenarios/catalog.js';

describe('WorkflowEngine', () => {
  it('completes the greenfield scenario when release approval is provided', async () => {
    const engine = new WorkflowEngine(policyRegistry);
    const workflow = createScenarioCatalog().greenfield;

    const result = await engine.execute(workflow, {
      input: { requirementClarity: 'clear' },
      approvals: {
        'release-readiness': {
          approved: true,
          approver: 'reviewer'
        }
      }
    });

    expect(result.status).toBe('completed');
    expect(result.completedNodes).toContain('release-readiness');
    expect(result.metrics.successRate).toBe(1);
  });

  it('halts on ambiguity without human clarification', async () => {
    const engine = new WorkflowEngine(policyRegistry);
    const workflow = createScenarioCatalog().ambiguous;

    const result = await engine.execute(workflow, {
      input: { requirementClarity: 'ambiguous' },
      approvals: {
        'release-readiness': {
          approved: true,
          approver: 'reviewer'
        }
      }
    });

    expect(result.status).toBe('waiting_for_input');
    expect(result.pendingNodes).toContain('collect-clarifications');
  });

  it('re-plans and completes the ambiguous scenario when clarification is supplied', async () => {
    const engine = new WorkflowEngine(policyRegistry);
    const workflow = createScenarioCatalog().ambiguous;

    const result = await engine.execute(workflow, {
      input: { requirementClarity: 'ambiguous' },
      approvals: {
        'release-readiness': {
          approved: true,
          approver: 'reviewer'
        }
      },
      inputResolver: async () => ({
        clarification: {
          retentionDays: 30,
          audience: 'internal-only',
          aliasPolicy: 'reserved'
        }
      })
    });

    expect(result.status).toBe('completed');
    expect(result.completedNodes).toContain('compliance-review');
  });
});