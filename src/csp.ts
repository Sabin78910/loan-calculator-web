/** Content-Security-Policy for the built site: same-origin code only, plus Google Fonts. */
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "base-uri 'self'",
  "form-action 'none'",
  "object-src 'none'",
].join("; ");

export function injectCsp(html: string): string {
  return html.replace(/<head>/i, `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`);
}

/** Build-only: the dev server needs an inline React Refresh script that this policy would block. */
export function cspPlugin() {
  return { name: "csp-meta", apply: "build" as const, transformIndexHtml: injectCsp };
}
