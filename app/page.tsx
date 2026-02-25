import { auth } from '@/lib/auth';
import { getImageOTD } from '@/lib/nasa';
import { Wallpaper } from '@/components/Wallpaper';
import { SignInButton, SignOutButton } from '@/components/SignInButton';
import { HomeClient } from '@/components/HomeClient';

export default async function HomePage() {
  const [session, apod] = await Promise.all([auth(), getImageOTD()]);

  if (!session || session.error === 'RefreshTokenError') {
    return (
      <main>
        Hello World
        {/* <SignInButton /> */}
      </main>
    );
  }

  return (
    <main className="relative w-full h-screen">
      Hello World auth
      {/* <Wallpaper apod={apod} />
      <HomeClient />
      <div className="absolute top-4 right-4">
        <SignOutButton />
      </div> */}
    </main>
  );
}
