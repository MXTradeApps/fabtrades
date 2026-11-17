import posthog from 'posthog-js';
import { initPostHog, landingPath, trackAppStoreClick, trackEvent } from '../../src/utils/analytics.js';

jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { init: jest.fn(), register: jest.fn(), capture: jest.fn() },
}));

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

    // Last on purpose: once started, PostHog stays started for the module.
    describe('PostHog', () => {
        it('stays off without a key', () => {
            initPostHog({ key: null, appEnv: 'production' });
            trackEvent('add_to_trade', { side: 'want' });
            expect(posthog.init).not.toHaveBeenCalled();
            expect(posthog.capture).not.toHaveBeenCalled();
        });

        it('starts once and tags events as web', () => {
            initPostHog({ key: 'phc_test', host: 'https://us.i.posthog.com', appEnv: 'staging' });
            initPostHog({ key: 'phc_test', appEnv: 'staging' });
            expect(posthog.init).toHaveBeenCalledTimes(1);
            expect(posthog.init).toHaveBeenCalledWith('phc_test', expect.objectContaining({
                api_host: 'https://us.i.posthog.com',
                person_profiles: 'identified_only',
            }));
            expect(posthog.register).toHaveBeenCalledWith({
                platform: 'web',
                app_env: 'staging',
                landing_page: '/sets/crucible-of-war',
            });
        });

        it('receives events even when Google Analytics is blocked', () => {
            window.gtag = () => { throw new Error('blocked'); };
            trackAppStoreClick('android', 'price_alert');
            expect(posthog.capture).toHaveBeenCalledWith('app_store_click', {
                store: 'android',
                placement: 'price_alert',
            });
        });

        it('failing does not break the app', () => {
            posthog.capture.mockImplementation(() => { throw new Error('blocked'); });
            expect(() => trackEvent('add_to_trade')).not.toThrow();
        });
    });
});
