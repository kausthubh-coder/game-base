// Restore selected generated inputs from their committed attempt records.
import fs from 'node:fs/promises';
await fs.mkdir('assets-src/raw', {recursive:true});
for (const name of ['hero-cut','hero-moves','hero-call','leaftail-fight','pebblepup','pebblepup-fight']) {
  const record=JSON.parse(await fs.readFile(`assets-src/fight-sprites/${name}.json`, 'utf8'));
  await fs.copyFile(record.attempts.find(a=>a.selected).source, record.raw);
}
