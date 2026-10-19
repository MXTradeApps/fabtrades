/**
 * Fire-and-forget `price_alert_triggered` capture, keyed on the Supabase user id the
 * app identifies with. Analytics is best-effort and never fails the run.
 */

const POSTHOG_HOST = 'https://us.i.posthog.com';

export interface FiredAlert {
  id: string;
  user_id: string;
  card_id: string;
  direction: string;
  source: string;
  target_price: number;
  triggered_price: number | null;
}

export async function captureTriggered(
  apiKey: string | undefined,
  alert: FiredAlert,
  fetchFn: typeof fetch = fetch,
): Promise<void> {
  if (!apiKey) return;
  try {
    await fetchFn(`${POSTHOG_HOST}/i/v0/e/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        event: 'price_alert_triggered',
        distinct_id: alert.user_id,
        properties: {
          alert_id: alert.id,
          card_id: alert.card_id,
          direction: alert.direction,
          price_source: alert.source,
          target_price: Number(alert.target_price),
          triggered_price: alert.triggered_price == null
            ? null
            : Number(alert.triggered_price),
          $lib: 'price-alerts',
        },
      }),
    });
  } catch (error) {
    console.error('PostHog capture failed (non-fatal)', error);
  }
}
