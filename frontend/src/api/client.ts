// Helper to get CSRF token from document.cookie
function getCsrfToken(): string | null {
  const match = document.cookie.match(/cm_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});

  // Add CSRF token for mutating methods
  const method = (options.method || 'GET').toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrf = getCsrfToken();
    if (csrf) {
      headers.set('x-csrf-token', csrf);
    }
  }

  // Set json content type if body is object and not FormData
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
    credentials: 'include' // include session cookies
  });

  if (!response.ok) {
    let errorMsg = `Request failed: ${response.statusText}`;
    let gateStatus = null;
    try {
      const data = await response.json();
      errorMsg = data.error || errorMsg;
      gateStatus = data.gateStatus || null;
    } catch {
      // ignore
    }
    const err: any = new Error(errorMsg);
    err.status = response.status;
    err.gateStatus = gateStatus;
    throw err;
  }

  return response.json();
}
