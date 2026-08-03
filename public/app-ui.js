function initializeUi() {
  const createForm = document.getElementById('create-link-form');
  const createErrors = document.getElementById('create-errors');
  const createResult = document.getElementById('create-result');
  const healthResult = document.getElementById('health-result');
  const linksTableBody = document.getElementById('links-table-body');
  const fillSampleButton = document.getElementById('fill-sample');
  const healthButton = document.getElementById('health-check-button');
  const refreshLinksButton = document.getElementById('refresh-links-button');
  const workflowButton = document.getElementById('run-workflow-button');
  const workflowResult = document.getElementById('workflow-result');
  const createdUrlModal = document.getElementById('created-url-modal');
  const createdUrlDetails = document.getElementById('created-url-details');
  const modalOpenShort = document.getElementById('modal-open-short');
  const modalOpenTarget = document.getElementById('modal-open-target');
  const modalClose = document.getElementById('modal-close');
  const modalState = {
    shortUrl: '',
    targetUrl: ''
  };

  if (!createForm || !createErrors || !createResult || !healthResult || !linksTableBody || !fillSampleButton || !healthButton || !refreshLinksButton || !workflowButton || !workflowResult || !createdUrlModal || !createdUrlDetails || !modalOpenShort || !modalOpenTarget || !modalClose) {
    return;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function closeModal() {
    createdUrlModal.hidden = true;
  }

  function openCreatedUrlModal(record) {
    modalState.shortUrl = record.shortUrl || '';
    modalState.targetUrl = record.targetUrl || '';
    const createdAt = record.createdAt ? new Date(record.createdAt).toLocaleString() : 'n/a';

    createdUrlDetails.innerHTML = [
      '<strong>Code</strong><span>' + escapeHtml(record.code || 'n/a') + '</span>',
      '<strong>Short URL</strong><span><a href="' + escapeHtml(modalState.shortUrl) + '" target="_blank" rel="noopener">' + escapeHtml(modalState.shortUrl || 'n/a') + '</a></span>',
      '<strong>Target URL</strong><span><a href="' + escapeHtml(modalState.targetUrl) + '" target="_blank" rel="noopener">' + escapeHtml(modalState.targetUrl || 'n/a') + '</a></span>',
      '<strong>Created</strong><span>' + escapeHtml(createdAt) + '</span>',
      '<strong>Status</strong><span>Saved and ready to use.</span>'
    ].join('');

    createdUrlModal.hidden = false;
  }

  function renderLinksTable(records) {
    if (!records.length) {
      linksTableBody.innerHTML = '<tr><td colspan="5" class="muted">No URLs created yet.</td></tr>';
      return;
    }

    linksTableBody.innerHTML = records.map((record) => {
      const createdAt = record.createdAt ? new Date(record.createdAt).toLocaleString() : 'n/a';
      return '<tr>' +
        '<td>' + escapeHtml(record.code || '') + '</td>' +
        '<td><a href="' + escapeHtml(record.shortUrl || '#') + '" target="_blank" rel="noopener">' + escapeHtml(record.shortUrl || '') + '</a></td>' +
        '<td><a href="' + escapeHtml(record.targetUrl || '#') + '" target="_blank" rel="noopener">' + escapeHtml(record.targetUrl || '') + '</a></td>' +
        '<td>' + escapeHtml(record.clickCount ?? 0) + '</td>' +
        '<td>' + escapeHtml(createdAt) + '</td>' +
      '</tr>';
    }).join('');
  }

  async function readResponseBody(response) {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return response.json();
    }
    return response.text();
  }

  function setErrorBlock(element, message) {
    element.hidden = false;
    element.textContent = message;
  }

  async function refreshHealth() {
    try {
      const response = await fetch('/health');
      const body = await readResponseBody(response);
      healthResult.textContent = JSON.stringify({ endpoint: '/health', status: response.status, body }, null, 2);
    } catch (error) {
      healthResult.textContent = 'Health check failed: ' + error.message;
    }
  }

  async function refreshLinks() {
    try {
      const response = await fetch('/api/urls');
      const body = await readResponseBody(response);
      const records = Array.isArray(body?.data) ? body.data : [];
      renderLinksTable(records);
    } catch (error) {
      linksTableBody.innerHTML = '<tr><td colspan="5" class="muted">Could not refresh links: ' + escapeHtml(error.message) + '</td></tr>';
    }
  }

  async function runWorkflow() {
    const scenario = document.getElementById('workflow-select').value;
    const payloadInput = document.getElementById('workflow-payload').value.trim();

    workflowResult.textContent = 'Sending workflow request...';

    let body = {};
    if (payloadInput) {
      try {
        body = JSON.parse(payloadInput);
      } catch (error) {
        workflowResult.textContent = 'Workflow payload must be valid JSON.\n' + error.message;
        return;
      }
    }

    try {
      const response = await fetch('/api/workflows/' + scenario, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await readResponseBody(response);
      workflowResult.textContent = JSON.stringify({ status: response.status, data }, null, 2);
    } catch (error) {
      workflowResult.textContent = 'Workflow request failed: ' + error.message;
    }
  }

  fillSampleButton.addEventListener('click', () => {
    document.getElementById('target-url').value = 'https://example.com/docs';
    document.getElementById('custom-code').value = 'team-docs';
    document.getElementById('expires-days').value = '30';
    document.getElementById('tags').value = 'internal, docs';
    document.getElementById('idempotency-key').value = 'request-001';
  });

  createForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    createErrors.hidden = true;
    createErrors.textContent = '';

    const targetUrl = document.getElementById('target-url').value.trim();
    const customCode = document.getElementById('custom-code').value.trim();
    const expiresValue = document.getElementById('expires-days').value;
    const tagsValue = document.getElementById('tags').value.trim();
    const idempotencyKey = document.getElementById('idempotency-key').value.trim();

    const issues = [];

    if (!targetUrl) {
      issues.push('Target URL is required.');
    } else if (!/^https?:\/\//i.test(targetUrl)) {
      issues.push('Only http(s) URLs are supported.');
    }

    if (customCode && !/^[a-zA-Z0-9_-]{4,24}$/.test(customCode)) {
      issues.push('Custom code must be 4-24 letters, numbers, underscores, or dashes.');
    }

    if (issues.length > 0) {
      createErrors.hidden = false;
      createErrors.textContent = issues.join('\n');
      return;
    }

    const payload = {
      url: targetUrl,
      customCode: customCode || undefined,
      expiresInDays: expiresValue ? Number(expiresValue) : undefined,
      tags: tagsValue ? tagsValue.split(',').map((tag) => tag.trim()).filter(Boolean) : [],
      idempotencyKey: idempotencyKey || undefined
    };

    try {
      const response = await fetch('/api/urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await readResponseBody(response);
      if (!response.ok) {
        setErrorBlock(createErrors, JSON.stringify(data, null, 2));
        createResult.textContent = JSON.stringify({ status: response.status, payload, data }, null, 2);
        return;
      }
      createErrors.hidden = true;
      createErrors.textContent = '';
      createResult.textContent = JSON.stringify({ status: response.status, payload, data }, null, 2);
      if (data && data.record) {
        openCreatedUrlModal(data.record);
      }
      await refreshLinks();
    } catch (error) {
      createResult.textContent = 'Request failed: ' + error.message;
    }
  });

  modalOpenShort.addEventListener('click', () => {
    if (modalState.shortUrl) {
      window.open(modalState.shortUrl, '_blank', 'noopener');
    }
  });

  modalOpenTarget.addEventListener('click', () => {
    if (modalState.targetUrl) {
      window.open(modalState.targetUrl, '_blank', 'noopener');
    }
  });

  modalClose.addEventListener('click', () => {
    closeModal();
  });

  createdUrlModal.addEventListener('click', (event) => {
    if (event.target === createdUrlModal) {
      closeModal();
    }
  });

  healthButton.addEventListener('click', () => {
    refreshHealth();
  });

  refreshLinksButton.addEventListener('click', () => {
    refreshLinks();
  });

  workflowButton.addEventListener('click', () => {
    runWorkflow();
  });

  refreshHealth();
  refreshLinks();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeUi);
} else {
  initializeUi();
}
