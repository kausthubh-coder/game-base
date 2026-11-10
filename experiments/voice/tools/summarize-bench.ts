// Pools the runs in .artifacts/voice/bench/*.json by setup and prints the latency table for the README.
//   bun experiments/voice/tools/summarize-bench.ts
import { readdirSync, readFileSync } from 'node:fs';

const DIR = new URL('../../../.artifacts/voice/bench/', import.meta.url).pathname;
interface Run {
  pipe: string;
  mode: string;
  model: string;
  tts: string | null;
  median: number;
  worst: number;
  failures: string[];
  raw: any[];
}
const runs: Run[] = readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(DIR + f, 'utf8')));

const groups = new Map<string, Run[]>();
for (const r of runs) {
  const key = `${r.pipe} ${r.mode}, ${r.model}${r.tts ? ` + ${r.tts}` : ''}`;
  groups.set(key, [...(groups.get(key) ?? []), r]);
}
const median = (xs: number[]) => {
  const s = xs.filter(Number.isFinite).sort((a, b) => a - b);
  if (!s.length) return NaN;
  return Math.round(s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2);
};
const fmt = (n: number) => (Number.isFinite(n) ? `${n}` : '-');

console.log('| Setup | Runs | Turns | Median ms | Run medians | Best | Worst | Hearing | Model 1st token | 1st sentence | Voice 1st byte after sentence | Failures |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const [key, rs] of [...groups].sort()) {
  const turns = rs.flatMap((r) => r.raw);
  const totals = turns.map((t) => (t.firstSound !== undefined && t.mark !== null && Number.isFinite(t.mark) ? t.firstSound - t.mark : NaN));
  const ok = totals.filter(Number.isFinite);
  const b2 = key.startsWith('b2');
  console.log(
    `| ${key} | ${rs.length} | ${ok.length} of ${turns.length} | **${fmt(median(ok))}** | ${rs.map((r) => r.median).join(', ')} | ${fmt(Math.round(Math.min(...ok)))} | ${fmt(Math.round(Math.max(...ok)))} | ` +
      `${b2 ? fmt(median(turns.map((t) => t.sttMs ?? NaN))) : '-'} | ${b2 ? fmt(median(turns.map((t) => t.server?.firstToken ?? NaN))) : '-'} | ${b2 ? fmt(median(turns.map((t) => t.server?.firstSentence ?? NaN))) : '-'} | ` +
      `${b2 ? fmt(median(turns.map((t) => (t.server?.firstAudioByte ?? NaN) - (t.server?.firstSentence ?? NaN)))) : '-'} | ${rs.reduce((n, r) => n + r.failures.length, 0)} |`,
  );
}
