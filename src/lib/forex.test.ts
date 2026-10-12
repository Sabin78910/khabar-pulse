import fixture from "../pipeline/__fixtures__/nrb-rates.json";
import { FEATURED, convertToNpr, formatRate, forexUrl, latestDay, parseForex, parseStoredForex } from "./forex.ts";
import { STRINGS } from "./i18n.ts";

describe("NRB forex parsing", () => {
  const day = parseForex(fixture)!;

  it("parses the saved payload", () => {
    expect(day.date).toBe("2026-10-12");
    expect(day.rates).toHaveLength(22);
    const usd = day.rates.find((r) => r.iso3 === "USD")!;
    expect(usd).toMatchObject({ unit: 1, buy: 154.48, sell: 155.08 });
  });

  it("keeps units for INR, JPY and KRW", () => {
    const unit = (c: string) => day.rates.find((r) => r.iso3 === c)?.unit;
    expect([unit("INR"), unit("JPY"), unit("KRW")]).toEqual([100, 10, 100]);
  });

  it("has every featured currency", () => {
    expect(FEATURED).toEqual(["USD", "INR", "QAR", "AED", "SAR", "MYR", "KRW", "AUD"]);
    for (const c of FEATURED) expect(day.rates.some((r) => r.iso3 === c)).toBe(true);
  });

  it("rejects junk and empty payloads", () => {
    expect(parseForex({})).toBeNull();
    expect(parseForex({ data: { payload: [] } })).toBeNull();
    expect(parseForex(null)).toBeNull();
  });

  it("skips malformed rate rows", () => {
    const bad = { data: { payload: [{ date: "2026-10-12", rates: [{ currency: { iso3: "USD", unit: 1 }, buy: "x", sell: "1" }, { currency: { iso3: "EUR", unit: 1 }, buy: "1.5", sell: "2" }] }] } };
    expect(parseForex(bad)!.rates.map((r) => r.iso3)).toEqual(["EUR"]);
  });

  it("falls back to the latest published day", () => {
    const older = { data: { payload: [{ date: "2026-10-09", rates: [{ currency: { iso3: "USD", unit: 1 }, buy: "150", sell: "151" }] }, { date: "2026-10-10", rates: [{ currency: { iso3: "USD", unit: 1 }, buy: "152", sell: "153" }] }] } };
    expect(parseForex(older)!.date).toBe("2026-10-10");
    expect(latestDay(older.data.payload.map((p) => p.date))).toBe("2026-10-10");
  });

  it("builds a window URL ending today (Nepal time)", () => {
    const u = forexUrl(Date.UTC(2026, 9, 12, 20, 0)); // 20:00 UTC is 01:45 next day in Nepal
    expect(u).toContain("https://www.nrb.org.np/api/forex/v1/rates?");
    expect(u).toContain("to=2026-10-13");
    expect(u).toContain("from=2026-10-04");
  });

  it("round-trips the cache and rejects bad cache", () => {
    expect(parseStoredForex(JSON.parse(JSON.stringify(day)))).toEqual(day);
    expect(parseStoredForex({ date: 5 })).toBeNull();
  });
});

describe("NPR converter", () => {
  const rate = (iso3: string, unit: number, buy: number) => ({ iso3, name: iso3, unit, buy, sell: buy });
  it("converts at the buy rate", () => {
    expect(convertToNpr(10, rate("USD", 1, 154.48))).toBeCloseTo(1544.8);
  });
  it("honours unit", () => {
    expect(convertToNpr(100, rate("INR", 100, 160))).toBeCloseTo(160);
    expect(convertToNpr(1, rate("INR", 100, 160))).toBeCloseTo(1.6);
    expect(convertToNpr(10, rate("JPY", 10, 9.76))).toBeCloseTo(9.76);
    expect(convertToNpr(1000, rate("KRW", 100, 11))).toBeCloseTo(110);
  });
  it("returns 0 for invalid amounts", () => {
    expect(convertToNpr(NaN, rate("USD", 1, 150))).toBe(0);
    expect(convertToNpr(-5, rate("USD", 1, 150))).toBe(0);
  });
});

describe("number formatting", () => {
  it("formats in English and Nepali digits", () => {
    expect(formatRate(154.48, "en")).toBe("154.48");
    expect(formatRate(1544.8, "en")).toBe("1,544.80");
    expect(formatRate(154.48, "ne")).toBe("१५४.४८");
  });
  it("has localised footer text", () => {
    expect(STRINGS.en.forexSource("2026-10-12")).toBe("Source: Nepal Rastra Bank · published 2026-10-12. Bank rates may differ.");
    expect(STRINGS.ne.forexSource("2026-10-12")).toContain("२०२६-१०-१२");
  });
});
