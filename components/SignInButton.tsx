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
