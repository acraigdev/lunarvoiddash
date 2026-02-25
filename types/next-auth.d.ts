// Augments next-auth's built-in types with our custom session fields.
// The imports below cause TypeScript to load both modules so the augmentations resolve.
import type { DefaultSession } from 'next-auth';
import type { DefaultJWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface Session extends DefaultSession {
    accessToken: string;
    error?: 'RefreshTokenError';
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    accessToken: string;
    refreshToken: string;
    accessTokenExpires: number; // unix ms
    error?: 'RefreshTokenError';
  }
}
