// Token checks with a key pair made here, standing in for Clerk's.
import { beforeEach, describe, expect, test } from 'bun:test';
import { createTokenCheck, forgetKeys, type AuthConfig } from '../auth.ts';

const ISSUER = 'https://game.clerk.accounts.dev';
const NOW = 1_800_000_000_000;

const b64 = (bytes: Uint8Array | string): string => Buffer.from(bytes).toString('base64url');

async function keyPair(kid: string): Promise<{ sign(claims: object, header?: object): Promise<string>; jwk: JsonWebKey & { kid: string } }> {
  const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const jwk = { ...(await crypto.subtle.exportKey('jwk', pair.publicKey)), kid, use: 'sig' };
  return {
    jwk,
    async sign(claims, header = { alg: 'RS256', typ: 'JWT', kid }) {
      const body = `${b64(JSON.stringify(header))}.${b64(JSON.stringify(claims))}`;
      const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(body));
      return `${body}.${b64(new Uint8Array(signature))}`;
    },
  };
}

/** Clerk's key address, answered from here. It counts how often it was asked. */
function clerk(jwks: object[]): { fetcher: typeof fetch; calls: string[] } {
  const calls: string[] = [];
  const fetcher = (async (url: string) => {
    calls.push(url);
    return Response.json({ keys: jwks });
  }) as unknown as typeof fetch;
  return { fetcher, calls };
}

const config = (more: Partial<AuthConfig> = {}): AuthConfig => ({ issuer: ISSUER, audience: '', parties: [], devTokens: false, ...more });
const claims = (more: object = {}): object => ({ iss: ISSUER, sub: 'user_2abc', exp: NOW / 1000 + 60, nbf: NOW / 1000 - 10, iat: NOW / 1000 - 10, ...more });

const key = await keyPair('ins_1');
const other = await keyPair('ins_other');

beforeEach(forgetKeys);

describe('a Clerk token', () => {
  test('a good one names the player', async () => {
    const { fetcher, calls } = clerk([key.jwk]);
    const check = createTokenCheck(config(), fetcher, () => NOW);
    expect(await check(await key.sign(claims({ name: 'Ann' })))).toEqual({ id: 'user_2abc', name: 'Ann' });
    expect(await check(await key.sign(claims()))).toEqual({ id: 'user_2abc', name: 'Player' });
    expect(calls).toEqual([`${ISSUER}/.well-known/jwks.json`]);
  });

  test('the keys are fetched once, however many tokens and worlds there are', async () => {
    const { fetcher, calls } = clerk([key.jwk]);
    const one = createTokenCheck(config(), fetcher, () => NOW), two = createTokenCheck(config(), fetcher, () => NOW);
    const token = await key.sign(claims());
    await Promise.all([one(token), one(token), one(token)]);
    for (let i = 0; i < 20; i++) expect(await two(token)).not.toBeNull();
    expect(calls.length).toBe(1);
  });

  test('a token signed with another key, or changed after signing, is refused', async () => {
    const { fetcher } = clerk([key.jwk]);
    const check = createTokenCheck(config(), fetcher, () => NOW);
    expect(await check(await other.sign(claims(), { alg: 'RS256', kid: 'ins_1' }))).toBeNull();
    const [head, , signature] = (await key.sign(claims())).split('.');
    expect(await check(`${head}.${b64(JSON.stringify(claims({ sub: 'user_someone_else' })))}.${signature}`)).toBeNull();
  });

  test('an unknown key id does not make a fetch for every token', async () => {
    const { fetcher, calls } = clerk([key.jwk]);
    let now = NOW;
    const check = createTokenCheck(config(), fetcher, () => now);
    expect(await check(await key.sign(claims()))).not.toBeNull();
    const stranger = await other.sign(claims());
    for (let i = 0; i < 10; i++) expect(await check(stranger)).toBeNull();
    expect(calls.length).toBe(1);
    // Five minutes on, a new key id is worth one look: Clerk may have changed keys.
    now += 5 * 60 * 1000 + 1;
    expect(await check(await other.sign(claims({ exp: now / 1000 + 60 })))).toBeNull();
    expect(calls.length).toBe(2);
  });

  test('out of date, not yet valid, from another issuer, or for another audience: refused', async () => {
    const { fetcher } = clerk([key.jwk]);
    const check = createTokenCheck(config({ audience: 'convex', parties: ['https://play.example'] }), fetcher, () => NOW);
    const good = { aud: 'convex', azp: 'https://play.example' };
    expect(await check(await key.sign(claims(good)))).not.toBeNull();
    expect(await check(await key.sign(claims({ ...good, exp: NOW / 1000 - 6 })))).toBeNull();
    expect(await check(await key.sign(claims({ ...good, nbf: NOW / 1000 + 6 })))).toBeNull();
    expect(await check(await key.sign(claims({ ...good, iss: 'https://evil.example' })))).toBeNull();
    expect(await check(await key.sign(claims({ ...good, aud: 'something-else' })))).toBeNull();
    expect(await check(await key.sign(claims({ azp: 'https://play.example' })))).toBeNull();
    expect(await check(await key.sign(claims({ ...good, azp: 'https://evil.example' })))).toBeNull();
    expect(await check(await key.sign(claims({ ...good, sub: undefined })))).toBeNull();
  });

  test('only RS256 is read', async () => {
    const { fetcher } = clerk([key.jwk]);
    const check = createTokenCheck(config(), fetcher, () => NOW);
    expect(await check(`${b64('{"alg":"none","kid":"ins_1"}')}.${b64(JSON.stringify(claims()))}.`)).toBeNull();
    expect(await check(await key.sign(claims(), { alg: 'HS256', kid: 'ins_1' }))).toBeNull();
    expect(await check('not-a-token')).toBeNull();
    expect(await check('')).toBeNull();
  });

  test('Clerk being down refuses the token and does not throw', async () => {
    const fetcher = (async () => { throw new Error('no network'); }) as unknown as typeof fetch;
    const check = createTokenCheck(config(), fetcher, () => NOW);
    expect(await check(await key.sign(claims()))).toBeNull();
  });
});

describe('a dev token', () => {
  test('is read only when dev tokens are on', async () => {
    const { fetcher, calls } = clerk([key.jwk]);
    const on = createTokenCheck(config({ issuer: '', devTokens: true }), fetcher, () => NOW);
    const off = createTokenCheck(config({ issuer: '' }), fetcher, () => NOW);
    expect(await on('dev:ann')).toEqual({ id: 'dev_ann', name: 'ann' });
    expect(await on('dev:ann:Ann of the Hill')).toEqual({ id: 'dev_ann', name: 'Ann of the Hill' });
    expect(await on('dev:')).toBeNull();
    expect(await on('dev:has spaces')).toBeNull();
    expect(await off('dev:ann')).toBeNull();
    // With no issuer set, nothing is fetched and no Clerk token is taken.
    expect(await off(await key.sign(claims()))).toBeNull();
    expect(calls.length).toBe(0);
  });
});
