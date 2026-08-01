export type WorkflowStage = 'requirements' | 'design' | 'implementation' | 'validation' | 'release';

export type ApprovalDecision = {
  approved: boolean;
  approver: string;
  reason?: string;
};

export type WorkflowDecision = {
  summary: string;
  rationale: string;
};

export type PolicyEvaluation = {
  passed: boolean;
  message: string;
};

export type WorkflowEvent = {
  timestamp: string;
  type: string;
  nodeId?: string;
  detail: string;
};

export type WorkflowInputRequest = {
  key: string;
  questions: string[];
};

export type WorkflowRunContext = {
  workflowId: string;
  input: Record<string, unknown>;
  approvals: Record<string, ApprovalDecision>;
  artifacts: Record<string, unknown>;
  decisions: WorkflowDecision[];
  events: WorkflowEvent[];
  metrics: {
    retries: number;
    rollbacks: number;
    endToEndLatencyMs: number;
    recoverySamplesMs: number[];
  };
};

export type WorkflowNodeResult = {
  summary: string;
  outputs?: Record<string, unknown>;
  decisions?: WorkflowDecision[];
  addNodes?: WorkflowNode[];
  invalidateNodes?: string[];
  control?: 'continue' | 'safe-stop' | 'wait-for-input';
  inputRequest?: WorkflowInputRequest;
};

export type WorkflowNode = {
  id: string;
  stage: WorkflowStage;
  description: string;
  dependsOn: string[];
  retryLimit?: number;
  requiresApproval?: boolean;
  approvalKey?: string;
  policyChecks?: string[];
  run: (context: WorkflowRunContext) => Promise<WorkflowNodeResult>;
  fallback?: (context: WorkflowRunContext, error: Error) => Promise<WorkflowNodeResult>;
  rollback?: (context: WorkflowRunContext) => Promise<void>;
};

export type WorkflowDefinition = {
  id: string;
  title: string;
  description: string;
  nodes: WorkflowNode[];
};

export type WorkflowPolicyRegistry = Record<string, (context: WorkflowRunContext, node: WorkflowNode) => Promise<PolicyEvaluation>>;

export type WorkflowRunResult = {
  workflowId: string;
  title: string;
  status: 'completed' | 'failed' | 'stopped' | 'waiting_for_approval' | 'waiting_for_input';
  completedNodes: string[];
  pendingNodes: string[];
  failedNode?: string;
  artifacts: Record<string, unknown>;
  decisions: WorkflowDecision[];
  events: WorkflowEvent[];
  metrics: {
    successRate: number;
    retries: number;
    rollbacks: number;
    mttrMs: number;
    endToEndLatencyMs: number;
  };
};

type WorkflowEngineOptions = {
  approvals?: Record<string, ApprovalDecision>;
  input?: Record<string, unknown>;
  approvalResolver?: (node: WorkflowNode, context: WorkflowRunContext) => Promise<ApprovalDecision | undefined>;
  inputResolver?: (node: WorkflowNode, request: WorkflowInputRequest, context: WorkflowRunContext) => Promise<Record<string, unknown> | undefined>;
};

export class WorkflowEngine {
  public constructor(private readonly policyRegistry: WorkflowPolicyRegistry) {}

