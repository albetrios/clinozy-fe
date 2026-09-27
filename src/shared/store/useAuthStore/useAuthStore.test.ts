import { useAuthStore } from './useAuthStore.ts';

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  role: 'admin' as const,
  organizationId: 'org_test1',
  name: 'Test User',
};

describe('useAuthStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: true,
    });
  });

  it('has correct initial state', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(true);
  });

  it('setUser sets user and marks authenticated', () => {
    useAuthStore.getState().setUser(mockUser);
    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.isAuthenticated).toBe(true);
    expect(state.isLoading).toBe(false);
  });

  it('setLoading updates isLoading', () => {
    useAuthStore.getState().setLoading(false);
    expect(useAuthStore.getState().isLoading).toBe(false);
    useAuthStore.getState().setLoading(true);
    expect(useAuthStore.getState().isLoading).toBe(true);
  });

  it('clearAuth resets all auth state', () => {
    // First set a user
    useAuthStore.getState().setUser(mockUser);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    // Then clear
    useAuthStore.getState().clearAuth();
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(false);
  });

  it('clearAuth sets isLoading to false (not true)', () => {
    // Ensure clearing auth doesn't leave the app in a loading state
    useAuthStore.getState().clearAuth();
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('setUser with different roles', () => {
    const user = { ...mockUser, role: 'user' as const };
    useAuthStore.getState().setUser(user);
    expect(useAuthStore.getState().user?.role).toBe('user');

    const superAdmin = { ...mockUser, role: 'super_admin' as const };
    useAuthStore.getState().setUser(superAdmin);
    expect(useAuthStore.getState().user?.role).toBe('super_admin');
  });
});
