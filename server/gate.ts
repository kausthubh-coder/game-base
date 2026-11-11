// The door to Convex, behind one small interface: may this player enter this world, and here is the
// world's card. Convex owns who may enter and shows the card in the world list. The world server only
// asks and tells. The exact calls are written out in server/README.md.

export interface WorldCard {
  worldId: string;
  /** Everyone in the world now, by Clerk user id. Empty when the last player has left. */
  players: { id: string; name: string }[];
  /** When someone last played here, in milliseconds since 1970. */
  lastPlayed: number;
}

export interface Gate {
  /** Asked once when a player joins, with the player's own token, so Convex knows who is asking. */
  mayEnter(worldId: string, token: string): Promise<boolean>;
  /** Told when someone joins or leaves, and every few minutes while a world is awake. It never throws. */
  postCard(card: WorldCard): Promise<void>;
}

/** The stand-in for a machine with no Convex: everyone may enter, and the card goes nowhere. */
export const openGate: Gate = {
  mayEnter: () => Promise.resolve(true),
  postCard: () => Promise.resolve(),
};

/** With Convex not set up and dev tokens off, nobody enters. A deployed server never falls back to the open gate. */
export const shutGate: Gate = {
  mayEnter: () => Promise.resolve(false),
  postCard: () => Promise.resolve(),
};

export const MAY_ENTER = 'worlds:mayEnter';
export const CARD_PATH = '/world-card';

export interface ConvexConfig {
  /** The deployment, https://<name>.convex.cloud. */
  url: string;
  /** Its HTTP actions, https://<name>.convex.site. */
  siteUrl: string;
  /** WORLD_SERVER_SECRET, which Convex holds too. */
  secret: string;
}

const log = (message: string, more: Record<string, unknown>): void => console.error(JSON.stringify({ message, ...more }));

/** `fetcher` is for tests. */
export function convexGate(config: ConvexConfig, fetcher: typeof fetch = fetch): Gate {
  const url = config.url.replace(/\/+$/, ''), siteUrl = config.siteUrl.replace(/\/+$/, '');
  return {
    async mayEnter(worldId, token) {
      try {
        const response = await fetcher(`${url}/api/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ path: MAY_ENTER, args: { worldId }, format: 'json' }),
          signal: AbortSignal.timeout(5000),
        });
        const body = (await response.json()) as { status?: string; value?: unknown; errorMessage?: string };
        if (!response.ok || body.status !== 'success') {
          log('Convex did not answer mayEnter', { worldId, status: response.status, error: body.errorMessage });
          return false;
        }
        // The query answers true or false. `{ allowed: true }` is read too.
        const value = body.value;
        return value === true || (typeof value === 'object' && value !== null && (value as { allowed?: unknown }).allowed === true);
      } catch (error) {
        // Convex is down or slow: nobody new enters. Players already in the world keep playing.
        log('Convex could not be asked mayEnter', { worldId, error: String(error) });
        return false;
      }
    },

    async postCard(card) {
      try {
        const response = await fetcher(`${siteUrl}${CARD_PATH}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.secret}` },
          body: JSON.stringify(card),
          signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) log('Convex did not take the world card', { worldId: card.worldId, status: response.status });
        await response.body?.cancel();
      } catch (error) {
        log('the world card could not be posted', { worldId: card.worldId, error: String(error) });
      }
    },
  };
}
