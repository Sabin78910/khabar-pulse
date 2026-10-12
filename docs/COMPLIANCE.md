# Compliance record

Khabar Pulse is a news aggregator. The public policy lives at `#/licensing` in the app (linked from the
footer and the Play listing). This file records the same rules.

## Content
- We show only: the headline, a snippet of at most 200 characters (`SNIPPET_MAX` in
  `src/pipeline/text.ts`), the publisher's own thumbnail, the outlet name, and a link to the original.
- We republish no full articles. Every story opens on the publisher's site.
- Every outlet in a merged cluster is credited on the card.
- A unit test asserts no snippet leaving the pipeline exceeds 200 characters.

## Takedown (DMCA)
- Contact: the maintainer, Sabin78910, through a GitHub issue:
  https://github.com/Sabin78910/khabar-pulse/issues/new
- Include the outlet and the article link. We respond within 72 hours and remove confirmed items, or a
  whole outlet on request (delete it from `src/config/sources.ts`).

## Google Play
- Complete the news and magazine self-declaration in Play Console (news aggregator / RSS reader).
- Use the `#/licensing` page URL of the deployed app as the content policy link in the listing.
