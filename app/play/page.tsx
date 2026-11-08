import { AppHeader } from "../components/app-header";

export const metadata = { title: "Play" };

export default function PlayPage() {
  return (
    <div className="min-h-dvh">
      <AppHeader />
      <main className="mx-auto flex max-w-page flex-col gap-3 px-4 pb-16 pt-8">
        <h1 className="text-4xl">Play</h1>
        <p className="max-w-text text-muted">The offline power-up game arrives in the next build.</p>
      </main>
    </div>
  );
}
