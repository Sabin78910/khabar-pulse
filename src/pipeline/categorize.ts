import type { Region, Source, Topic } from "./types.ts";

/** Keywords matched against feed category tags and URL path segments (high confidence). */
const TAG_RULES: [Topic, RegExp][] = [
  ["sports", /\b(sports?|cricket|football|soccer|tennis|golf|rugby|f1|formula-one|athletics|olympics?|nba|nfl)\b|खेलकुद|खेल|क्रिकेट|फुटबल/i],
  ["business", /\b(business|economy|economics|money|markets?|finance|banking|stock|share-?market|nepse|corporate|trade|arthatantra)\b|अर्थ|अर्थतन्त्र|बजार|बैंक|सेयर|शेयर|वाणिज्य|उद्योग/i],
  ["tech", /\b(tech|technology|science|science-and-tech|gadgets?|ai|internet|cyber|digital|startups?)\b|प्रविधि|विज्ञान|सूचना प्रविधि/i],
  ["entertainment", /\b(entertainment|arts?|art-culture|culture|film|films|movies?|music|celebrity|lifestyle|television|tv|books?|kala)\b|मनोरञ्जन|कला|सिनेमा|चलचित्र|संगीत|फिल्म/i],
];

const WORLD_TAG = /\b(world|international|global|asia|europe|americas|africa|middle-east|south-asia|us-news|uk-news|kosheli)\b|अन्तर्राष्ट्रिय|अन्तराष्ट्रिय|विश्व|विदेश/i;
const NEPAL_TAG = /\b(national|nepal|kathmandu|province|provinces|politics)\b|राष्ट्रिय समाचार|प्रदेश|समाज|राजनीति/i;
const POLITICS_TAG = /\b(politics|political|national|election|parliament|government)\b|राजनीति|राष्ट्रिय|निर्वाचन|संसद|सरकार/i;
const NEPAL_TITLE = /\bnepal(i|ese)?\b|नेपाल|काठमाडौं/i;

/** Title keywords used only when nothing more reliable matched (lower confidence, kept narrow). */
const TITLE_RULES: [Topic, RegExp][] = [
  ["sports", /\b(cricket|football|t20|odi|premier league|world cup|champions league|wicket|fifa|icc)\b|क्रिकेट|फुटबल|विश्वकप/i],
  ["business", /\b(nepse|stock market|inflation|gdp|central bank|interest rate|remittance|ipo)\b|नेप्से|सेयर बजार|मुद्रास्फीति|रेमिट्यान्स|राष्ट्र बैंक/i],
  ["tech", /\b(artificial intelligence|smartphone|iphone|android|openai|chatgpt|spacex|nasa)\b|मोबाइल|स्मार्टफोन|इन्टरनेट/i],
];

function urlPath(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname).toLowerCase().replace(/[/_]+/g, " ");
  } catch {
    return "";
  }
}

/** Works out the region (Nepal / World) and topic of one article. */
export function categorize(
  source: Pick<Source, "region" | "topic">,
  tags: string[],
  url: string,
  title: string,
): { region: Region; topic: Topic } {
  const tagText = tags.join(" | ");
  const path = urlPath(url);
  let topic: Topic = source.topic;
  // Topic outlets (e.g. a business site) also post politics; their own tags say so.
  if (topic !== "general" && tags.length) {
    const own = TAG_RULES.find(([t]) => t === topic)?.[1];
    if (own && !own.test(tagText) && POLITICS_TAG.test(tagText)) topic = "general";
  }
  if (topic === "general") {
    for (const [t, re] of TAG_RULES) {
      if (re.test(tagText) || re.test(path)) {
        topic = t;
        break;
      }
    }
  }
  if (topic === "general") {
    for (const [t, re] of TITLE_RULES) {
      if (re.test(title)) {
        topic = t;
        break;
      }
    }
  }
  let region: Region = source.region;
  if (region === "nepal") {
    if ((WORLD_TAG.test(tagText) || WORLD_TAG.test(path)) && !NEPAL_TAG.test(tagText)) region = "world";
  } else if (NEPAL_TITLE.test(title)) {
    region = "nepal";
  }
  return { region, topic };
}
