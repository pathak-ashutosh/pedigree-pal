import { originFromHeaders } from "./origin";

const fallback = "https://fallback.example.test";

describe("originFromHeaders", () => {
  it("derives the origin from forwarded headers", () => {
    const headers = new Headers({
      "x-forwarded-proto": "https",
      "x-forwarded-host": "pedigree-pal.vercel.app",
    });
    expect(originFromHeaders(headers, fallback)).toBe("https://pedigree-pal.vercel.app");
  });

  it("uses the host header when no forwarded host is present", () => {
    const headers = new Headers({
      "x-forwarded-proto": "http",
      host: "localhost:3000",
    });
    expect(originFromHeaders(headers, fallback)).toBe("http://localhost:3000");
  });

  it("takes the first value of comma-separated forwarded headers", () => {
    const headers = new Headers({
      "x-forwarded-proto": "https, http",
      "x-forwarded-host": "app.example.test, proxy.internal",
    });
    expect(originFromHeaders(headers, fallback)).toBe("https://app.example.test");
  });

  it("falls back when the forwarded proto is missing", () => {
    const headers = new Headers({ host: "app.example.test" });
    expect(originFromHeaders(headers, fallback)).toBe(fallback);
  });

  it("falls back when no host is present", () => {
    const headers = new Headers({ "x-forwarded-proto": "https" });
    expect(originFromHeaders(headers, fallback)).toBe(fallback);
  });
});
