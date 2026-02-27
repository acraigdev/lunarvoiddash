'use client';

import { signIn, signOut } from 'next-auth/react';

export function SignInButton() {
  return (
    <button
      className="bg-fuchsia-950 text-white font-semibold cursor-pointer py-2 px-4 rounded-3xl m-4"
      onClick={() => signIn('google')}
    >
      Sign in with Google
    </button>
  );
}

export function SignOutButton() {
  return <button onClick={() => signOut()}>Sign out</button>;
}

export function DebugScopes() {
  return (
    <button
      className="text-xs opacity-50 underline m-2"
      onClick={async () => {
        const res = await fetch('/api/auth/session');
        const session = await res.json();
        const tokenRes = await fetch(
          `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${session.accessToken}`,
        );
        const info = await tokenRes.json();
        alert('Scopes granted:\n\n' + (info.scope ?? info.error_description ?? JSON.stringify(info)));
      }}
    >
      Debug: check scopes
    </button>
  );
}
