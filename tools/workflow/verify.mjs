import { spawnSync } from 'node:child_process';

export function executePart(part, root) {
  let log = '', result = 'pass';
  const command = (cmd) => {
    const done = spawnSync(cmd[0], cmd.slice(1), { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    log += `$ ${cmd.join(' ')}\n${done.stdout ?? ''}${done.stderr ?? ''}${done.error ? String(done.error) : ''}\n`;
    return done.status;
  };
  try {
    for (const cmd of part.run) {
      const status = command(cmd);
      if (status === 0) continue;
      result = part.skip !== undefined && status === part.skip ? 'skip' : 'FAIL';
      break;
    }
  } catch (error) {
    result = 'FAIL'; log += String(error) + '\n';
  } finally {
    if (result === 'FAIL') for (const cmd of part.onFailure ?? []) command(cmd);
  }
  return { log, result };
}
