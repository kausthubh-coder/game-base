// What the rules read that Vite gives the browser and the server does not have. wrangler.jsonc defines
// `import.meta.env` as an empty object, so every value here is undefined at run time.
interface ImportMetaEnv {
  readonly VITE_TOWN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
