import { defineConfig, type Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';

const runtime = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';
const policy = (dev = false) => [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data:",
  "frame-src 'self'",
  "worker-src 'none'",
  "connect-src 'self' " + runtime + (dev ? ' ws: wss:' : ''),
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

function securityHeaders(): Plugin {
  function headers(dev: boolean) {
    return (request: IncomingMessage, response: ServerResponse, next: () => void) => {
      const pathname = (request.url ?? '/').split('?')[0];
      response.setHeader('X-Content-Type-Options', 'nosniff');
      response.setHeader('Referrer-Policy', 'no-referrer');
      response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
      if (pathname.endsWith('/python-runner.html')) {
        response.setHeader('Content-Security-Policy', "frame-ancestors 'self'");
        response.setHeader('X-Frame-Options', 'SAMEORIGIN');
      } else if (pathname.endsWith('/') || pathname.endsWith('.html') || request.headers.accept?.includes('text/html')) {
        response.setHeader('Content-Security-Policy', policy(dev) + "; frame-ancestors 'none'");
        response.setHeader('X-Frame-Options', 'DENY');
      }
      next();
    };
  }

  return {
    name: 'dryrun-security-headers',
    configureServer(server) { server.middlewares.use(headers(true)); },
    configurePreviewServer(server) { server.middlewares.use(headers(false)); },
    transformIndexHtml(_html, context) {
      return context.server ? [] : [{
        tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: policy() }, injectTo: 'head-prepend',
      }, {
        tag: 'meta', attrs: { name: 'referrer', content: 'no-referrer' }, injectTo: 'head',
      }];
    },
  };
}

export default defineConfig({ base: './', plugins: [securityHeaders()] });
