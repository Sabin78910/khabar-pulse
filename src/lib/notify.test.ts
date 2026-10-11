import { showBreaking } from "./notify.ts";
import { t } from "./i18n.ts";
import type { Cluster } from "../pipeline/types.ts";

const c = { id: "a", title: "Headline", url: "https://p.example/a", items: [{ sourceId: "x" }, { sourceId: "y" }] } as unknown as Cluster;

describe("showBreaking", () => {
  it("shows one notification per story carrying the publisher link", async () => {
    const showNotification = vi.fn().mockResolvedValue(undefined);
    await showBreaking({ showNotification }, [c], t("en"));
    expect(showNotification).toHaveBeenCalledWith("Breaking: 2 outlets reporting", expect.objectContaining({ body: "Headline", tag: "a", data: { url: "https://p.example/a" } }));
  });
  it("skips non-http links", async () => {
    const showNotification = vi.fn();
    await showBreaking({ showNotification }, [{ ...c, url: "javascript:1" }], t("en"));
    expect(showNotification).not.toHaveBeenCalled();
  });
});
