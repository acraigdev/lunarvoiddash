import { auth } from '@/lib/auth';
import { SignInButton, SignOutButton } from '@/components/SignInButton';
import { HomeClient } from '@/components/clients/HomeClient';

export default async function HomePage() {
  const session = await auth();

  if (!session || session.error === 'RefreshTokenError') {
    return <SignInButton />;
  }

  return (
    <main className="relative w-full h-full overflow-hidden p-6">
      <HomeClient />
      <SignOutButton />
    </main>
  );
}