  public async execute(definition: WorkflowDefinition, options: WorkflowEngineOptions = {}): Promise<WorkflowRunResult> {
    const startedAt = Date.now();
    const context: WorkflowRunContext = {
      workflowId: definition.id,
      input: { ...(options.input ?? {}) },
      approvals: { ...(options.approvals ?? {}) },
      artifacts: {},
      decisions: [],
      events: [],
      metrics: {
        retries: 0,
        rollbacks: 0,
        endToEndLatencyMs: 0,
        recoverySamplesMs: []
      }
    };

    const nodes = new Map(definition.nodes.map((node) => [node.id, node]));
    const completed = new Set<string>();
    const pending = new Set(definition.nodes.map((node) => node.id));
    const completedInOrder: WorkflowNode[] = [];

    while (pending.size > 0) {
      const readyNodes = Array.from(pending)
        .map((nodeId) => nodes.get(nodeId))
        .filter((node): node is WorkflowNode => Boolean(node))
        .filter((node) => node.dependsOn.every((dependency) => completed.has(dependency)));

      if (readyNodes.length === 0) {
        return this.finish(definition, context, completed, pending, startedAt, 'failed', undefined, 'No executable nodes remain; dependency graph is blocked.');
      }

      this.recordEvent(context, 'batch.start', undefined, `Executing ${readyNodes.length} node(s) in parallel.`);
      const outcomes = await Promise.all(readyNodes.map((node) => this.executeNode(node, context, options)));

      for (const outcome of outcomes) {
        const node = outcome.node;

        if (outcome.status === 'completed') {
          pending.delete(node.id);
          completed.add(node.id);
          completedInOrder.push(node);

          if (outcome.result.outputs) {
            context.artifacts[node.id] = outcome.result.outputs;
          }

          if (outcome.result.decisions) {
            context.decisions.push(...outcome.result.decisions);
          }

          if (outcome.result.addNodes) {
            for (const addedNode of outcome.result.addNodes) {
              if (!nodes.has(addedNode.id)) {
                nodes.set(addedNode.id, addedNode);
                pending.add(addedNode.id);
                this.recordEvent(context, 'plan.replanned', node.id, `Added node '${addedNode.id}' to the dependency graph.`);
              }
            }
          }

          if (outcome.result.invalidateNodes) {
            for (const invalidatedNodeId of outcome.result.invalidateNodes) {
              if (completed.delete(invalidatedNodeId)) {
                pending.add(invalidatedNodeId);
                this.recordEvent(context, 'plan.invalidated', node.id, `Invalidated completed node '${invalidatedNodeId}' due to upstream changes.`);
              }
            }
          }

          if (outcome.result.control === 'safe-stop') {
            this.recordEvent(context, 'workflow.stopped', node.id, outcome.result.summary);
            return this.finish(definition, context, completed, pending, startedAt, 'stopped');
          }

          continue;
        }

        if (outcome.status === 'waiting_for_approval') {
          return this.finish(definition, context, completed, pending, startedAt, 'waiting_for_approval', node.id);
        }

        if (outcome.status === 'waiting_for_input') {
          return this.finish(definition, context, completed, pending, startedAt, 'waiting_for_input', node.id);
        }

        await this.rollback(completedInOrder, context);
        return this.finish(definition, context, completed, pending, startedAt, 'failed', node.id, outcome.error?.message);
      }
    }

    return this.finish(definition, context, completed, pending, startedAt, 'completed');
  }

