import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

// jsdom implements no pointer capture, so components that drag throw on pointerdown without
// this. Capture only decides which element receives the rest of a drag, and these tests dispatch
// straight at the target, so a no-op loses nothing.
Element.prototype.setPointerCapture = vi.fn();

// jsdom's Blob has no text(), which is how Rolodex reads a file the moment you choose one. The
// FileReader it does implement would only be a longer way of doing the same thing.
// The cast is what makes the check legal: the DOM types say the method is always there.
if (!(Blob.prototype.text as unknown))
  Blob.prototype.text = function (this: Blob) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result as string);
      };
      reader.onerror = () => {
        reject(reader.error ?? new Error("could not read the file"));
      };
      reader.readAsText(this);
    });
  };

// Node 26 ships an experimental localStorage global that stays undefined without
// --localstorage-file, and vitest will not overwrite a global Node already defined, so
// the bare name sees nothing and every suite fails on it. The live JSDOM instance is
// still reachable through the jsdom global vitest exposes; point the name back at the
// window's own storage. On Node 24 (CI) the global is jsdom's already and this skips.
const nodeStorage = (globalThis as unknown as { localStorage?: Storage })
  .localStorage;
if (!nodeStorage) {
  const dom = (globalThis as unknown as { jsdom: { window: Window } }).jsdom;
  Object.defineProperty(globalThis, "localStorage", {
    get: () => dom.window.localStorage,
  });
}

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
