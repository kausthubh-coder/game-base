// A controlled network ordering probe. Forward authentic card posts to dev Convex.
// Hold the first leave post until the empty-world post finishes. No game code changes.
export function cardProxy(site) {
  let leaving = false,
    pending = null;
  let finished;
  const done = new Promise((resolve) => {
    finished = resolve;
  });
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 5578,
    async fetch(request) {
      const body = await request.text();
      const card = JSON.parse(body);
      const forward = async () => {
        const response = await fetch(`${site}/world-server/card`, {
          method: 'POST',
          headers: {
            Authorization: request.headers.get('Authorization'),
            'Content-Type': 'application/json',
          },
          body,
        });
        return new Response(await response.text(), { status: response.status });
      };
      if (leaving && card.playersNow.length === 1 && !pending) {
        await new Promise((resolve) => {
          pending = resolve;
        });
        const response = await forward();
        finished();
        return response;
      }
      const response = await forward();
      if (leaving && card.playersNow.length === 0) {
        const release = pending;
        pending = null;
        release?.();
      }
      return response;
    },
  });
  return {
    url: 'http://127.0.0.1:5578',
    leaving() {
      leaving = true;
    },
    settled() {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(Error('Card reorder probe did not finish')), 10000);
        done.then(() => {
          clearTimeout(timer);
          resolve();
        });
      });
    },
    stop() {
      pending?.();
      server.stop(true);
    },
  };
}
