import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');

  if (!url) {
    return new Response('Missing url parameter', { status: 400 });
  }

  try {
    new URL(url);
  } catch {
    return new Response('Invalid URL', { status: 400 });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      return new Response(`Upstream returned ${response.status}`, {
        status: 502,
      });
    }

    const contentType = response.headers.get('content-type') ?? 'text/html';
    const body = await response.arrayBuffer();

    // Inject a <base> tag so relative URLs (images, CSS, JS) resolve
    // against the original site, not our proxy
    if (contentType.includes('text/html')) {
      const html = new TextDecoder().decode(body);
      const origin = new URL(url).origin;
      const baseTag = `<base href="${origin}/">`;
      const patched = html.replace(
        /(<head[^>]*>)/i,
        `$1${baseTag}`,
      );

      return new Response(patched, {
        headers: {
          'Content-Type': contentType,
          // No X-Frame-Options or CSP frame-ancestors — that's the point
        },
      });
    }

    // Non-HTML (CSS, images, etc.) — pass through as-is
    return new Response(body, {
      headers: { 'Content-Type': contentType },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(message, { status: 502 });
  }
}
