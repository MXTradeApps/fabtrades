/**
 * Firebase Cloud Messaging (HTTP v1), which delivers to Android directly and to iOS
 * through APNs.
 *
 * Authenticates with a Firebase service account: a JWT signed with its private key
 * is exchanged for an hour-long OAuth token. Done by hand with Web Crypto rather
 * than a Google SDK, because this is the only Google call any function makes.
 */

export interface PushMessage {
  title: string;
  body: string;
  /** String values only: FCM's `data` map does not take anything else. */
  data: Record<string, string>;
}

/**
 * `unregistered` means the app was uninstalled or the token rotated: the token is
 * deleted so it is never tried again. `failed` is anything else, and is retried.
 */
export type SendResult = 'sent' | 'unregistered' | 'failed';

export interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

/** Parses the `FCM_SERVICE_ACCOUNT` secret, or returns null when it is unusable. */
export function parseServiceAccount(raw: string | undefined): ServiceAccount | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.project_id === 'string' &&
      typeof parsed?.client_email === 'string' &&
      typeof parsed?.private_key === 'string'
    ) {
      return parsed;
    }
  } catch {
    // Fall through: a malformed secret is reported as "not configured".
  }
  return null;
}

function base64url(bytes: Uint8Array | string): string {
  const raw = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes;
  let binary = '';
  for (const b of raw) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function importKey(pem: string): Promise<CryptoKey> {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

export async function accessToken(
  account: ServiceAccount,
  fetchFn: typeof fetch = fetch,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(JSON.stringify({
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const key = await importKey(account.private_key);
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      key,
      new TextEncoder().encode(`${header}.${claims}`),
    ),
  );
  const assertion = `${header}.${claims}.${base64url(signature)}`;

  const response = await fetchFn('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!response.ok) {
    throw new Error(
      `Google OAuth returned ${response.status}: ${await response.text()}`,
    );
  }
  const { access_token } = await response.json();
  return access_token;
}

/** Builds a sender bound to one OAuth token, for one run of a function. */
export function fcmSender(
  projectId: string,
  token: string,
  fetchFn: typeof fetch = fetch,
): (deviceToken: string, message: PushMessage) => Promise<SendResult> {
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  return async (deviceToken, message) => {
    try {
      const response = await fetchFn(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token: deviceToken,
            notification: { title: message.title, body: message.body },
            data: message.data,
            android: { priority: 'high' },
            apns: { payload: { aps: { sound: 'default' } } },
          },
        }),
      });
      if (response.ok) return 'sent';
      const text = await response.text();
      // 404 UNREGISTERED: the app was uninstalled or the token rotated. A 400
      // naming the token means it was never valid. Either way it never will be.
      if (
        response.status === 404 ||
        (response.status === 400 && text.includes('registration token'))
      ) {
        return 'unregistered';
      }
      console.error(`FCM returned ${response.status}: ${text}`);
      return 'failed';
    } catch (error) {
      console.error('FCM request failed', error);
      return 'failed';
    }
  };
}
