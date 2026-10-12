import { useMemo, useState } from "react";
import { FEATURED, convertToNpr, formatRate, type ForexDay } from "../lib/forex.ts";
import type { Strings } from "../lib/i18n.ts";

interface Props {
  day: ForexDay;
  lang: "ne" | "en";
  s: Strings;
  /** True when `day` is not today's date (today's rates are not published yet, or we are offline). */
  stale: boolean;
}

export function ForexCard({ day, lang, s, stale }: Props) {
  const [all, setAll] = useState(false);
  const [amount, setAmount] = useState("1");
  const [iso, setIso] = useState("USD");

  const rows = useMemo(() => {
    const featured = FEATURED.map((c) => day.rates.find((r) => r.iso3 === c)).filter((r) => r !== undefined);
    const rest = day.rates.filter((r) => !(FEATURED as readonly string[]).includes(r.iso3));
    return all ? [...featured, ...rest] : featured;
  }, [day, all]);

  const selected = day.rates.find((r) => r.iso3 === iso) ?? day.rates[0];
  const npr = convertToNpr(Number(amount), selected);

  return (
    <section className="forex" aria-label={s.forexTitle}>
      <h2 className="section-title">{s.forexTitle}</h2>
      {stale && <p className="notice">{s.forexStale}</p>}
      <table className="forex__table">
        <thead>
          <tr>
            <th scope="col">{s.forexCurrency}</th>
            <th scope="col">{s.forexBuy}</th>
            <th scope="col">{s.forexSell}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.iso3}>
              <th scope="row">
                <span className="forex__code">{r.iso3}</span>
                {r.unit > 1 && <small> {s.forexPer(r.unit)}</small>}
              </th>
              <td>{formatRate(r.buy, lang)}</td>
              <td>{formatRate(r.sell, lang)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="btn" aria-expanded={all} onClick={() => setAll((v) => !v)}>
        {all ? s.forexShowLess : s.forexShowAll}
      </button>

      <div className="forex__convert">
        <h3>{s.forexConvert}</h3>
        <div className="forex__fields">
          <label>
            <span>{s.forexAmount}</span>
            <input type="number" inputMode="decimal" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label>
            <span>{s.forexCurrency}</span>
            <select value={selected.iso3} onChange={(e) => setIso(e.target.value)}>
              {day.rates.map((r) => (
                <option key={r.iso3} value={r.iso3}>
                  {r.iso3}
                  {r.unit > 1 ? ` (${s.forexPer(r.unit)})` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="forex__result" role="status">
          <strong>रु {formatRate(npr, lang)}</strong> <small>{s.forexResult}</small>
        </p>
      </div>
      <p className="forex__source">{s.forexSource(day.date)}</p>
    </section>
  );
}
