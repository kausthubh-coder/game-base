// A sheet of pictures in a grid with their names, to look at many at once: rows and columns of files in one
// folder. `bun tools/biome-sheet.mjs <folder> <out.jpg> --rows a,b,c --cols x,y --name "{row}-{col}.jpg" [--width 420]`
// `{row}` and `{col}` in the name are replaced by each row and column. A missing picture is left blank.
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchChrome } from './lib/chrome.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const folder = resolve(args[0]), out = resolve(args[1]);
const rows = opt('rows', '').split(','), cols = opt('cols', '').split(','), name = opt('name', '{row}-{col}.jpg'), width = Number(opt('width', '420'));
const height = Math.round((width * 9) / 16);
const cell = (row, col) => {
  const file = resolve(folder, name.replace('{row}', row).replace('{col}', col));
  return `<td>${existsSync(file) ? `<img src="file://${file}" width=${width} height=${height}>` : `<div style="width:${width}px;height:${height}px"></div>`}</td>`;
};
const html = `<body style="margin:0;background:#222;color:#eee;font:13px sans-serif"><table cellspacing=3>
<tr><td></td>${cols.map((c) => `<td>${c}</td>`).join('')}</tr>
${rows.map((r) => `<tr><td style="writing-mode:vertical-rl">${r}</td>${cols.map((c) => cell(r, c)).join('')}</tr>`).join('\n')}</table></body>`;
const browser = await launchChrome({ headless: true, args: ['--allow-file-access-from-files'] });
try {
  const page = await (await browser.newContext({ viewport: { width: 40 + cols.length * (width + 3), height: 30 + rows.length * (height + 3) } })).newPage();
  // A page of its own beside the pictures: a page from nowhere may not show files.
  const sheet = resolve(folder, '.sheet.html');
  writeFileSync(sheet, html);
  await page.goto(`file://${sheet}`);
  rmSync(sheet);
  await page.waitForTimeout(500);
  await page.screenshot({ path: out, type: 'jpeg', quality: 82, fullPage: true });
} finally {
  await browser.close();
}
console.log(out);
