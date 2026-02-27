import { auth } from '@/lib/auth';
import { SignInButton } from '@/components/SignInButton';
import { MusicClient } from '@/components/clients/MusicClient';

export default async function MusicPage() {
  const session = await auth();

  if (!session || session.error === 'RefreshTokenError') {
    return <SignInButton />;
  }

  return (
    <main className="relative w-full h-full overflow-hidden p-6 text-white">
      <MusicClient />
    </main>
  );
}
