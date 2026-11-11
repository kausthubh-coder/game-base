// This module runs from index.html. No cache registration or audio list download precedes the picture.
export const afterFirstFrame: Promise<void> = typeof document === 'undefined' ? Promise.resolve() : new Promise(resolve => {
  const wait = (): void => {
    if (document.querySelector('#loading')) { requestAnimationFrame(wait); return; }
    requestAnimationFrame(() => resolve());
  };
  requestAnimationFrame(wait);
});

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const params = new URLSearchParams(location.search);
  const disabled = params.has('nosw') || (navigator.webdriver && !params.has('sw'));
  if (disabled) {
    void navigator.serviceWorker.getRegistrations().then(async registrations => {
      for (const r of registrations) if (r.active?.scriptURL.includes('/asset-worker.js')) await r.unregister();
      for (const key of await caches.keys()) if (key.startsWith('game-assets-')) await caches.delete(key);
    });
  } else {
    void afterFirstFrame.then(async () => {
      const registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}asset-worker.js`, {updateViaCache:'none'});
      await registration.update();
      await navigator.serviceWorker.ready;
      const remember = (): void => navigator.serviceWorker.controller?.postMessage({type:'remember', urls:performance.getEntriesByType('resource').map(r=>r.name)});
      if(navigator.serviceWorker.controller) remember();
      else navigator.serviceWorker.addEventListener('controllerchange',remember,{once:true});
    }).catch(error => console.warn('[game] asset cache unavailable:',error));
  }
}
