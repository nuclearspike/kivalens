/**
 * securityHeaders.mjs — the headers every KivaLens response carries, on the
 * Node server (prod.mjs) and the Cloudflare Worker alike, so the two hosts
 * cannot drift apart.
 */

// Security headers — the same A+ posture the original cluster.js shipped,
// retuned for this app:
//   - script-src 'self' only (the build emits no inline scripts and the app
//     uses no GA/analytics — stricter than the old config)
//   - style-src allows 'unsafe-inline' (index.html's inline <style> + React/
//     recharts inline style attributes) and Google Fonts CSS
//   - img-src covers Kiva's image CDN + data: (CSS SVG backgrounds, favicons)
//   - connect-src covers the same-origin /api & /proxy plus the client's
//     direct Kiva-API and Google-Docs fallbacks, the shared Feedback /
//     My Reports service (src/support/runtime.ts), and the real-user
//     measurement collector (src/lib/rum, cloudflare/rum)
//   - form-action allows the basket checkout POST to Kiva (the POST and its
//     redirects can land on www/apex/other kiva.org subdomains, so allow the
//     whole kiva.org family or the browser blocks the submission)

export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https://www.kiva.org https://*.kivaws.org",
  "connect-src 'self' https://api.kivaws.org https://www.kiva.org https://docs.google.com https://rum.kivalens.org",
  "form-action 'self' https://www.kiva.org https://kiva.org https://*.kiva.org",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "worker-src 'self'",
].join('; ')

export const SECURITY_HEADERS = {
  'Content-Security-Policy': CSP,
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=(), usb=()',
}
