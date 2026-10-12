import { SNIPPET_MAX } from "../pipeline/text.ts";
import type { UiLang } from "../lib/i18n.ts";
import { DMCA_RESPONSE_HOURS, DMCA_URL } from "../lib/licensing.ts";

const COPY = {
  en: {
    title: "Content licensing and attribution",
    back: "Back to news",
    shown: "What we show",
    shownList: [
      "The headline, exactly as the publisher wrote it.",
      `A short snippet of at most ${SNIPPET_MAX} characters.`,
      "The publisher's own thumbnail, linked from their server.",
      "The outlet's name, and a link to the original article.",
    ],
    never: "What we never do",
    neverList: [
      "We do not republish full articles.",
      "We do not store article bodies or host publisher images.",
      "Every story opens on the publisher's own site.",
    ],
    credit: "Credit",
    creditText: "When several outlets cover the same story we merge them into one card and credit every outlet in it.",
    dmca: "Takedown requests (DMCA contact)",
    dmcaText: `Publishers and rights holders can ask us to remove any item or outlet. Open a takedown request with the maintainer, Sabin78910, on GitHub. Name the outlet and the article link. We reply within ${DMCA_RESPONSE_HOURS} hours and remove confirmed items, or the whole outlet on request.`,
    dmcaLink: "Open a takedown request on GitHub",
  },
  ne: {
    title: "सामग्री इजाजत र श्रेय",
    back: "समाचारमा फर्कनुहोस्",
    shown: "हामी के देखाउँछौं",
    shownList: [
      "प्रकाशकले लेखेकै शीर्षक।",
      `बढीमा ${SNIPPET_MAX} अक्षरको छोटो अंश।`,
      "प्रकाशकको आफ्नै थम्बनेल, उनीहरूकै सर्भरबाट।",
      "समाचार स्रोतको नाम र मूल लेखको लिङ्क।",
    ],
    never: "हामी कहिल्यै गर्दैनौं",
    neverList: [
      "हामी पूरा लेख पुनःप्रकाशन गर्दैनौं।",
      "हामी लेखको मूल पाठ वा प्रकाशकका तस्बिर भण्डारण गर्दैनौं।",
      "हरेक खबर प्रकाशककै साइटमा खुल्छ।",
    ],
    credit: "श्रेय",
    creditText: "धेरै स्रोतले एउटै खबर छापेमा हामी एउटै कार्डमा मिलाउँछौं र हरेक स्रोतलाई श्रेय दिन्छौं।",
    dmca: "हटाउने अनुरोध (DMCA सम्पर्क)",
    dmcaText: `प्रकाशक र अधिकारधनीले कुनै सामग्री वा स्रोत हटाउन अनुरोध गर्न सक्नुहुन्छ। GitHub मा सञ्चालक Sabin78910 लाई अनुरोध खोल्नुहोस्, स्रोत र लेखको लिङ्क लेख्नुहोस्। हामी ${DMCA_RESPONSE_HOURS} घण्टाभित्र जवाफ दिन्छौं र पुष्टि भएका सामग्री हटाउँछौं।`,
    dmcaLink: "GitHub मा हटाउने अनुरोध खोल्नुहोस्",
  },
} as const;

export function Licensing({ lang, onBack }: { lang: UiLang; onBack: () => void }) {
  const c = COPY[lang];
  return (
    <section className="licensing" aria-labelledby="licensing-title" lang={lang}>
      <button type="button" className="btn" onClick={onBack}>
        ← {c.back}
      </button>
      <h2 id="licensing-title" className="section-title">
        {c.title}
      </h2>
      <h3>{c.shown}</h3>
      <ul>
        {c.shownList.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
      <h3>{c.never}</h3>
      <ul>
        {c.neverList.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
      <h3>{c.credit}</h3>
      <p>{c.creditText}</p>
      <h3>{c.dmca}</h3>
      <p>{c.dmcaText}</p>
      <p>
        <a href={DMCA_URL} target="_blank" rel="noopener noreferrer">
          {c.dmcaLink}
        </a>
      </p>
    </section>
  );
}
