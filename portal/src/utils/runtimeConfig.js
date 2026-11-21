const PRODUCTION_BACKEND = 'https://aegis-5lpx.onrender.com';

export const getApiBase = () => (
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? 'http://localhost:8000' : PRODUCTION_BACKEND)
).replace(/\/$/, '');

export const getWebSocketBase = () => {
  const configured = import.meta.env.VITE_WS_URL;

  if (configured) {
    return configured;
  }

  const apiBase = getApiBase();
  const url = new URL(apiBase);
  const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${url.host}/ws`;
};
