"use client";

import jsQR from "jsqr";
import { useEffect, useRef, useState } from "react";

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };
declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => Detector;
  }
}

/**
 * Camera QR scanner (BarcodeDetector, jsQR fallback) with a paste-code fallback that always works.
 * `accept` returns an error message for text that isn't the expected kind of code, or null if it's fine.
 */
export function Scanner({
  title,
  pasteHint,
  accept,
  onResult,
}: {
  title: string;
  pasteHint: string;
  accept: (text: string) => string | null;
  onResult: (text: string) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const callbacks = useRef({ accept, onResult });
  const [scanning, setScanning] = useState(false);
  const [denied, setDenied] = useState(false);
  const [paste, setPaste] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    callbacks.current = { accept, onResult };
  });

  useEffect(() => {
    if (!scanning) return;
    let stream: MediaStream | undefined;
    let frame = 0;
    let stopped = false;
    const canvas = document.createElement("canvas");
    const detector = window.BarcodeDetector ? new window.BarcodeDetector({ formats: ["qr_code"] }) : null;

    const found = (text: string) => {
      const problem = callbacks.current.accept(text);
      if (problem) {
        setError(problem);
        return false;
      }
      stopped = true;
      setScanning(false);
      callbacks.current.onResult(text.trim());
      return true;
    };

    const tick = async () => {
      const v = video.current;
      if (stopped || !v) return;
      if (v.readyState >= 2 && v.videoWidth > 0) {
        if (detector) {
          const codes = await detector.detect(v).catch(() => []);
          if (codes[0] && found(codes[0].rawValue)) return;
        } else {
          canvas.width = v.videoWidth;
          canvas.height = v.videoHeight;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(v, 0, 0);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(img.data, img.width, img.height);
            if (code && found(code.data)) return;
          }
        }
      }
      frame = requestAnimationFrame(tick);
    };

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((s) => {
        stream = s;
        if (stopped) return s.getTracks().forEach((t) => t.stop());
        if (video.current) {
          video.current.srcObject = s;
          void video.current.play();
        }
        frame = requestAnimationFrame(tick);
      })
      .catch(() => {
        setDenied(true);
        setScanning(false);
      });

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [scanning]);

  const submitPaste = () => {
    const problem = accept(paste);
    if (problem) return setError(problem);
    setError(null);
    onResult(paste.trim());
    setPaste("");
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">{title}</span>
        <button
          type="button"
          className="btn btn-quiet"
          onClick={() => {
            setError(null);
            const supported = !!navigator.mediaDevices?.getUserMedia;
            setDenied(!supported);
            setScanning((s) => supported && !s);
          }}
        >
          {scanning ? "Stop camera" : "Scan with camera"}
        </button>
      </div>
      {scanning && (
        <video ref={video} muted playsInline className="aspect-square w-full max-w-sm rounded-md bg-sunk object-cover" aria-label="Camera preview" />
      )}
      {denied && <p className="text-sm text-warn">The camera isn&apos;t available here. Paste the code instead.</p>}
      <label className="flex flex-col gap-1">
        <span className="text-sm text-muted">{pasteHint}</span>
        <span className="flex gap-2">
          <input
            className="field mono text-sm"
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && paste.trim() && submitPaste()}
            spellCheck={false}
            autoComplete="off"
            placeholder="Paste code"
          />
          <button type="button" className="btn btn-quiet shrink-0" disabled={!paste.trim()} onClick={submitPaste}>
            Use
          </button>
        </span>
      </label>
      {error && <p className="text-sm text-err">{error}</p>}
    </div>
  );
}
