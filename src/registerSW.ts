interface SWContainer {
  register: (url: string) => Promise<unknown>;
}

interface Options {
  prod: boolean;
  nav: { serviceWorker?: SWContainer };
}

// Registers the offline service worker in production only; never throws.
export function registerServiceWorker({ prod, nav }: Options): boolean {
  if (!prod || !nav.serviceWorker) return false;
  try {
    nav.serviceWorker.register("./sw.js").catch(() => {});
    return true;
  } catch {
    return false;
  }
}
