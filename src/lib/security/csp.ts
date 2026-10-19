// Nonce-based Content Security Policy, following the Next.js CSP guide.
// Every page is rendered per request so Next.js can attach the nonce.

type CspOptions = {
  nonce: string;
  isDev: boolean;
  upgradeInsecureRequests: boolean;
};

export function buildCsp({ nonce, isDev, upgradeInsecureRequests }: CspOptions): string {
  const directives = [
    "default-src 'self'",
    // React needs eval only in development for debugging information.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' ${isDev ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (upgradeInsecureRequests) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

export function createNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}
