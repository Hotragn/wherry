import Link from "next/link";
import { Doggett } from "./components/doggett";

export const metadata = { title: "Not on the chart" };

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[52rem] flex-col justify-center gap-5 px-4 py-16">
      <Doggett pose="error" size={88} />
      <h1 className="text-5xl md:text-7xl">This page isn&apos;t on the chart</h1>
      <p className="text-lg">The link may be old, or mistyped. The crossing starts from the app.</p>
      <div className="flex flex-wrap gap-4">
        <Link href="/app" className="btn btn-sail">
          Open the app
        </Link>
        <Link href="/" className="btn btn-quiet">
          Home
        </Link>
      </div>
    </main>
  );
}
