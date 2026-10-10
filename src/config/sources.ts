import type { Source } from "../pipeline/types.ts";

/**
 * News sources. Every feed below was checked with curl on 10 Oct 2026 and returned a valid RSS/Atom
 * document with items. Not included because their feeds did not work that day:
 * Republica (/rss 404, /rss/latest 503), Ukaalo (403 to non-browser clients), AP (403),
 * Reuters (no public RSS), eKantipur (/rss 404), Rising Nepal and Gorkhapatra (no response),
 * The Himalayan Times international feed (/rssFeed/5, valid but empty).
 *
 * `region` and `topic` are defaults; each article is re-categorised from its feed tags, URL and title.
 */
export const SOURCES: Source[] = [
  // Nepal, Nepali language
  { id: "onlinekhabar", name: "Onlinekhabar", nameNe: "अनलाइनखबर", feed: "https://www.onlinekhabar.com/feed", site: "https://www.onlinekhabar.com", lang: "ne", region: "nepal", topic: "general" },
  { id: "setopati", name: "Setopati", nameNe: "सेतोपाटी", feed: "https://www.setopati.com/feed", site: "https://www.setopati.com", lang: "ne", region: "nepal", topic: "general" },
  { id: "ratopati", name: "Ratopati", nameNe: "रातोपाटी", feed: "https://www.ratopati.com/feed", site: "https://www.ratopati.com", lang: "ne", region: "nepal", topic: "general" },
  { id: "nepalnews", name: "Nepal News", nameNe: "नेपालन्युज", feed: "https://nepalnews.com/feed", site: "https://nepalnews.com", lang: "ne", region: "nepal", topic: "general" },
  { id: "khabarhub", name: "Khabarhub", nameNe: "खबरहब", feed: "https://khabarhub.com/feed", site: "https://khabarhub.com", lang: "ne", region: "nepal", topic: "general" },
  { id: "bbcnepali", name: "BBC Nepali", nameNe: "बीबीसी नेपाली", feed: "https://feeds.bbci.co.uk/nepali/rss.xml", site: "https://www.bbc.com/nepali", lang: "ne", region: "nepal", topic: "general" },
  { id: "nagarik", name: "Nagarik News", nameNe: "नागरिक", feed: "https://nagariknews.nagariknetwork.com/feed", site: "https://nagariknews.nagariknetwork.com", lang: "ne", region: "nepal", topic: "general" },
  { id: "annapurna", name: "Annapurna Post", nameNe: "अन्नपूर्ण पोस्ट", feed: "https://annapurnapost.com/rss", site: "https://annapurnapost.com", lang: "ne", region: "nepal", topic: "general" },
  { id: "bizmandu", name: "Bizmandu", nameNe: "बिजमाण्डू", feed: "https://bizmandu.com/feed", site: "https://bizmandu.com", lang: "ne", region: "nepal", topic: "business" },
  { id: "techpana", name: "Techpana", nameNe: "टेकपाना", feed: "https://www.techpana.com/feed", site: "https://www.techpana.com", lang: "ne", region: "nepal", topic: "tech" },

  // Nepal, English language
  { id: "onlinekhabar-en", name: "Onlinekhabar English", feed: "https://english.onlinekhabar.com/feed", site: "https://english.onlinekhabar.com", lang: "en", region: "nepal", topic: "general" },
  { id: "kathmandupost", name: "The Kathmandu Post", feed: "https://kathmandupost.com/rss", site: "https://kathmandupost.com", lang: "en", region: "nepal", topic: "general" },
  { id: "himalayan", name: "The Himalayan Times", feed: "https://thehimalayantimes.com/rssFeed/15", site: "https://thehimalayantimes.com", lang: "en", region: "nepal", topic: "general" },
  { id: "himalayan-business", name: "The Himalayan Times", feed: "https://thehimalayantimes.com/rssFeed/11", site: "https://thehimalayantimes.com", lang: "en", region: "nepal", topic: "business" },
  { id: "himalayan-sports", name: "The Himalayan Times", feed: "https://thehimalayantimes.com/rssFeed/3", site: "https://thehimalayantimes.com", lang: "en", region: "nepal", topic: "sports" },
  { id: "himalayan-entertainment", name: "The Himalayan Times", feed: "https://thehimalayantimes.com/rssFeed/16", site: "https://thehimalayantimes.com", lang: "en", region: "nepal", topic: "entertainment" },
  { id: "himalayan-tech", name: "The Himalayan Times", feed: "https://thehimalayantimes.com/rssFeed/17", site: "https://thehimalayantimes.com", lang: "en", region: "nepal", topic: "tech" },
  { id: "khabarhub-en", name: "Khabarhub English", feed: "https://english.khabarhub.com/feed", site: "https://english.khabarhub.com", lang: "en", region: "nepal", topic: "general" },
  { id: "nepalitimes", name: "Nepali Times", feed: "https://nepalitimes.com/feed", site: "https://nepalitimes.com", lang: "en", region: "nepal", topic: "general" },

  // World
  { id: "bbc-world", name: "BBC News", feed: "https://feeds.bbci.co.uk/news/world/rss.xml", site: "https://www.bbc.com/news", lang: "en", region: "world", topic: "general" },
  { id: "aljazeera", name: "Al Jazeera", feed: "https://www.aljazeera.com/xml/rss/all.xml", site: "https://www.aljazeera.com", lang: "en", region: "world", topic: "general" },
  { id: "guardian-world", name: "The Guardian", feed: "https://www.theguardian.com/world/rss", site: "https://www.theguardian.com", lang: "en", region: "world", topic: "general" },
  { id: "npr-world", name: "NPR", feed: "https://feeds.npr.org/1004/rss.xml", site: "https://www.npr.org", lang: "en", region: "world", topic: "general" },
  { id: "dw", name: "DW", feed: "https://rss.dw.com/rdf/rss-en-world", site: "https://www.dw.com", lang: "en", region: "world", topic: "general" },
  { id: "france24", name: "France 24", feed: "https://www.france24.com/en/rss", site: "https://www.france24.com", lang: "en", region: "world", topic: "general" },

  // World business, tech, sports, entertainment
  { id: "bbc-business", name: "BBC News", feed: "https://feeds.bbci.co.uk/news/business/rss.xml", site: "https://www.bbc.com/news", lang: "en", region: "world", topic: "business" },
  { id: "guardian-business", name: "The Guardian", feed: "https://www.theguardian.com/business/rss", site: "https://www.theguardian.com", lang: "en", region: "world", topic: "business" },
  { id: "cnbc", name: "CNBC", feed: "https://www.cnbc.com/id/100727362/device/rss/rss.html", site: "https://www.cnbc.com", lang: "en", region: "world", topic: "business" },
  { id: "bbc-tech", name: "BBC News", feed: "https://feeds.bbci.co.uk/news/technology/rss.xml", site: "https://www.bbc.com/news", lang: "en", region: "world", topic: "tech" },
  { id: "guardian-tech", name: "The Guardian", feed: "https://www.theguardian.com/technology/rss", site: "https://www.theguardian.com", lang: "en", region: "world", topic: "tech" },
  { id: "verge", name: "The Verge", feed: "https://www.theverge.com/rss/index.xml", site: "https://www.theverge.com", lang: "en", region: "world", topic: "tech" },
  { id: "techcrunch", name: "TechCrunch", feed: "https://techcrunch.com/feed/", site: "https://techcrunch.com", lang: "en", region: "world", topic: "tech" },
  { id: "arstechnica", name: "Ars Technica", feed: "https://feeds.arstechnica.com/arstechnica/index", site: "https://arstechnica.com", lang: "en", region: "world", topic: "tech" },
  { id: "bbc-sport", name: "BBC Sport", feed: "https://feeds.bbci.co.uk/sport/rss.xml", site: "https://www.bbc.com/sport", lang: "en", region: "world", topic: "sports" },
  { id: "guardian-sport", name: "The Guardian", feed: "https://www.theguardian.com/sport/rss", site: "https://www.theguardian.com", lang: "en", region: "world", topic: "sports" },
  { id: "espncricinfo", name: "ESPNcricinfo", feed: "https://www.espncricinfo.com/rss/content/story/feeds/0.xml", site: "https://www.espncricinfo.com", lang: "en", region: "world", topic: "sports" },
  { id: "bbc-entertainment", name: "BBC News", feed: "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml", site: "https://www.bbc.com/news", lang: "en", region: "world", topic: "entertainment" },
];
