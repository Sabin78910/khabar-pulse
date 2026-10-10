import { registerServiceWorker } from "./registerSW.ts";

describe("registerServiceWorker", () => {
  it("does nothing outside production", () => {
    const register = vi.fn();
    expect(registerServiceWorker(false, { register })).toBe(false);
    expect(register).not.toHaveBeenCalled();
  });

  it("does nothing when service workers are unsupported", () => {
    expect(registerServiceWorker(true, undefined)).toBe(false);
  });

  it("registers the relative sw.js in production", async () => {
    const register = vi.fn().mockResolvedValue({});
    expect(registerServiceWorker(true, { register })).toBe(true);
    expect(register).toHaveBeenCalledWith("./sw.js");
  });

  it("swallows registration failures", async () => {
    const register = vi.fn().mockRejectedValue(new Error("nope"));
    expect(registerServiceWorker(true, { register })).toBe(true);
    await Promise.resolve();
  });
});
