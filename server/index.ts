// The Worker: it serves the built game's files from dist/. wrangler.jsonc sends nothing here first, so a
// request reaches this only when no file matches it, and the files' own 404 answers.
export default {
  fetch(request, env): Promise<Response> {
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
