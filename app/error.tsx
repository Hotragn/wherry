"use client";

import Link from "next/link";
import { Doggett } from "./components/doggett";

/** Shown if a page crashes. Tabs, keys and queued vouchers live in this browser, so nothing is lost by retrying. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-text flex-col justify-center gap-5 px-4 py-16">
      <Doggett pose="error" size={88} />
      <h1 className="text-4xl">Something went wrong on this page</h1>
      <p className="text-muted">Your phone key, shop key and queued vouchers are stored in this browser and are safe. Try again.</p>
      <div className="flex flex-wrap gap-4">
        <button type="button" className="btn btn-sail" onClick={reset}>
          Try again
        </button>
        <Link href="/app" className="btn btn-quiet">
          Back to the app
        </Link>
      </div>
    </main>
  );
}
