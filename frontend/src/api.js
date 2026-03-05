const DEFAULT_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5173';
const API_BEARER_TOKEN = import.meta.env.VITE_API_BEARER_TOKEN || '';

function assertToken() {
  if (!API_BEARER_TOKEN) {
    throw new Error('Missing VITE_API_BEARER_TOKEN in frontend env');
  }
}

function buildUrl(pathname, searchParams) {
  const url = new URL(pathname, DEFAULT_API_BASE_URL.endsWith('/') ? DEFAULT_API_BASE_URL : `${DEFAULT_API_BASE_URL}/`);
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url;
}

async function request(pathname, { method = 'GET', body, searchParams } = {}) {
  assertToken();
  const response = await fetch(buildUrl(pathname, searchParams), {
    method,
    headers: {
      authorization: `Bearer ${API_BEARER_TOKEN}`,
      ...(body ? { 'content-type': 'application/json' } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = undefined;
  }

  if (!response.ok) {
    const errorMessage = payload?.error || `Request failed with status ${response.status}`;
    const error = new Error(errorMessage);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export function listProjects() {
  return request('/projects');
}

export function createProject(input) {
  return request('/projects', { method: 'POST', body: input });
}

export function getProject(project) {
  return request(`/projects/${encodeURIComponent(project)}`);
}

export function getProjectPrompts(project) {
  return request(`/projects/${encodeURIComponent(project)}/prompts`);
}

export function patchProjectContent(project, body) {
  return request(`/projects/${encodeURIComponent(project)}/content`, {
    method: 'PATCH',
    body
  });
}

export function patchProjectConfig(project, config) {
  return request(`/projects/${encodeURIComponent(project)}/config`, {
    method: 'PATCH',
    body: { config }
  });
}

export function regenerateProject(project, body) {
  return request(`/projects/${encodeURIComponent(project)}/regenerate`, {
    method: 'POST',
    body
  });
}

export function getJob(jobId) {
  return request(`/jobs/${encodeURIComponent(jobId)}`);
}

export function getProjectAnalytics(project) {
  return request(`/projects/${encodeURIComponent(project)}/analytics`);
}

export function getProjectAnalyticsRuns(project) {
  return request(`/projects/${encodeURIComponent(project)}/analytics/runs`);
}

function toAssetRoute(project, assetPath) {
  const encodedAssetPath = assetPath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `/projects/${encodeURIComponent(project)}/assets/${encodedAssetPath}`;
}

export function toDisplayAssetUrl(project, asset, cacheKey = '') {
  if (!asset || typeof asset !== 'object') {
    return '';
  }

  if (asset.referenceType === 'url') {
    return asset.value || '';
  }

  if (!asset.path) {
    return '';
  }

  const url = buildUrl(toAssetRoute(project, asset.path), {
    access_token: API_BEARER_TOKEN,
    ...(cacheKey ? { v: cacheKey } : {})
  });
  return url.toString();
}

export function getApiConfigSummary() {
  return {
    apiBaseUrl: DEFAULT_API_BASE_URL,
    hasToken: Boolean(API_BEARER_TOKEN)
  };
}
