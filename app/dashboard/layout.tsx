import Sidebar from '@/components/Sidebar';
import { UserProfileProvider } from '@/contexts/UserProfileContext';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UserProfileProvider>
      <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
        <Sidebar />
        <div className="flex-1 ml-64">
          {children}
        </div>
      </div>
    </UserProfileProvider>
  );
}
