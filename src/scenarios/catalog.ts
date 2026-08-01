import type { WorkflowDefinition } from '../orchestration/workflowEngine.js';

function artifact<T extends Record<string, unknown>>(value: T): { summary: string; outputs: T } {
  return {
    summary: 'Artifact generated successfully.',
    outputs: value
  };
}

export function createScenarioCatalog(): Record<string, WorkflowDefinition> {
  const greenfield: WorkflowDefinition = {
    id: 'greenfield-url-shortener',
    title: 'Greenfield URL Shortener Delivery',
    description: 'Build the system from a fresh requirement with governed SDLC execution.',
    nodes: [
      {
        id: 'normalize-requirement',
        stage: 'requirements',
        description: 'Interpret the greenfield requirement and normalize scope.',
        dependsOn: [],
        run: async () => artifact({
          requirement: 'Build a URL shortener with analytics, reliability controls, and API docs.',
          assumptions: ['In-memory or file-backed persistence is acceptable for the prototype.', 'Human approval is required before release readiness.']
        })
      },
      {
        id: 'decompose-work',
        stage: 'requirements',
        description: 'Create a dependency-aware execution plan.',
        dependsOn: ['normalize-requirement'],
        run: async () => artifact({
          tasks: ['API contract', 'Persistence model', 'Analytics capture', 'Testing', 'Documentation'],
          parallelPaths: ['API contract', 'Persistence model']
        })
      },
      {
        id: 'architecture-and-design',
        stage: 'design',
        description: 'Design the service architecture and control flow.',
        dependsOn: ['decompose-work'],
        run: async () => ({
          summary: 'Architecture and governance model captured.',
          outputs: {
            components: ['Express API', 'File-backed repository', 'Workflow engine', 'Scenario runner'],
            decisions: ['Persist data to a JSON file for deterministic demos.', 'Separate workflow engine from application logic.']
          },
          decisions: [
            {
              summary: 'Selected Node.js and TypeScript for a fast greenfield prototype.',
              rationale: 'The stack supports strong typing, quick service development, and straightforward workflow modeling.'
            }
          ]
        })
      },
      {
        id: 'implement-core-api',
        stage: 'implementation',
        description: 'Implement create, resolve, and analytics APIs.',
        dependsOn: ['architecture-and-design'],
        run: async () => artifact({
          impactedModules: ['src/app.ts', 'src/domain/urlShortenerService.ts', 'src/storage/fileUrlRepository.ts']
        })
      },
      {
        id: 'implement-orchestration',
        stage: 'implementation',
        description: 'Implement the governed orchestration layer.',
        dependsOn: ['architecture-and-design'],
        run: async () => artifact({
          capabilities: ['Explicit DAG', 'Parallel node execution', 'Approvals', 'Retries', 'Rollback hooks', 'Audit events']
        })
      },
      {
        id: 'security-review',
        stage: 'validation',
        description: 'Apply security and change-control guardrails.',
        dependsOn: ['implement-core-api', 'implement-orchestration'],
        run: async () => artifact({
          findings: ['HTTP-only target URLs are rejected.', 'High-impact release nodes require approval evidence.']
        })
      },
      {
        id: 'validation-and-testing',
        stage: 'validation',
        description: 'Run validation for unit, API, and workflow coverage.',
        dependsOn: ['implement-core-api', 'implement-orchestration'],
        run: async () => artifact({
          validation: ['Service unit tests', 'HTTP API integration tests', 'Workflow orchestration tests'],
          riskControls: ['Idempotency keys', 'Expiration checks', 'Policy gates before release']
        })
      },
      {
        id: 'documentation',
        stage: 'validation',
        description: 'Produce architecture and setup documentation.',
        dependsOn: ['architecture-and-design', 'implement-core-api'],
        run: async () => artifact({
          docs: ['README.md', 'docs/architecture.md', 'docs/scenarios.md']
        })
      },
      {
        id: 'release-readiness',
        stage: 'release',
        description: 'Check release readiness with policy gates and approval.',
        dependsOn: ['security-review', 'validation-and-testing', 'documentation'],
        requiresApproval: true,
        approvalKey: 'release-readiness',
        policyChecks: ['evidence-before-release', 'security-review-present'],
        run: async () => artifact({
          checklist: ['Tests passed', 'Architecture documented', 'Approval recorded']
        })
      }
    ]
  };

  const brownfield: WorkflowDefinition = {
    id: 'brownfield-url-shortener-hardening',
    title: 'Brownfield Enhancement and Impact Analysis',
    description: 'Enhance the existing service with guarded change management.',
    nodes: [
      {
        id: 'analyze-impact',
        stage: 'requirements',
        description: 'Identify impacted modules, APIs, and data flows.',
        dependsOn: [],
        run: async () => ({
          summary: 'Brownfield impact analysis completed.',
          outputs: {
            modules: ['src/app.ts', 'src/domain/urlShortenerService.ts', 'src/storage/fileUrlRepository.ts'],
            apiContracts: ['POST /api/urls', 'GET /api/urls/:code', 'GET /api/urls/:code/analytics'],
            dataFlow: 'HTTP request -> validation -> service -> repository -> persistence file'
          },
          decisions: [
            {
              summary: 'Kept repository and service layers stable while extending behavior.',
              rationale: 'This minimizes regression risk and isolates change to explicit seams.'
            }
          ]
        })
      },
      {
        id: 'design-change',
        stage: 'design',
        description: 'Design the enhancement and rollback strategy.',
        dependsOn: ['analyze-impact'],
        run: async () => artifact({
          enhancement: 'Custom aliases, idempotency, expiration handling, and improved analytics visibility.',
          rollback: 'Restore previous file-backed records and redeploy the prior build artifact.'
        })
      },
      {
        id: 'implement-alias-hardening',
        stage: 'implementation',
        description: 'Protect custom aliases and collision handling.',
        dependsOn: ['design-change'],
        retryLimit: 1,
        run: async () => artifact({
          change: 'Custom short codes are validated and rejected on collision with HTTP 409 semantics.'
        })
      },
      {
        id: 'implement-analytics-hardening',
        stage: 'implementation',
        description: 'Improve analytics integrity and expiration behavior.',
        dependsOn: ['design-change'],
        retryLimit: 1,
        run: async () => artifact({
          change: 'Unique requester counts and recent access history are persisted, with expiration returning HTTP 410.'
        })
      },
      {
        id: 'regression-validation',
        stage: 'validation',
        description: 'Validate the enhancement against regression risk.',
        dependsOn: ['implement-alias-hardening', 'implement-analytics-hardening'],
        run: async () => artifact({
          regressionsChecked: ['Existing create flow', 'Redirect flow', 'Analytics endpoint'],
          tradeOffs: ['File-backed storage is single-node only.', 'Unique requester count is best-effort and identifier-based.']
        })
      },
      {
        id: 'release-readiness',
        stage: 'release',
        description: 'Hold the brownfield change behind approval and evidence gates.',
        dependsOn: ['regression-validation'],
        requiresApproval: true,
        approvalKey: 'release-readiness',
        policyChecks: ['evidence-before-release'],
        run: async () => artifact({
          releaseRisk: 'Low-to-moderate, bounded to the URL creation and analytics paths.'
        })
      }
    ]
  };

  const ambiguous: WorkflowDefinition = {
    id: 'ambiguous-enterprise-links',
    title: 'Ambiguous Requirement Clarification Flow',
    description: 'Pause safely on ambiguity, collect clarification, then re-plan under governance.',
    nodes: [
      {
        id: 'normalize-requirement',
        stage: 'requirements',
        description: 'Recognize ambiguity in the requirement.',
        dependsOn: [],
        run: async () => ({
          summary: 'Requirement normalization detected missing policy detail.',
          outputs: {
            openQuestions: ['What retention period is allowed for analytics?', 'Should redirects be public or internal-only?', 'Are custom aliases user-supplied or reserved?']
          },
          decisions: [
            {
              summary: 'Stopped autonomous progression at the first blocking ambiguity.',
              rationale: 'Security, retention, and access-control assumptions materially affect implementation and compliance.'
            }
          ]
        })
      },
      {
        id: 'collect-clarifications',
        stage: 'requirements',
        description: 'Request human clarification before implementation proceeds.',
        dependsOn: ['normalize-requirement'],
        run: async (context) => {
          const clarification = context.input.clarification as Record<string, unknown> | undefined;
          if (!clarification) {
            return {
              summary: 'Human clarification is required before the workflow may continue.',
              control: 'wait-for-input',
              inputRequest: {
                key: 'clarification',
                questions: ['Specify analytics retention days.', 'Specify redirect audience.', 'Specify whether aliases are reserved or free-form.']
              }
            };
          }

          return {
            summary: 'Clarification received and the workflow was re-planned.',
            outputs: clarification,
            addNodes: [
              {
                id: 'compliance-review',
                stage: 'design',
                description: 'Apply retention and access-control guardrails from the clarified requirement.',
                dependsOn: ['collect-clarifications'],
                run: async (innerContext) => artifact({
                  retentionDays: (innerContext.input.clarification as Record<string, unknown>).retentionDays,
                  audience: (innerContext.input.clarification as Record<string, unknown>).audience,
                  controls: ['Access policy documented', 'Retention bounded', 'Alias ownership explicit']
                })
              }
            ]
          };
        }
      },
      {
        id: 'design-solution',
        stage: 'design',
        description: 'Design the solution only after clarification is captured.',
        dependsOn: ['collect-clarifications'],
        policyChecks: ['clarity-required'],
        run: async (context) => artifact({
          solution: 'Internal-only redirect mode with analytics retention and alias reservation constraints.',
          clarification: context.input.clarification
        })
      },
      {
        id: 'validate-solution',
        stage: 'validation',
        description: 'Validate the clarified solution and route to release approval.',
        dependsOn: ['design-solution'],
        run: async () => artifact({
          validated: true,
          checks: ['Assumption log complete', 'Compliance review complete or added dynamically']
        })
      },
      {
        id: 'release-readiness',
        stage: 'release',
        description: 'Require a human release decision after ambiguity is resolved.',
        dependsOn: ['validate-solution'],
        requiresApproval: true,
        approvalKey: 'release-readiness',
        policyChecks: ['evidence-before-release'],
        run: async () => artifact({
          outcome: 'Ready for release subject to explicit approval and captured assumptions.'
        })
      }
    ]
  };

  return {
    greenfield,
    brownfield,
    ambiguous
  };
}