import { CSP, cspPlugin, injectCsp } from "./csp";

test("policy allows only self and Google Fonts (Devanagari), never inline or eval", () => {
  expect(CSP).not.toMatch(/unsafe-inline|unsafe-eval|\*/);
  expect(CSP).toContain("script-src 'self'");
  expect(CSP).toContain("https://fonts.googleapis.com");
  expect(CSP).toContain("font-src 'self' https://fonts.gstatic.com");
  expect(CSP).toContain("object-src 'none'");
});

test("injects the meta tag as the first element of head, at build time only", () => {
  const out = injectCsp("<html><head><title>x</title></head></html>");
  expect(out).toMatch(/<head>\s*<meta http-equiv="Content-Security-Policy" content="[^"]+" \/>\s*<title>/);
  expect(cspPlugin().apply).toBe("build");
});
