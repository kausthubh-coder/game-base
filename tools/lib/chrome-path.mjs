import { accessSync, constants } from 'node:fs';

export function chromeExecutable({ override = process.env.CHROME_PATH, platform = process.platform, cached, executable = (path) => { try { accessSync(path, constants.X_OK); return true; } catch { return false; } } } = {}) {
  if (override) {
    if (!executable(override)) throw new Error('CHROME_PATH is not executable');
    return override;
  }
  const candidates = platform === 'darwin' ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
    : platform === 'win32' ? ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe']
      : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  const found = [...candidates, cached].find((path) => path && executable(path));
  if (!found) throw new Error('Chrome or the matching Playwright Chromium is missing; install Chrome or set CHROME_PATH');
  return found;
}
