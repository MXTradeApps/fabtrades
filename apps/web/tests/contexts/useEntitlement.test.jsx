// Mocked outright rather than with `requireActual`: the real module imports the
// Supabase client, which reads `import.meta.env` and cannot be parsed by Jest.
// `entitlements.test.js` covers the row mapping itself.
jest.mock('../../src/services/entitlements.js', () => ({
  FREE_ENTITLEMENT: Object.freeze({
    isPro: false,
    isInTrial: false,
    hasBillingIssue: false,
    isSandbox: false,
    expiresAt: null,
    productId: null,
    purchasedFrom: null,
  }),
  fetchEntitlement: jest.fn(),
}));

jest.mock('../../src/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

import { act, renderHook, waitFor } from '@testing-library/react';
import { useAuth } from '../../src/contexts/AuthContext';
import { EntitlementProvider, useEntitlement } from '../../src/contexts/EntitlementContext.jsx';
import { FREE_ENTITLEMENT, fetchEntitlement } from '../../src/services/entitlements.js';

const PRO = { ...FREE_ENTITLEMENT, isPro: true, purchasedFrom: 'the App Store' };

const signedIn = (id = 'user-1') => useAuth.mockReturnValue({ user: { id }, loading: false });
const signedOut = () => useAuth.mockReturnValue({ user: null, loading: false });
const stillRestoring = () => useAuth.mockReturnValue({ user: null, loading: true });

const render = () =>
  renderHook(() => useEntitlement(), { wrapper: EntitlementProvider });

beforeEach(() => {
  fetchEntitlement.mockReset();
  fetchEntitlement.mockResolvedValue({ entitlement: FREE_ENTITLEMENT, error: null });
});

describe('useEntitlement', () => {
  test('reads the row for the signed-in user', async () => {
    signedIn('user-7');
    fetchEntitlement.mockResolvedValue({ entitlement: PRO, error: null });

    const { result } = render();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isPro).toBe(true);
    expect(result.current.purchasedFrom).toBe('the App Store');
    expect(fetchEntitlement).toHaveBeenCalledWith('user-7');
  });

  test('starts closed, so a gate never flashes free at a subscriber', async () => {
    signedIn();
    fetchEntitlement.mockResolvedValue({ entitlement: PRO, error: null });

    const { result } = render();

    expect(result.current.loading).toBe(true);
    expect(result.current.isPro).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isPro).toBe(true);
  });

  test('waits for auth before reading anything', () => {
    stillRestoring();

    const { result } = render();

    // A read on a null user mid-restore would resolve to free and then correct
    // itself, which is the flicker `loading` exists to prevent.
    expect(fetchEntitlement).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(true);
  });

  test('resolves to free while signed out, without a query', async () => {
    signedOut();

    const { result } = render();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isPro).toBe(true);
    // Nothing to look up: entitlements are keyed by user.
    expect(fetchEntitlement).not.toHaveBeenCalled();
  });

  test('re-reads when the account changes', async () => {
    signedIn('user-1');
    const { result, rerender } = render();
    await waitFor(() => expect(result.current.loading).toBe(false));

    signedIn('user-2');
    fetchEntitlement.mockResolvedValue({ entitlement: PRO, error: null });
    rerender();

    await waitFor(() => expect(result.current.isPro).toBe(true));
    expect(fetchEntitlement).toHaveBeenLastCalledWith('user-2');
  });

  test('refresh picks up a purchase made in the app', async () => {
    signedIn();
    const { result } = render();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isPro).toBe(true);

    // Web cannot sell Pro, so this is how a purchase completed on a phone shows up
    // in a tab that was already open.
    fetchEntitlement.mockResolvedValue({ entitlement: PRO, error: null });
    await act(() => result.current.refresh());

    expect(result.current.isPro).toBe(true);
  });

  test('leaves gates closed when the row cannot be read', async () => {
    signedIn();
    fetchEntitlement.mockResolvedValue({
      entitlement: FREE_ENTITLEMENT,
      error: { message: 'offline' },
    });

    const { result } = render();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isPro).toBe(true);
  });
});
