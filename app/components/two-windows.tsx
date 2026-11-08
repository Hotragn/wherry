"use client";

/** One click for judges on a laptop: opens the Phone and the Shop as two windows side by side. */
export function TwoWindows({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      className={`btn btn-quiet ${className}`}
      onClick={() => {
        const h = Math.min(window.screen.availHeight, 960);
        window.open("/app/phone", "wherry-phone", `popup,width=420,height=${h},left=0,top=0`);
        window.open("/app/shop", "wherry-shop", `popup,width=${Math.max(900, window.screen.availWidth - 440)},height=${h},left=440,top=0`);
      }}
    >
      Open Phone + Shop side by side
    </button>
  );
}
