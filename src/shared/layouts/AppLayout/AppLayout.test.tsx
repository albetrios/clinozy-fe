import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';

vi.mock('@/shared/hooks/useAppNav/index.ts', async () => {
  const { TODAY_ONLY_NAV } = await import('@/tests/utils/app-nav-fixture.ts');
  return { useAppNav: () => TODAY_ONLY_NAV };
});
vi.mock('@/core/http/fetch-client.ts', () => ({
  apiClient: {
    get: vi.fn(async () => ({ data: [] })),
    post: vi.fn(),
  },
}));
vi.mock('@/shared/components/OrganizationSwitcher/index.ts', () => ({
  OrganizationSwitcher: () => null,
}));
vi.mock('@/shared/hooks/useMeContext/index.ts', () => ({
  useMeContext: () => ({ data: undefined }),
  meContextQueryKey: ['auth', 'me-context'],
}));

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { Component as AppLayout } from './AppLayout.tsx';

const { sectionChipMock, branchPickerMock } = vi.hoisted(() => ({
  sectionChipMock: vi.fn(),
  branchPickerMock: vi.fn(),
}));
// Swapped so a render throw can be injected into the shell. The section chip is
// deliberately a surface with NO boundary of its own — a throw there reaches
// the shell boundary this file is about.
vi.mock('@/shared/layouts/AppLayout/components/SectionChip/index.ts', () => ({
  SectionChip: () => sectionChipMock() as unknown,
}));
// The branch picker carries its own boundary (SHELL-8): a throw in it must stay there.
vi.mock('@/shared/layouts/AppLayout/components/BranchPicker/index.ts', () => ({
  BranchPicker: () => branchPickerMock() as unknown,
}));

describe('AppLayout', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    sectionChipMock.mockReturnValue(null);
    branchPickerMock.mockReturnValue(<div data-testid="branch-picker" />);
  });

  it('mounts the section bar — the one shell — with its header, main region and tab bar', async () => {
    const { findByTestId, queryByTestId, container } = renderWithProviders(<AppLayout />);

    expect(await findByTestId('app-layout')).toBeInTheDocument();
    expect(await findByTestId('header')).toBeInTheDocument();
    expect(await findByTestId('main-content')).toBeInTheDocument();
    expect(await findByTestId('mobile-bottom-bar')).toBeInTheDocument();
    expect(container.querySelector('[data-shell="section-bar"]')).not.toBeNull();
    // No sidebar on any viewport (`shell.md`).
    expect(queryByTestId('sidebar')).not.toBeInTheDocument();
  });

  it('exposes the search and the Account menu', async () => {
    const { findByTestId } = renderWithProviders(<AppLayout />);

    expect(await findByTestId('search-trigger')).toBeInTheDocument();
    expect(await findByTestId('user-menu-trigger')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container, findByTestId } = renderWithProviders(<AppLayout />);
    await findByTestId('header');

    // The header nav and the phone tab bar are both "Sections"; CSS shows one
    // of them at any width, which jsdom does not apply.
    const results = await axe(container, {
      rules: { 'landmark-unique': { enabled: false } },
    });
    expect(results).toHaveNoViolations();
  });

  describe('SHELL-1 — a crashing shell stays inside the shell', () => {
    let consoleError: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
      consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => {
      consoleError.mockRestore();
    });

    it('contains a shell throw and keeps the layout container mounted', async () => {
      // A throw from inside the shell, in a block that has no boundary of its
      // own — without the shell boundary it reaches the route boundary and
      // replaces the entire authenticated application.
      sectionChipMock.mockImplementation(() => {
        throw new Error('app shell exploded');
      });

      const { findByTestId } = renderWithProviders(<AppLayout />);

      expect(await findByTestId('app-shell-error')).toBeInTheDocument();
      expect(await findByTestId('app-layout')).toBeInTheDocument();
    });

    it('rebuilds the shell on Retry once the cause is gone', async () => {
      const user = userEvent.setup();
      sectionChipMock.mockImplementation(() => {
        throw new Error('app shell exploded');
      });
      const { findByTestId, findByRole, queryByTestId } = renderWithProviders(
        <AppLayout />,
      );
      await findByTestId('app-shell-error');

      sectionChipMock.mockReset();
      sectionChipMock.mockReturnValue(null);
      await user.click(await findByRole('button', { name: 'Retry' }));

      expect(await findByTestId('header')).toBeInTheDocument();
      expect(queryByTestId('app-shell-error')).not.toBeInTheDocument();
    });
  });

  describe('SHELL-8 — a crashing branch picker costs the picker, not the shell', () => {
    let consoleError: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
      consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      branchPickerMock.mockImplementation(() => {
        throw new Error('branch picker exploded');
      });
    });
    afterEach(() => {
      consoleError.mockRestore();
    });

    it('contains the throw in the header control', async () => {
      const { findByTestId, queryByTestId } = renderWithProviders(<AppLayout />);

      // The failure is visible where the picker was...
      expect(await findByTestId('branch-picker-error')).toBeInTheDocument();
      // ...and the shell around it is untouched.
      expect(await findByTestId('main-content')).toBeInTheDocument();
      expect(queryByTestId('app-shell-error')).not.toBeInTheDocument();
    });
  });
});
