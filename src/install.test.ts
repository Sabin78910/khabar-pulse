import { act, renderHook } from "@testing-library/react";
import { useInstallPrompt } from "./install.ts";

const firePrompt = () => {
  const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome: "accepted" }),
  });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
};

describe("useInstallPrompt", () => {
  it("is unavailable until the browser offers installation", () => {
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.canInstall).toBe(false);
  });

  it("captures the prompt, shows it on demand, then hides", async () => {
    const { result } = renderHook(() => useInstallPrompt());
    const event = firePrompt();
    expect(event.defaultPrevented).toBe(true);
    expect(result.current.canInstall).toBe(true);
    await act(() => result.current.install());
    expect(event.prompt).toHaveBeenCalledOnce();
    expect(result.current.canInstall).toBe(false);
  });

  it("hides once the app is installed", () => {
    const { result } = renderHook(() => useInstallPrompt());
    firePrompt();
    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });
    expect(result.current.canInstall).toBe(false);
  });
});
