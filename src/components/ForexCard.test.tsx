import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import fixture from "../pipeline/__fixtures__/nrb-rates.json";
import { parseForex } from "../lib/forex.ts";
import { t } from "../lib/i18n.ts";
import { ForexCard } from "./ForexCard.tsx";

const day = parseForex(fixture)!;

describe("ForexCard", () => {
  it("shows featured currencies first and reveals the rest on Show all", async () => {
    render(<ForexCard day={day} lang="en" s={t("en")} stale={false} />);
    expect(screen.getByRole("rowheader", { name: /QAR/ })).toBeInTheDocument();
    expect(screen.queryByRole("rowheader", { name: /EUR/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Show all" }));
    expect(screen.getByRole("rowheader", { name: /EUR/ })).toBeInTheDocument();
    expect(screen.getByText("Source: Nepal Rastra Bank · published 2026-10-12. Bank rates may differ.")).toBeInTheDocument();
  });

  it("converts to NPR at the buy rate, honouring the unit", async () => {
    render(<ForexCard day={day} lang="en" s={t("en")} stale={false} />);
    await userEvent.clear(screen.getByLabelText("Amount"));
    await userEvent.type(screen.getByLabelText("Amount"), "10");
    expect(screen.getByRole("status")).toHaveTextContent("1,544.80");
    await userEvent.selectOptions(screen.getByLabelText("Currency"), "INR");
    await userEvent.clear(screen.getByLabelText("Amount"));
    await userEvent.type(screen.getByLabelText("Amount"), "100");
    expect(screen.getByRole("status")).toHaveTextContent("160.00");
  });

  it("warns when showing an earlier day and uses Nepali digits", () => {
    render(<ForexCard day={day} lang="ne" s={t("ne")} stale />);
    expect(screen.getByText(t("ne").forexStale)).toBeInTheDocument();
    expect(screen.getByText(/२०२६-१०-१२/)).toBeInTheDocument();
    expect(screen.getAllByText("१५४.४८").length).toBeGreaterThan(0);
  });
});
