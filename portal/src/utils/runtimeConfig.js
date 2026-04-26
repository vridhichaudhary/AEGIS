const PRODUCTION_BACKEND = 'https://aegis-5lpx.onrender.com';

const isLocalBackend = (value) =>
  typeof value === 'string' &&
  (value.includes('localhost:8000') || value.includes('127.0.0.1:8000'));

export const getApiBase = () => {
  const configured = import.meta.env.VITE_API_BASE_URL;

  if (configured) {
    if (!import.meta.env.DEV && isLocalBackend(configured)) {
      return PRODUCTION_BACKEND;
    }
    return configured;
  }

  return import.meta.env.DEV ? 'http://localhost:8000' : PRODUCTION_BACKEND;
};

export const getWebSocketBase = () => {
  const configured = import.meta.env.VITE_WS_URL;

  if (configured) {
    if (!import.meta.env.DEV && isLocalBackend(configured)) {
      return `${PRODUCTION_BACKEND.replace('https://', 'wss://')}/ws`;
    }
    return configured;
  }

  const apiBase = getApiBase();
  const url = new URL(apiBase);
  const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${url.host}/ws`;
};
