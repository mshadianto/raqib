// packages/frontend/src/lib/api.ts
// Typed API client with JWT auth, tenant context, request timeout, and retry limits

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000/api/v1';
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_REFRESH_RETRIES = 1;

interface ApiOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  tenantSlug?: string;
  timeoutMs?: number;
}

class ApiClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tenantSlug: string | null = null;
  private refreshPromise: Promise<boolean> | null = null;

  setTokens(access: string, refresh: string) {
    this.accessToken = access;
    this.refreshToken = refresh;
    if (typeof window !== 'undefined') {
      localStorage.setItem('moni_access_token', access);
      localStorage.setItem('moni_refresh_token', refresh);
    }
  }

  setTenant(slug: string) {
    this.tenantSlug = slug;
    if (typeof window !== 'undefined') {
      localStorage.setItem('moni_tenant_slug', slug);
    }
  }

  init() {
    if (typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('moni_access_token');
      this.refreshToken = localStorage.getItem('moni_refresh_token');
      this.tenantSlug = localStorage.getItem('moni_tenant_slug');
    }
  }

  clearAuth() {
    this.accessToken = null;
    this.refreshToken = null;
    this.tenantSlug = null;
    this.refreshPromise = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('moni_access_token');
      localStorage.removeItem('moni_refresh_token');
      localStorage.removeItem('moni_tenant_slug');
      localStorage.removeItem('moni_user');
    }
  }

  async request<T = any>(path: string, options: ApiOptions = {}): Promise<T> {
    const { method = 'GET', body, headers = {}, tenantSlug, timeoutMs = REQUEST_TIMEOUT_MS } = options;

    const slug = tenantSlug || this.tenantSlug;
    const reqHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    if (this.accessToken) {
      reqHeaders['Authorization'] = `Bearer ${this.accessToken}`;
    }
    if (slug) {
      reqHeaders['X-Tenant-Slug'] = slug;
    }

    const res = await this.fetchWithTimeout(path, method, reqHeaders, body, timeoutMs);

    // Handle token refresh — single attempt only
    if (res.status === 401 && this.refreshToken) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        reqHeaders['Authorization'] = `Bearer ${this.accessToken}`;
        const retryRes = await this.fetchWithTimeout(path, method, reqHeaders, body, timeoutMs);
        return this.handleResponse<T>(retryRes);
      }
      // Refresh failed — clear auth and redirect
      this.clearAuth();
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login';
      }
      throw new ApiError('SESSION_EXPIRED', 'Session expired. Please log in again.', 401);
    }

    return this.handleResponse<T>(res);
  }

  private async fetchWithTimeout(
    path: string,
    method: string,
    headers: Record<string, string>,
    body: unknown | undefined,
    timeoutMs: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new ApiError('TIMEOUT', 'Request timed out', 0);
      }
      throw new ApiError('NETWORK_ERROR', 'Network error — check your connection', 0);
    } finally {
      clearTimeout(timer);
    }
  }

  private async handleResponse<T>(res: Response): Promise<T> {
    const data = await res.json();
    if (!res.ok) {
      throw new ApiError(
        data.error?.code || 'UNKNOWN',
        data.error?.message || 'Request failed',
        res.status
      );
    }
    return data;
  }

  /**
   * Token refresh with deduplication — if multiple requests
   * get 401 at the same time, they share a single refresh call.
   */
  private async tryRefresh(): Promise<boolean> {
    // Reuse in-flight refresh
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = (async () => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10_000);

        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: this.refreshToken }),
          signal: controller.signal,
        });

        clearTimeout(timer);
        if (!res.ok) return false;

        const data = await res.json();
        this.setTokens(data.data.accessToken, data.data.refreshToken);
        return true;
      } catch {
        return false;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  // ─── Auth ───────────────────────────────
  login(email: string, password: string) {
    return this.request('/auth/login', { method: 'POST', body: { email, password } });
  }
  register(email: string, password: string, fullName: string) {
    return this.request('/auth/register', { method: 'POST', body: { email, password, fullName } });
  }
  logout() {
    return this.request('/auth/logout', { method: 'POST' });
  }

  // ─── Tenants ────────────────────────────
  listTenants() {
    return this.request('/tenants');
  }
  createTenant(name: string, slug: string) {
    return this.request('/tenants', { method: 'POST', body: { name, slug } });
  }
  getTenant(slug: string) {
    return this.request(`/tenants/${slug}`);
  }
  inviteMember(email: string, role: string) {
    return this.request(`/tenants/${this.tenantSlug}/invite`, { method: 'POST', body: { email, role } });
  }

  // ─── Regulatory ─────────────────────────
  getAlerts(params?: Record<string, string>) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request(`/regulatory/alerts${qs}`);
  }
  updateAlert(id: string, status: string) {
    return this.request(`/regulatory/alerts/${id}`, { method: 'PATCH', body: { status } });
  }
  getRegulatoryStats() {
    return this.request('/regulatory/stats');
  }

  // ─── Portfolio ──────────────────────────
  getPortfolio() {
    return this.request('/portfolio/holdings');
  }
  addHolding(data: Record<string, unknown>) {
    return this.request('/portfolio/holdings', { method: 'POST', body: data });
  }
  updateHolding(id: string, data: Record<string, unknown>) {
    return this.request(`/portfolio/holdings/${id}`, { method: 'PUT', body: data });
  }
  deleteHolding(id: string) {
    return this.request(`/portfolio/holdings/${id}`, { method: 'DELETE' });
  }

  // ─── Audit Trail ───────────────────────
  getAuditEntries(params?: Record<string, string>) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request(`/audit${qs}`);
  }
  getAuditStats() {
    return this.request('/audit/stats');
  }

  // ─── Billing ────────────────────────────
  getSubscription() {
    return this.request('/billing/subscription');
  }
  checkout(plan: string, gateway: string, successUrl: string, cancelUrl: string) {
    return this.request('/billing/checkout', {
      method: 'POST',
      body: { plan, gateway, successUrl, cancelUrl },
    });
  }

  // ─── Hermes Agents ─────────────────────
  getAgents() {
    return this.request('/hermes/agents');
  }
  executeAgent(agentId: string, skillName: string, input: string) {
    return this.request('/hermes/execute', {
      method: 'POST',
      body: { agentId, skillName, input },
      timeoutMs: 60_000, // Agent execution can be slow
    });
  }
  getAgentExecutions(params?: Record<string, string>) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request(`/hermes/executions${qs}`);
  }
  scanRegulations(sources: string[]) {
    return this.request('/hermes/scan-regulations', {
      method: 'POST',
      body: { sources },
      timeoutMs: 60_000,
    });
  }
  analyzePortfolio() {
    return this.request('/hermes/analyze-portfolio', {
      method: 'POST',
      timeoutMs: 60_000,
    });
  }
}

export class ApiError extends Error {
  constructor(public code: string, message: string, public statusCode: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export const api = new ApiClient();
