import { AppHeader } from "../components/app-header";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <AppHeader />
      <main className="mx-auto max-w-page px-4 pb-16 pt-8">{children}</main>
    </div>
  );
}
