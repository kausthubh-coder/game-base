// Vite's production-only asset packaging. Source assets and development URLs stay untouched.
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { resolve, relative, dirname, extname } from 'node:path';
export function assetBuild() {
  let config, painted = {};
  return {
    name: 'game-asset-cache', apply: 'build',
    async configResolved(value) {
      config = value;
      const manifest = JSON.parse(await readFile(resolve(config.root, 'public/assets/manifest.json')));
      for (const [id, file] of Object.entries(manifest.painted?.textures ?? {})) {
        const bytes = await readFile(resolve(config.root, 'public/assets', file));
        const ext = extname(file), hash = createHash('sha256').update(bytes).digest('hex').slice(0,12);
        painted[id] = `fingerprinted/${file.slice(0,-ext.length)}.${hash}${ext}`;
      }
    },
    transform(code, id) {
      // This legacy loader constructs image URLs rather than reading the manifest. Adapt it only in builds.
      if (!id.endsWith('/src/features/painted/textures.ts')) return;
      const needle = 'img.src = `${base}${name}.webp`;';
      if (!code.includes(needle)) throw Error('Painted texture URL adapter needs updating');
      return code.replace(needle, `img.src = new URL('../' + ${JSON.stringify(painted)}[name], new URL(base, document.baseURI)).href;`);
    },
    async closeBundle() {
      const out = resolve(config.root, config.build.outDir), base = resolve(out, 'assets');
      const files = new Map();
      async function walk(dir) {
        for (const e of await readdir(dir, {withFileTypes:true})) {
          if (e.name === 'fingerprinted') continue;
          const path = resolve(dir,e.name);
          if(e.isDirectory()) await walk(path);
          else files.set(relative(base,path),await readFile(path));
        }
      }
      await walk(base);
      const names = new Map(), active = new Set();
      const rewrite = async value => {
        if(typeof value === 'string' && files.has(value)) return pack(value);
        if(Array.isArray(value)) return Promise.all(value.map(rewrite));
        if(value && typeof value === 'object') return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([k,v])=>[k,await rewrite(v)])));
        return value;
      };
      async function pack(file) {
        if(names.has(file)) return names.get(file);
        if(active.has(file)) throw Error(`Circular asset list: ${file}`);
        active.add(file);
        let bytes=files.get(file);
        if(extname(file)==='.json') bytes=Buffer.from(JSON.stringify(await rewrite(JSON.parse(bytes))));
        const hash=createHash('sha256').update(bytes).digest('hex').slice(0,12);
        const ext=extname(file), name=`fingerprinted/${file.slice(0,-ext.length)}.${hash}${ext}`;
        await mkdir(dirname(resolve(base,name)),{recursive:true});
        await writeFile(resolve(base,name),bytes);
        names.set(file,name); active.delete(file);
        return name;
      }
      for(const file of files.keys()) await pack(file);
      // One stable discovery URL; every URL it hands out is immutable, including the voice/sound lists.
      await writeFile(resolve(base,'manifest.json'),await readFile(resolve(base,names.get('manifest.json'))));
      for(const file of files.keys()) if(file!=='manifest.json') await rm(resolve(base,file));
      await writeFile(resolve(out,'_headers'),`/*\n  Cache-Control: no-cache\n\n/assets/fingerprinted/*\n  ! Cache-Control\n  Cache-Control: public, max-age=31536000, immutable\n`);
      // A deploy changes the worker version; activate immediately and keep the shared content cache.
      const version=createHash('sha256').update(await readFile(resolve(out,'index.html'))).update([...names.values()].sort().join('\n')).digest('hex').slice(0,12);
      const worker=await readFile(resolve(config.root,'tools/asset-worker.js'),'utf8');
      await writeFile(resolve(out,'asset-worker.js'),worker.replace('__BUILD_VERSION__',version));
    },
  };
}
