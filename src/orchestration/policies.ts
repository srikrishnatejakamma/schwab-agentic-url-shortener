import type { WorkflowPolicyRegistry } from './workflowEngine.js';

export const policyRegistry: WorkflowPolicyRegistry = {
  'clarity-required': async (context, node) => {
    const clarified = Boolean(context.artifacts['collect-clarifications'] || context.artifacts['normalize-requirement']);
    const ambiguous = context.input.requirementClarity === 'ambiguous';

    if (ambiguous && node.stage !== 'requirements' && !clarified) {
      return {
        passed: false,
        message: 'Ambiguous requirements must be clarified before downstream work proceeds.'
      };
    }

    return {
      passed: true,
      message: 'Requirement clarity gate passed.'
    };
  },
  'evidence-before-release': async (context) => {
    const hasValidationEvidence = Object.keys(context.artifacts).some((artifactKey) =>
      artifactKey.includes('validation') || artifactKey.startsWith('validate-')
    );
    return {
      passed: hasValidationEvidence,
      message: hasValidationEvidence
        ? 'Validation evidence is present.'
        : 'Validation evidence is required before release readiness.'
    };
  },
  'security-review-present': async (context) => {
    const hasSecurityReview = Boolean(context.artifacts['security-review']);
    return {
      passed: hasSecurityReview,
      message: hasSecurityReview
        ? 'Security review evidence is present.'
        : 'Security review is required for release readiness.'
    };
  }
};