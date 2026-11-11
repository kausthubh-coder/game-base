import { chromium } from 'playwright-core';

export async function rendererOf(page) {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) throw new Error('Chrome could not create a WebGL context');
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER);
  });
}

/** All browser tools use the same graphics policy. Explicit software selection wins. */
export async function launchChrome(options = {}) {
  const { software = process.argv.includes('--software') || process.env.CHROME_SOFTWARE === '1', ...rest } = options;
  const args = (rest.args ?? []).filter(arg => !arg.includes('swiftshader'));
  if (software) args.push('--enable-unsafe-swiftshader', '--use-angle=swiftshader');
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true, ...rest, args,
  });
  try {
    const page = await browser.newPage();
    browser.gameRenderer = await rendererOf(page);
    console.log(`Chrome renderer: ${browser.gameRenderer}`);
    await page.close();
    return browser;
  } catch (error) {
    await browser.close();
    throw error;
  }
}
