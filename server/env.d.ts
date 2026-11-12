// The Worker's bindings, as wrangler.jsonc names them. Written by hand: `wrangler types` reads .env.local
// too and would list the dev keys, which the Worker never sees.
interface Env {
  ASSETS: Fetcher;
}
