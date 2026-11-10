// A JSON-RPC client for `codex app-server` over stdio, one JSON message per line. It uses the
// machine's own ChatGPT login, so no OpenAI key. Ported from ~/dev/live-tutor/server/app-server.mjs.
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { createInterface } from 'node:readline';

export interface Notification {
  method: string;
  params: any;
}

export class AppServer extends EventEmitter {
  #proc: ChildProcessWithoutNullStreams;
  #nextId = 1;
  #pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  #ready: Promise<void> | null = null;

  constructor(args: string[] = []) {
    super();
    this.#proc = spawn('codex', ['app-server', ...args], { stdio: ['pipe', 'pipe', 'pipe'] });
    createInterface({ input: this.#proc.stdout }).on('line', (line) => this.#onLine(line));
    this.#proc.stderr.on('data', () => {});
    this.#proc.on('exit', (code) => {
      for (const { reject } of this.#pending.values()) reject(new Error(`codex app-server exited (${code})`));
      this.#pending.clear();
      this.emit('exit', code);
    });
  }

  /** Starts the session once. Safe to call again. */
  initialize(): Promise<void> {
    this.#ready ??= this.request('initialize', {
      clientInfo: { name: 'greenhollow-voice', title: 'Greenhollow voice experiment', version: '0.1.0' },
      capabilities: { experimentalApi: true, requestAttestation: false },
    }).then(() => this.#write({ method: 'initialized' }));
    return this.#ready;
  }

  request<T = any>(method: string, params: unknown): Promise<T> {
    const id = this.#nextId++;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      this.#write({ id, method, params });
    });
  }

  respond(id: number, result: unknown): void {
    this.#write({ id, result });
  }

  respondError(id: number, message: string): void {
    this.#write({ id, error: { code: -32601, message } });
  }

  close(): void {
    this.#proc.kill();
  }

  #write(msg: unknown): void {
    if (this.#proc.stdin.writable) this.#proc.stdin.write(JSON.stringify(msg) + '\n');
  }

  #onLine(line: string): void {
    let msg: any;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }
    if (msg.id != null && msg.method) return void this.emit('serverRequest', msg);
    if (msg.id != null) {
      const p = this.#pending.get(msg.id);
      if (!p) return;
      this.#pending.delete(msg.id);
      return msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
    }
    if (msg.method) this.emit('notification', msg as Notification);
  }
}
