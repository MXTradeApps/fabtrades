/**
 * Price alerts: fire the ones whose price condition now holds, then tell their owners.
 *
 * Firing is one SQL statement (`fab_fire_price_alerts`), so it is atomic and needs
 * no logic here. What lives here is the delivery: which fired alerts still need a
 * push, how they are grouped per person, and what happens to a token FCM says is
 * dead. It takes the database and FCM as arguments so it can be tested without
 * either.
 */

import type { PushMessage, SendResult } from '../_shared/fcm.ts';

export interface PendingAlert {
  id: string;
  user_id: string;
  card_id: string;
  card_name: string;
  direction: 'above' | 'below';
  source: 'tcgplayer' | 'cardmarket';
  target_price: number;
  triggered_price: number | null;
}

export interface PushToken {
  token: string;
  user_id: string;
}

export interface Deps {
  fireAlerts(): Promise<number>;
  /** Fired alerts with no `notified_at`, triggered at or after `since`. */
  listPending(since: string): Promise<PendingAlert[]>;
  listTokens(userIds: string[]): Promise<PushToken[]>;
  /** Absent when push is not configured: alerts still fire and show in the app. */
  send?: (token: string, message: PushMessage) => Promise<SendResult>;
  markNotified(alertIds: string[]): Promise<void>;
  deleteTokens(tokens: string[]): Promise<void>;
  now?: Date;
}

export interface RunResult {
  fired: number;
  pending: number;
  pushConfigured: boolean;
  sent: number;
  notified: number;
  tokensRemoved: number;
  /** Users whose every push failed; their alerts stay pending for the next run. */
  failedUsers: string[];
}

/**
 * Older alerts are not pushed. They still show as hit in the app, but a
 * notification about a price from days ago — for instance after push is first
 * configured — would be noise.
 */
export const PUSH_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

/** Above this many alerts for one person in one run, send a single summary. */
export const MAX_INDIVIDUAL_PUSHES = 3;

export function formatPrice(source: PendingAlert['source'], value: number): string {
  const symbol = source === 'tcgplayer' ? '$' : '€';
  return `${symbol}${value.toFixed(2)}`;
}

export function messagesFor(alerts: PendingAlert[]): PushMessage[] {
  if (alerts.length > MAX_INDIVIDUAL_PUSHES) {
    const names = alerts.slice(0, 2).map((a) => a.card_name).join(', ');
    return [{
      title: `${alerts.length} price alerts hit`,
      body: `${names} and ${alerts.length - 2} more. Tap to see them.`,
      data: { type: 'price_alerts' },
    }];
  }
  return alerts.map((a) => {
    const target = formatPrice(a.source, Number(a.target_price));
    const now = a.triggered_price == null
      ? null
      : formatPrice(a.source, Number(a.triggered_price));
    const verb = a.direction === 'above' ? 'rose to' : 'dropped to';
    return {
      title: `${a.card_name} ${verb} ${now ?? target}`,
      body: `Your ${a.direction === 'above' ? 'rise' : 'drop'} alert at ${target} ` +
        'was hit. Tap to view the card.',
      data: { type: 'price_alert', alert_id: a.id, card_id: a.card_id },
    };
  });
}

export async function run(deps: Deps): Promise<RunResult> {
  const now = deps.now ?? new Date();
  const fired = await deps.fireAlerts();
  const pushConfigured = deps.send != null;

  const result: RunResult = {
    fired,
    pending: 0,
    pushConfigured,
    sent: 0,
    notified: 0,
    tokensRemoved: 0,
    failedUsers: [],
  };
  if (!deps.send) return result;

  const since = new Date(now.getTime() - PUSH_WINDOW_MS).toISOString();
  const pending = await deps.listPending(since);
  result.pending = pending.length;
  if (pending.length === 0) return result;

  const byUser = new Map<string, PendingAlert[]>();
  for (const alert of pending) {
    const list = byUser.get(alert.user_id) ?? [];
    list.push(alert);
    byUser.set(alert.user_id, list);
  }

  const tokens = await deps.listTokens([...byUser.keys()]);
  const tokensByUser = new Map<string, string[]>();
  for (const t of tokens) {
    const list = tokensByUser.get(t.user_id) ?? [];
    list.push(t.token);
    tokensByUser.set(t.user_id, list);
  }

  const done: string[] = [];
  const dead: string[] = [];
  for (const [userId, alerts] of byUser) {
    const userTokens = tokensByUser.get(userId) ?? [];
    let delivered = false;
    let anyFailed = false;
    for (const token of userTokens) {
      for (const message of messagesFor(alerts)) {
        const outcome = await deps.send(token, message);
        if (outcome === 'sent') {
          delivered = true;
          result.sent++;
        } else if (outcome === 'unregistered') {
          dead.push(token);
          break;
        } else {
          anyFailed = true;
        }
      }
    }
    // Nobody to tell (no device, or every device gone) is as finished as a
    // delivery. Only a run where every attempt failed is worth retrying.
    if (delivered || !anyFailed) {
      done.push(...alerts.map((a) => a.id));
    } else {
      result.failedUsers.push(userId);
    }
  }

  if (dead.length) {
    await deps.deleteTokens(dead);
    result.tokensRemoved = dead.length;
  }
  if (done.length) {
    await deps.markNotified(done);
    result.notified = done.length;
  }
  return result;
}
