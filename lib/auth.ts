import NextAuth from 'next-auth';
import type { NextAuthConfig } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import Google from 'next-auth/providers/google';
// Type augmentation lives in types/next-auth.d.ts

// ── Token refresh ─────────────────────────────────────────────────────────
// Called server-side when the access token is expired. Uses the refresh token
// (never exposed to the browser) to get a new access token from Google.

async function refreshAccessToken(token: JWT): Promise<JWT> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
      refresh_token: token.refreshToken,
    }),
  });

  const data = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
    error?: string;
  };

  if (!response.ok || data.error) {
    // Signal the session callback; the UI should detect this and prompt re-auth.
    return { ...token, error: 'RefreshTokenError' as const };
  }

  return {
    ...token,
    accessToken: data.access_token!,
    // Google only rotates the refresh token occasionally; keep old one if absent.
    refreshToken: data.refresh_token ?? token.refreshToken,
    accessTokenExpires: Date.now() + (data.expires_in ?? 3600) * 1000,
    error: undefined,
  };
}

// ── Auth.js config ────────────────────────────────────────────────────────

export const authConfig: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          // Authorization Code flow — gives us a refresh token server-side.
          // access_type: 'offline' requests a refresh token.
          // prompt: 'consent' ensures Google issues a refresh token even when
          // the user has previously authorized the app.
          access_type: 'offline',
          prompt: 'consent',
          scope: [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/calendar.readonly',
            'https://www.googleapis.com/auth/tasks', // full read+write
            'https://www.googleapis.com/auth/contacts.readonly',
            'https://www.googleapis.com/auth/contacts.other.readonly',
          ].join(' '),
        },
      },
    }),
  ],

  callbacks: {
    // jwt runs on every session access. On first sign-in, `account` holds the
    // raw Google tokens. On subsequent calls we check expiry and refresh if needed.
    async jwt({ token, account }) {
      if (account) {
        return {
          ...token,
          accessToken: account.access_token!,
          refreshToken: account.refresh_token!,
          accessTokenExpires: account.expires_at
            ? account.expires_at * 1000 // Google sends seconds; convert to ms
            : Date.now() + 3600 * 1000,
        };
      }

      // Token still valid (with 60s buffer) — return as-is
      if (Date.now() < token.accessTokenExpires - 60_000) {
        return token;
      }

      // Token expired — refresh it server-side
      return refreshAccessToken(token);
    },

    // session exposes only what the client needs. The refresh token stays
    // server-side in the encrypted JWT cookie and is never sent to the browser.
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.error = token.error;
      return session;
    },
  },

  // JWT strategy: sessions stored in an encrypted HttpOnly cookie.
  // No database required.
  session: { strategy: 'jwt' },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
