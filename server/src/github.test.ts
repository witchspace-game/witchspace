import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { appJwt, pemToPkcs8 } from './github';

// GitHub hands out PKCS#1 keys; WebCrypto, in the Worker, reads only PKCS#8.
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pkcs1 = privateKey.export({ type: 'pkcs1', format: 'pem' }) as string;
const pkcs8 = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
const spki = publicKey.export({ type: 'spki', format: 'der' });

const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

describe('the GitHub App key', () => {
  it('a PKCS#1 key becomes the same PKCS#8 key', () => {
    expect([...pemToPkcs8(pkcs1)]).toEqual([...pemToPkcs8(pkcs8)]);
  });

  it('signs a JWT GitHub can check: RS256, issued by the App, nine minutes', async () => {
    const now = Date.UTC(2026, 9, 27, 12);
    const jwt = await appJwt('123456', pkcs1, now);
    const [h, p, sig] = jwt.split('.');
    expect(JSON.parse(new TextDecoder().decode(fromB64url(h)))).toEqual({ alg: 'RS256', typ: 'JWT' });
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(p)));
    expect(payload).toEqual({ iat: now / 1000 - 60, exp: now / 1000 - 60 + 540, iss: '123456' });
    const key = await crypto.subtle.importKey('spki', spki, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    expect(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, fromB64url(sig), new TextEncoder().encode(`${h}.${p}`))).toBe(true);
  });
});
