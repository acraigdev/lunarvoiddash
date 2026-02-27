import { TasksClient } from '@/components/clients/TasksClient';

export default function TasksPage() {
  return (
    <main className="relative w-full h-screen overflow-hidden">
      <TasksClient />
    </main>
  );
}
