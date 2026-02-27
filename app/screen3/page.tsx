import { RemoteNav } from '@/components/RemoteNav';

export default function Screen3Page() {
  return (
    <main className="relative w-full h-screen flex items-center justify-center overflow-hidden text-white">
      <RemoteNav next="/" prev="/tasks" />
      <p className="text-white/40">Screen 3</p>
    </main>
  );
}
