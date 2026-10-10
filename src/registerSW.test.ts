import { registerServiceWorker } from "./registerSW";
import manifestRaw from "../public/manifest.webmanifest?raw";
import swRaw from "../public/sw.js?raw";
import indexHtml from "../index.html?raw";

test("does nothing outside production", () => {
  const register = vi.fn();
  expect(registerServiceWorker({ prod: false, nav: { serviceWorker: { register } } })).toBe(false);
  expect(register).not.toHaveBeenCalled();
});
test("does nothing when service workers are unsupported", () => {
  expect(registerServiceWorker({ prod: true, nav: {} })).toBe(false);
});
test("registers a relative sw.js in production", () => {
  const register = vi.fn().mockResolvedValue({});
  expect(registerServiceWorker({ prod: true, nav: { serviceWorker: { register } } })).toBe(true);
  expect(register).toHaveBeenCalledWith("./sw.js");
});
test("fails silently when registration rejects or throws", async () => {
  const rejecting = vi.fn().mockRejectedValue(new Error("nope"));
  expect(() => registerServiceWorker({ prod: true, nav: { serviceWorker: { register: rejecting } } })).not.toThrow();
  await Promise.resolve();
  const throwing = vi.fn(() => { throw new Error("sync"); });
  expect(registerServiceWorker({ prod: true, nav: { serviceWorker: { register: throwing } } })).toBe(false);
});

const manifest = JSON.parse(manifestRaw);
test("manifest has required installable fields", () => {
  expect(manifest.name).toBeTruthy();
  expect(manifest.short_name).toBeTruthy();
  expect(manifest.display).toBe("standalone");
  expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
  expect(manifest.icons.length).toBeGreaterThan(0);
});
test("manifest paths are relative so they work under a Pages base path", () => {
  for (const p of [manifest.start_url, manifest.scope, ...manifest.icons.map((i: { src: string }) => i.src)]) {
    expect(p.startsWith("/")).toBe(false);
    expect(p).not.toMatch(/^https?:/);
  }
});
test("index.html links the manifest relatively; sw.js has versioned cache and cleanup", () => {
  expect(indexHtml).toContain('rel="manifest" href="./manifest.webmanifest"');
  const sw = swRaw;
  expect(sw).toMatch(/CACHE\s*=\s*"loan-calc-v\d+"/);
  expect(sw).toContain("caches.delete");
  expect(sw).toContain("skipWaiting");
});
