import { auth } from '@/lib/auth';
import type { NextRequest } from 'next/server';

// auth() from Auth.js v5 is a valid proxy/middleware handler but its overloaded
// TypeScript signature doesn't match NextRequest→Response exactly.
// The double-cast via unknown is the safe way to handle this mismatch.
const authProxy = auth as unknown as (req: NextRequest) => Response | Promise<Response>;

export default function proxy(req: NextRequest) {
  return authProxy(req);
}

export const config = {
  // Run on all routes except Next.js internals, static files,
  // and the Auth.js route handler itself (which must be publicly reachable).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth).*)'],
};
