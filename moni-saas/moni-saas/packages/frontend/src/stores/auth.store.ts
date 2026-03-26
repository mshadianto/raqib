// packages/frontend/src/stores/auth.store.ts
import { create } from 'zustand';
import { api, ApiError } from '../lib/api';

interface User {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  role: string;
}

interface AuthState {
  user: User | null;
  tenants: Tenant[];
  currentTenant: Tenant | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => Promise<void>;
  loadTenants: () => Promise<void>;
  setCurrentTenant: (slug: string) => void;
  init: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  tenants: [],
  currentTenant: null,
  isLoading: true,
  isAuthenticated: false,
  error: null,

  clearError: () => set({ error: null }),

  init: () => {
    api.init();
    const token = typeof window !== 'undefined' ? localStorage.getItem('moni_access_token') : null;
    const userJson = typeof window !== 'undefined' ? localStorage.getItem('moni_user') : null;

    if (token && userJson) {
      try {
        const user = JSON.parse(userJson);
        set({ user, isAuthenticated: true, isLoading: false });
        // Load tenants in background — don't block init
        get().loadTenants();
      } catch {
        // Corrupt localStorage — clear and reset
        api.clearAuth();
        set({ isLoading: false });
      }
    } else {
      set({ isLoading: false });
    }
  },

  login: async (email, password) => {
    set({ error: null });
    try {
      const res = await api.login(email, password);
      const { user, accessToken, refreshToken } = res.data;
      api.setTokens(accessToken, refreshToken);
      localStorage.setItem('moni_user', JSON.stringify(user));
      set({ user, isAuthenticated: true });
      await get().loadTenants();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Login failed';
      set({ error: message });
      throw err;
    }
  },

  register: async (email, password, fullName) => {
    set({ error: null });
    try {
      const res = await api.register(email, password, fullName);
      const { user, accessToken, refreshToken } = res.data;
      api.setTokens(accessToken, refreshToken);
      localStorage.setItem('moni_user', JSON.stringify(user));
      set({ user, isAuthenticated: true });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Registration failed';
      set({ error: message });
      throw err;
    }
  },

  logout: async () => {
    try {
      await api.logout();
    } catch {
      // Server-side logout may fail if session expired — still clear local state
    }
    api.clearAuth();
    set({ user: null, tenants: [], currentTenant: null, isAuthenticated: false, error: null });
  },

  loadTenants: async () => {
    try {
      const res = await api.listTenants();
      const tenants = res.data as Tenant[];
      set({ tenants });

      // Restore saved tenant preference or default to first
      const stored = typeof window !== 'undefined' ? localStorage.getItem('moni_tenant_slug') : null;
      const match = tenants.find((t) => t.slug === stored);
      const selected = match || tenants[0] || null;

      if (selected) {
        api.setTenant(selected.slug);
        set({ currentTenant: selected });
      }
    } catch (err) {
      console.error('Failed to load tenants:', err);
    }
  },

  setCurrentTenant: (slug) => {
    const tenant = get().tenants.find((t) => t.slug === slug);
    if (tenant) {
      api.setTenant(slug);
      set({ currentTenant: tenant });
    }
  },
}));
