import { assertEquals } from 'jsr:@std/assert@1';

import type { PushMessage, SendResult } from '../_shared/fcm.ts';
import { MAX_INDIVIDUAL_PUSHES, messagesFor, PUSH_WINDOW_MS, run } from './alerts.ts';
import type { PendingAlert, PushToken } from './alerts.ts';

const NOW = new Date('2026-10-20T06:30:00Z');
const ALICE = '9f1c0b62-0000-4000-8000-000000000001';
const BOB = '9f1c0b62-0000-4000-8000-000000000002';

function alert(overrides: Partial<PendingAlert> = {}): PendingAlert {
  return {
    id: 'a1',
    user_id: ALICE,
    card_id: 'card-1',
    card_name: 'Command and Conquer',
    direction: 'above',
    source: 'tcgplayer',
    target_price: 20,
    triggered_price: 21.5,
    ...overrides,
  };
}

function harness({
  pending = [alert()],
  tokens = [{ token: 't-alice', user_id: ALICE }] as PushToken[],
  outcomes = {} as Record<string, SendResult>,
  push = true,
} = {}) {
  const sent: { token: string; message: PushMessage }[] = [];
  const notified: string[] = [];
  const deleted: string[] = [];
  const sinces: string[] = [];
  return {
    sent,
    notified,
    deleted,
    sinces,
    run: () =>
      run({
        now: NOW,
        fireAlerts: () => Promise.resolve(pending.length),
        listPending: (since) => {
          sinces.push(since);
          return Promise.resolve(pending);
        },
        listTokens: (ids) =>
          Promise.resolve(tokens.filter((t) => ids.includes(t.user_id))),
        send: push
          ? (token, message) => {
            sent.push({ token, message });
            return Promise.resolve(outcomes[token] ?? 'sent');
          }
          : undefined,
        markNotified: (ids) => {
          notified.push(...ids);
          return Promise.resolve();
        },
        deleteTokens: (t) => {
          deleted.push(...t);
          return Promise.resolve();
        },
      }),
  };
}

Deno.test('pushes a fired alert and marks it notified', async () => {
  const h = harness();
  const result = await h.run();
  assertEquals(result.fired, 1);
  assertEquals(result.sent, 1);
  assertEquals(h.sent[0].token, 't-alice');
  assertEquals(h.sent[0].message.title, 'Command and Conquer rose to $21.50');
  assertEquals(h.sent[0].message.data, {
    type: 'price_alert',
    alert_id: 'a1',
    card_id: 'card-1',
  });
  assertEquals(h.notified, ['a1']);
});

Deno.test('only looks at alerts fired within the push window', async () => {
  const h = harness();
  await h.run();
  assertEquals(h.sinces, [new Date(NOW.getTime() - PUSH_WINDOW_MS).toISOString()]);
});

Deno.test('without push configured, fires but sends and marks nothing', async () => {
  const h = harness({ push: false });
  const result = await h.run();
  assertEquals(result.fired, 1);
  assertEquals(result.pushConfigured, false);
  assertEquals(h.notified, []);
});

Deno.test('a user with no devices is marked notified so they are not retried', async () => {
  const h = harness({ tokens: [] });
  const result = await h.run();
  assertEquals(result.sent, 0);
  assertEquals(h.notified, ['a1']);
});

Deno.test('an unregistered token is deleted and the alert counts as done', async () => {
  const h = harness({ outcomes: { 't-alice': 'unregistered' } });
  const result = await h.run();
  assertEquals(h.deleted, ['t-alice']);
  assertEquals(result.tokensRemoved, 1);
  assertEquals(h.notified, ['a1']);
});

Deno.test('a failed push leaves the alert pending and reports the user', async () => {
  const h = harness({ outcomes: { 't-alice': 'failed' } });
  const result = await h.run();
  assertEquals(h.notified, []);
  assertEquals(result.failedUsers, [ALICE]);
});

Deno.test('one working device is enough, even if another failed', async () => {
  const h = harness({
    tokens: [
      { token: 't-phone', user_id: ALICE },
      { token: 't-tablet', user_id: ALICE },
    ],
    outcomes: { 't-tablet': 'failed' },
  });
  const result = await h.run();
  assertEquals(h.notified, ['a1']);
  assertEquals(result.failedUsers, []);
});

Deno.test('each user only gets their own alerts', async () => {
  const h = harness({
    pending: [alert(), alert({ id: 'b1', user_id: BOB, card_name: 'Snatch' })],
    tokens: [
      { token: 't-alice', user_id: ALICE },
      { token: 't-bob', user_id: BOB },
    ],
  });
  await h.run();
  assertEquals(
    h.sent.map((s) => [s.token, s.message.data.alert_id]),
    [['t-alice', 'a1'], ['t-bob', 'b1']],
  );
});

Deno.test('many alerts for one person collapse into a summary', () => {
  const many = Array.from(
    { length: MAX_INDIVIDUAL_PUSHES + 1 },
    (_, i) => alert({ id: `a${i}`, card_name: `Card ${i}` }),
  );
  const messages = messagesFor(many);
  assertEquals(messages.length, 1);
  assertEquals(messages[0].title, '4 price alerts hit');
  assertEquals(messages[0].body, 'Card 0, Card 1 and 2 more. Tap to see them.');
});

Deno.test('a drop alert in CardMarket reads in euros', () => {
  const [message] = messagesFor([
    alert({
      direction: 'below',
      source: 'cardmarket',
      target_price: 5,
      triggered_price: 4.2,
    }),
  ]);
  assertEquals(message.title, 'Command and Conquer dropped to €4.20');
  assertEquals(
    message.body,
    'Your drop alert at €5.00 was hit. Tap to view the card.',
  );
});
