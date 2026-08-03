const jsonHeaders = { 'Content-Type': 'application/json' };

function byId(id) {
  return document.getElementById(id);
}

function setResult(element, value) {
  if (!element) {
    return;
  }

  element.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

function showError(errorElement, message) {
  if (!errorElement) {
    return;
  }

  errorElement.hidden = false;
  errorElement.textContent = message;
}

function hideError(errorElement) {
  if (!errorElement) {
    return;
  }

  errorElement.hidden = true;
  errorElement.textContent = '';
}

function parseTags(rawTags) {
  return rawTags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function openCreatedModal(modalState, record) {
  if (!modalState.modalElement || !modalState.detailsElement) {
    return;
  }

  modalState.record = record;
  const expiresAt = record.expiresAt ?? 'No expiration';
  const tags = record.tags.length > 0 ? `<ul>${record.tags.map((tag) => `<li>${tag}</li>`).join('')}</ul>` : 'No tags';

  modalState.detailsElement.innerHTML = `
    <strong>Code</strong><span>${record.code}</span>
    <strong>Short URL</strong><span><a href="${record.shortUrl}" target="_blank" rel="noopener noreferrer">${record.shortUrl}</a></span>
    <strong>Target URL</strong><span><a href="${record.originalUrl}" target="_blank" rel="noopener noreferrer">${record.originalUrl}</a></span>
    <strong>Created At</strong><span>${new Date(record.createdAt).toLocaleString()}</span>
    <strong>Expires</strong><span>${expiresAt}</span>
    <strong>Tags</strong><span>${tags}</span>
  `;

  modalState.modalElement.hidden = false;
}

function closeCreatedModal(modalState) {
  if (!modalState.modalElement) {
    return;
  }

  modalState.modalElement.hidden = true;
  modalState.record = null;
}

async function createShortUrl(payload) {
  const response = await fetch('/api/urls', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(payload)
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.message ?? 'Failed to create URL');
  }

  return body;
}

async function refreshLinksTable(tableBody) {
  if (!tableBody) {
    return;
  }

  tableBody.innerHTML = '<tr><td colspan="5" class="muted">Loading links...</td></tr>';

  try {
    const response = await fetch('/api/urls');
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.message ?? 'Unable to load links');
    }

    if (!Array.isArray(payload.records) || payload.records.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="5" class="muted">No short URLs created yet.</td></tr>';
      return;
    }

    tableBody.innerHTML = payload.records
      .map((record) => {
        const createdAt = new Date(record.createdAt).toLocaleString();
        return `
          <tr>
            <td><code>${record.code}</code></td>
            <td><a href="${record.shortUrl}" target="_blank" rel="noopener noreferrer">${record.shortUrl}</a></td>
            <td><a href="${record.originalUrl}" target="_blank" rel="noopener noreferrer">${record.originalUrl}</a></td>
            <td>${record.clickCount}</td>
            <td>${createdAt}</td>
          </tr>
        `;
      })
      .join('');
  } catch (error) {
    tableBody.innerHTML = `<tr><td colspan="5" class="muted">${error.message}</td></tr>`;
  }
}

async function runHealthCheck(healthResult) {
  if (!healthResult) {
    return;
  }

  setResult(healthResult, 'Checking health...');
  try {
    const response = await fetch('/health');
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.message ?? 'Health check failed');
    }

    setResult(healthResult, payload);
  } catch (error) {
    setResult(healthResult, `Health check failed: ${error.message}`);
  }
}

function initCreateFlow() {
  const createForm = byId('create-link-form');
  if (!createForm) {
    return;
  }

  const targetUrlInput = byId('target-url');
  const customCodeInput = byId('custom-code');
  const expiresDaysInput = byId('expires-days');
  const tagsInput = byId('tags');
  const idempotencyKeyInput = byId('idempotency-key');
  const createErrors = byId('create-errors');
  const createResult = byId('create-result');
  const fillSampleButton = byId('fill-sample');

  const modalState = {
    modalElement: byId('created-url-modal'),
    detailsElement: byId('created-url-details'),
    openShortButton: byId('modal-open-short'),
    openTargetButton: byId('modal-open-target'),
    closeButton: byId('modal-close'),
    record: null
  };

  createForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideError(createErrors);

    const targetUrl = targetUrlInput.value.trim();
    if (!targetUrl) {
      showError(createErrors, 'Target URL is required.');
      return;
    }

    const payload = {
      url: targetUrl,
      customCode: customCodeInput.value.trim() || undefined,
      expiresInDays: expiresDaysInput.value ? Number(expiresDaysInput.value) : undefined,
      tags: parseTags(tagsInput.value),
      idempotencyKey: idempotencyKeyInput.value.trim() || undefined
    };

    setResult(createResult, 'Submitting request...');

    try {
      const result = await createShortUrl(payload);
      setResult(createResult, result);
      openCreatedModal(modalState, result.record);
    } catch (error) {
      showError(createErrors, error.message);
      setResult(createResult, error.message);
    }
  });

  fillSampleButton?.addEventListener('click', () => {
    targetUrlInput.value = 'https://example.com/agentic-flow';
    customCodeInput.value = 'agentic-flow';
    expiresDaysInput.value = '30';
    tagsInput.value = 'assignment, review';
    idempotencyKeyInput.value = `sample-${Date.now()}`;
    hideError(createErrors);
  });

  modalState.closeButton?.addEventListener('click', () => closeCreatedModal(modalState));

  modalState.modalElement?.addEventListener('click', (event) => {
    if (event.target === modalState.modalElement) {
      closeCreatedModal(modalState);
    }
  });

  modalState.openShortButton?.addEventListener('click', () => {
    if (modalState.record?.shortUrl) {
      window.open(modalState.record.shortUrl, '_blank', 'noopener,noreferrer');
    }
  });

  modalState.openTargetButton?.addEventListener('click', () => {
    if (modalState.record?.originalUrl) {
      window.open(modalState.record.originalUrl, '_blank', 'noopener,noreferrer');
    }
  });
}

function initLinksFlow() {
  const linksTableBody = byId('links-table-body');
  if (!linksTableBody) {
    return;
  }

  const refreshLinksButton = byId('refresh-links-button');
  const healthCheckButton = byId('health-check-button');
  const healthResult = byId('health-result');

  refreshLinksButton?.addEventListener('click', () => {
    refreshLinksTable(linksTableBody);
  });

  healthCheckButton?.addEventListener('click', () => {
    runHealthCheck(healthResult);
  });

  refreshLinksTable(linksTableBody);
  runHealthCheck(healthResult);
}

function initWorkflowFlow() {
  const workflowSelect = byId('workflow-select');
  const workflowPayload = byId('workflow-payload');
  const runWorkflowButton = byId('run-workflow-button');
  const workflowResult = byId('workflow-result');

  if (!workflowSelect || !workflowPayload || !runWorkflowButton || !workflowResult) {
    return;
  }

  runWorkflowButton.addEventListener('click', async () => {
    setResult(workflowResult, 'Running workflow...');

    let payload;
    try {
      payload = workflowPayload.value.trim() ? JSON.parse(workflowPayload.value) : {};
    } catch {
      setResult(workflowResult, 'Invalid JSON payload.');
      return;
    }

    try {
      const response = await fetch(`/api/workflows/${workflowSelect.value}`, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify(payload)
      });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.message ?? 'Workflow run failed');
      }

      setResult(workflowResult, body);
    } catch (error) {
      setResult(workflowResult, error.message);
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initCreateFlow();
  initLinksFlow();
  initWorkflowFlow();
});
