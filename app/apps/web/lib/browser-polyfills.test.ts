import { afterEach, describe, expect, it, vi } from "vitest";

const nativeCanParse = Object.getOwnPropertyDescriptor(URL, "canParse")!;

afterEach(() => {
  Object.defineProperty(URL, "canParse", nativeCanParse);
  vi.resetModules();
});

async function installPolyfill() {
  Object.defineProperty(URL, "canParse", { configurable: true, writable: true, value: undefined });
  await import("./browser-polyfills");
}

describe("browser polyfills", () => {
  it("preserves native URL.canParse", async () => {
    const native = URL.canParse;
    await import("./browser-polyfills");
    expect(URL.canParse).toBe(native);
  });

  it("accepts absolute URLs and resolves relative URLs against a base", async () => {
    await installPolyfill();
    expect(URL.canParse("https://example.com/catalog")).toBe(true);
    expect(URL.canParse("/catalog", "https://example.com")).toBe(true);
    expect(URL.canParse(new URL("https://example.com"))).toBe(true);
    expect(URL.canParse("/catalog")).toBe(false);
    expect(URL.canParse("https://example.com", "invalid base")).toBe(false);
    expect(URL.canParse("https://")).toBe(false);
  });

  it("preserves argument conversion errors", async () => {
    await installPolyfill();
    const input = {
      toString() {
        throw new Error("conversion failed");
      },
    };
    expect(() => URL.canParse(input as unknown as string)).toThrow("conversion failed");
    expect(() => URL.canParse(Symbol() as unknown as string)).toThrow(TypeError);
    expect(() => Reflect.apply(URL.canParse, URL, [])).toThrow(TypeError);
  });
});
