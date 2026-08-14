import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

// jsdom implements no pointer capture, so Groove's knobs and faders throw on pointerdown without
// this. Capture only decides which element receives the rest of a drag, and these tests dispatch
// straight at the target, so a no-op loses nothing.
Element.prototype.setPointerCapture = vi.fn();

beforeEach(() => {
  // The editor flushes pending block edits with a raw keepalive fetch when it unmounts. Node's
  // fetch rejects relative URLs, so keep every test off the real one; suites that assert on
  // requests stub it again themselves.
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    }),
  );
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});
