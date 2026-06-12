import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Company, UserRole } from '@whatslark/shared';

interface AuthUser extends User {
  company_users?: Array<{
    role: UserRole;
    company_id: string;
    companies: Company;
  }>;
}

interface AuthState {
  user: AuthUser | null;
  company: Company | null;
  role: UserRole | null;
  accessToken: string | null;
  setAuth: (user: AuthUser, company: Company | null, role: UserRole | null, token: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      company: null,
      role: null,
      accessToken: null,
      setAuth: (user, company, role, token) =>
        set({ user, company, role, accessToken: token }),
      clearAuth: () => set({ user: null, company: null, role: null, accessToken: null }),
    }),
    { name: 'whatslark-auth' },
  ),
);
