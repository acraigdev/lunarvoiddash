'use client';

import { useSession, signIn } from 'next-auth/react';

export function AuthAlert() {
  const { data: session } = useSession();

  if (session?.error !== 'RefreshTokenError') return null;

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2 rounded-xl bg-red-900/80 backdrop-blur-sm text-white text-sm shadow-lg">
      <span className="opacity-90">Session expired</span>
      <button
        onClick={() => signIn('google')}
        className="px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 transition-colors font-medium"
      >
        Sign in again
      </button>
    </div>
  );
}