  private async executeNode(node: WorkflowNode, context: WorkflowRunContext, options: WorkflowEngineOptions): Promise<{
    node: WorkflowNode;
    status: 'completed' | 'failed' | 'waiting_for_approval' | 'waiting_for_input';
    result: WorkflowNodeResult;
    error?: Error;
  }> {
    this.recordEvent(context, 'node.started', node.id, node.description);

    if (node.requiresApproval) {
      const approvalKey = node.approvalKey ?? node.id;
      let approval: ApprovalDecision | undefined = context.approvals[approvalKey];
      if (!approval?.approved && options.approvalResolver) {
        approval = await options.approvalResolver(node, context);
        if (approval) {
          context.approvals[approvalKey] = approval;
          this.recordEvent(context, 'approval.recorded', node.id, `Approval '${approvalKey}' was supplied by ${approval.approver}.`);
        }
      }

      if (!approval?.approved) {
        this.recordEvent(context, 'approval.blocked', node.id, `Approval '${approvalKey}' is required before execution.`);
        return {
          node,
          status: 'waiting_for_approval',
          result: {
            summary: `Approval '${approvalKey}' is required.`,
            control: 'wait-for-input'
          }
        };
      }
    }

    if (node.policyChecks) {
      for (const check of node.policyChecks) {
        const evaluator = this.policyRegistry[check];
        if (!evaluator) {
          throw new Error(`Unknown policy check '${check}'.`);
        }

        const evaluation = await evaluator(context, node);
        this.recordEvent(context, 'policy.evaluated', node.id, `${check}: ${evaluation.message}`);
        if (!evaluation.passed) {
          return {
            node,
            status: 'failed',
            error: new Error(evaluation.message),
            result: {
              summary: evaluation.message
            }
          };
        }
      }
    }

    const retryLimit = node.retryLimit ?? 0;
    let firstFailureAt: number | undefined;
    let inputCycles = 0;

    for (let attempt = 0; attempt <= retryLimit; attempt += 1) {
      try {
        const result = await node.run(context);

        if (result.control === 'wait-for-input' && result.inputRequest) {
          this.recordEvent(context, 'input.requested', node.id, result.inputRequest.questions.join(' | '));

          if (!options.inputResolver || inputCycles >= 2) {
            return {
              node,
              status: 'waiting_for_input',
              result
            };
          }

          const providedInput = await options.inputResolver(node, result.inputRequest, context);
          if (!providedInput) {
            return {
              node,
              status: 'waiting_for_input',
              result
            };
          }

          context.input = {
            ...context.input,
            ...providedInput
          };
          inputCycles += 1;
          this.recordEvent(context, 'input.received', node.id, `Received human input for '${result.inputRequest.key}'.`);
          attempt -= 1;
          continue;
        }

        if (firstFailureAt) {
          context.metrics.recoverySamplesMs.push(Date.now() - firstFailureAt);
        }

        this.recordEvent(context, 'node.completed', node.id, result.summary);
        return {
          node,
          status: 'completed',
          result
        };
      } catch (error) {
        const normalizedError = error instanceof Error ? error : new Error(String(error));
        firstFailureAt ??= Date.now();

        if (attempt < retryLimit) {
          context.metrics.retries += 1;
          this.recordEvent(context, 'node.retrying', node.id, `Attempt ${attempt + 1} failed: ${normalizedError.message}`);
          continue;
        }

        if (node.fallback) {
          const fallbackResult = await node.fallback(context, normalizedError);
          this.recordEvent(context, 'node.fallback', node.id, fallbackResult.summary);
          return {
            node,
            status: 'completed',
            result: fallbackResult
          };
        }

        this.recordEvent(context, 'node.failed', node.id, normalizedError.message);
        return {
          node,
          status: 'failed',
          error: normalizedError,
          result: {
            summary: normalizedError.message
          }
        };
      }
    }

    return {
      node,
      status: 'failed',
      error: new Error('Retry loop exhausted.'),
      result: {
        summary: 'Retry loop exhausted.'
      }
    };
  }

  private async rollback(nodes: WorkflowNode[], context: WorkflowRunContext): Promise<void> {
    for (const node of [...nodes].reverse()) {
      if (!node.rollback) {
        continue;
      }

      await node.rollback(context);
      context.metrics.rollbacks += 1;
      this.recordEvent(context, 'node.rolled_back', node.id, `Rollback completed for '${node.id}'.`);
    }
  }

  private finish(
    definition: WorkflowDefinition,
    context: WorkflowRunContext,
    completed: Set<string>,
    pending: Set<string>,
    startedAt: number,
    status: WorkflowRunResult['status'],
    failedNode?: string,
    detail?: string
  ): WorkflowRunResult {
    context.metrics.endToEndLatencyMs = Date.now() - startedAt;
    if (detail) {
      this.recordEvent(context, 'workflow.finished', failedNode, detail);
    }

    const totalNodes = completed.size + pending.size;
    const successRate = totalNodes === 0 ? 0 : completed.size / totalNodes;
    const mttrMs = context.metrics.recoverySamplesMs.length === 0
      ? 0
      : Math.round(context.metrics.recoverySamplesMs.reduce((sum, sample) => sum + sample, 0) / context.metrics.recoverySamplesMs.length);

    return {
      workflowId: definition.id,
      title: definition.title,
      status,
      completedNodes: Array.from(completed),
      pendingNodes: Array.from(pending),
      failedNode,
      artifacts: context.artifacts,
      decisions: context.decisions,
      events: context.events,
      metrics: {
        successRate,
        retries: context.metrics.retries,
        rollbacks: context.metrics.rollbacks,
        mttrMs,
        endToEndLatencyMs: context.metrics.endToEndLatencyMs
      }
    };
  }

  private recordEvent(context: WorkflowRunContext, type: string, nodeId: string | undefined, detail: string): void {
    context.events.push({
      timestamp: new Date().toISOString(),
      type,
      nodeId,
      detail
    });
  }
}