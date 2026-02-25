import { auth } from '@/lib/auth';
import { SignInButton } from '@/components/SignInButton';
import { HomeClient } from '@/components/HomeClient';

export default async function HomePage() {
  const session = await auth();

  if (!session || session.error === 'RefreshTokenError') {
    return <SignInButton />;
  }

  return (
    <main className="relative w-full h-screen overflow-hidden p-6">
      <HomeClient />
    </main>
  );
}
