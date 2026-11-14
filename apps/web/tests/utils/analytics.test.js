import { landingPath, trackAppStoreClick, trackEvent } from '../../src/utils/analytics.js';

describe('analytics', () => {
    beforeEach(() => {
        window.sessionStorage.clear();
        delete window.gtag;
        window.history.replaceState({}, '', '/sets/crucible-of-war');
    });

    it('remembers the first page of the visit', () => {
        expect(landingPath()).toBe('/sets/crucible-of-war');
        window.history.replaceState({}, '', '/');
        expect(landingPath()).toBe('/sets/crucible-of-war');
    });

    it('sends events with the landing page', () => {
        window.gtag = jest.fn();
        trackEvent('add_to_trade', { side: 'want' });
        expect(window.gtag).toHaveBeenCalledWith('event', 'add_to_trade', {
            landing_page: '/sets/crucible-of-war',
            side: 'want',
        });
    });

    it('reports app store taps', () => {
        window.gtag = jest.fn();
        trackAppStoreClick('ios', 'navigation');
        expect(window.gtag).toHaveBeenCalledWith('event', 'app_store_click', expect.objectContaining({
            store: 'ios',
            placement: 'navigation',
        }));
    });

    it('does nothing when analytics is blocked or throws', () => {
        expect(() => trackEvent('add_to_trade')).not.toThrow();
        window.gtag = () => { throw new Error('blocked'); };
        expect(() => trackEvent('add_to_trade')).not.toThrow();
    });
});
