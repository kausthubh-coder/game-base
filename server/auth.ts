// Who is at the door. The real token is Clerk's: a JWT signed with Clerk's private key. Its signature is
// checked here with Clerk's public keys, which are fetched once and kept, so checking a token makes no
// network call. Only WebCrypto is used: no library.
//
// Clerk's steps for checking a token by hand (https://clerk.com/docs/guides/sessions/manual-jwt-verification):
// the algorithm is RS256, the signature fits a key of the instance, `exp` and `nbf` hold now, and `azp`
// is an origin we know. On top of those the issuer must be ours, and the audience when one is asked for.
//
// On this machine, with no Clerk set up, a dev token is `dev:<id>` or `dev:<id>:<name>`. It is read only
// when DEV_TOKENS is "1" in .dev.vars.

export interface Identity {
  /** Clerk's user id, the token's `sub`. */
  id: string;
  name: string;
}

export interface AuthConfig {
  /** Clerk's Frontend API URL. Empty when Clerk is not set up: then no Clerk token is taken. */
  issuer: string;
  /** When not empty, the token's `aud` must be this or hold it. */
  audience: string;
  /** When not empty, a token's `azp` must be one of these origins. */
  parties: readonly string[];
  devTokens: boolean;
}

export type TokenCheck = (token: string) => Promise<Identity | null>;

/** Seconds a clock may be off by. Clerk's own check allows the same. */
const SKEW = 5;
/** A key id that is not among the kept keys makes one new fetch, at most this often. Clerk changes keys rarely. */
const REFETCH_MS = 5 * 60 * 1000;
const DEV_TOKEN = /^dev:([A-Za-z0-9_-]{1,32})(?::([^:]{1,32}))?$/;

interface Kept {
  keys: Map<string, CryptoKey>;
  /** When they were fetched, in milliseconds since 1970. */
  at: number;
}

/**
 * The public keys by issuer, for every world in this isolate. Only finished keys are shared: a promise
 * made in one Durable Object must not be awaited in another.
 */
const kept = new Map<string, Kept>();

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> | null {
  try {
    const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function jsonPart(text: string): Record<string, unknown> | null {
  const bytes = fromBase64Url(text);
  if (!bytes) return null;
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

async function fetchKeys(issuer: string, fetcher: typeof fetch): Promise<Map<string, CryptoKey>> {
  const response = await fetcher(`${issuer}/.well-known/jwks.json`, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`Clerk's keys answered ${response.status}`);
  const body = (await response.json()) as { keys?: (JsonWebKey & { kid?: string })[] };
  const keys = new Map<string, CryptoKey>();
  for (const jwk of body.keys ?? []) {
    if (jwk.kty !== 'RSA' || typeof jwk.kid !== 'string') continue;
    keys.set(jwk.kid, await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']));
  }
  return keys;
}

/** `fetcher` and `now` are for tests. The server passes neither. */
export function createTokenCheck(config: AuthConfig, fetcher: typeof fetch = fetch, now: () => number = Date.now): TokenCheck {
  const issuer = config.issuer.replace(/\/+$/, '');
  let fetching: Promise<void> | null = null;

  async function keyFor(kid: string): Promise<CryptoKey | null> {
    const have = kept.get(issuer);
    const key = have?.keys.get(kid);
    if (key) return key;
    if (have && now() - have.at < REFETCH_MS) return null;
    fetching ??= fetchKeys(issuer, fetcher)
      .then((keys) => void kept.set(issuer, { keys, at: now() }))
      .catch((error: unknown) => {
        console.error(JSON.stringify({ message: 'could not fetch Clerk\'s public keys', issuer, error: String(error) }));
      })
      .finally(() => { fetching = null; });
    await fetching;
    return kept.get(issuer)?.keys.get(kid) ?? null;
  }

  async function clerk(token: string): Promise<Identity | null> {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const header = jsonPart(parts[0]), claims = jsonPart(parts[1]), signature = fromBase64Url(parts[2]);
    if (!header || !claims || !signature) return null;
    if (header.alg !== 'RS256' || typeof header.kid !== 'string') return null;

    const key = await keyFor(header.kid);
    if (!key) return null;
    const signed = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    if (!(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, signed))) return null;

    const seconds = now() / 1000;
    if (typeof claims.exp !== 'number' || claims.exp < seconds - SKEW) return null;
    if (typeof claims.nbf === 'number' && claims.nbf > seconds + SKEW) return null;
    if (typeof claims.iss !== 'string' || claims.iss.replace(/\/+$/, '') !== issuer) return null;
    if (config.audience) {
      const aud = claims.aud;
      if (!(aud === config.audience || (Array.isArray(aud) && aud.includes(config.audience)))) return null;
    }
    if (config.parties.length > 0 && typeof claims.azp === 'string' && !config.parties.includes(claims.azp)) return null;
    if (typeof claims.sub !== 'string' || claims.sub === '') return null;
    const name = typeof claims.name === 'string' && claims.name !== '' ? claims.name.slice(0, 32) : 'Player';
    return { id: claims.sub, name };
  }

  return async (token) => {
    if (config.devTokens) {
      const dev = DEV_TOKEN.exec(token);
      if (dev) return { id: `dev_${dev[1]}`, name: dev[2] ?? dev[1] };
    }
    if (issuer === '') return null;
    try {
      return await clerk(token);
    } catch (error) {
      console.error(JSON.stringify({ message: 'a token could not be checked', error: String(error) }));
      return null;
    }
  };
}

/** For tests: forget every kept key. */
export function forgetKeys(): void {
  kept.clear();
}
