# A personal assistant’s memory, not a task tracker

This dataset follows **Mina Chen**, a fictional bilingual translator living in London. It contains 95 interconnected records: preferences, friends and family, personal plans, books, saved places, courses, everyday memories and unsent message drafts.

**70 records describe an invented life. 25 are attributed public references** to real authors, books, courses, places, software and photographs. Public references have `demo_kind: public_reference`, `privacy: public`, official URLs and a source-check date. Fictional life records have `demo_kind: fictional` and `sources: ["demo:fictional"]`. No real author is represented as Mina’s friend, mentor or correspondent. No photos or book text are reproduced.

## Questions worth trying

- “What dates are we considering for Lisbon now, and why did they change?”
- “Draft Sam a message about Lisbon; make it sound like me.”
- “What should I remember before choosing a gift for Lena?”
- “Would a scented candle be a good present for Mia?”
- “What am I reading, and who lent it to me? No spoilers.”
- “What could Dev and I do on a rainy afternoon?”
- “Have I actually taken CS50, or just saved the link?”
- “Which notes explain why Sunday morning should stay free?”

Current intent lives in profiles and plans; dated notes preserve earlier states. Fictional progress and tentative commitments are deliberately incomplete so the assistant has to distinguish known facts from assumptions.

## Run or start empty

Run `npm run setup` and `npm start` from the application source to create and view this separate local demo repository. Setup never overwrites an old seed or your edits; preserve an existing `.local/demo` under another name before recreating it.

For **zero knowledge records**, use `npm run setup:empty` and `npm run start:empty`. The empty entry contains only routing and policy scaffolding. A new personal directory can be created with `scripts/setup.sh personal /absolute/new/path`.

Public URLs were inspected on 2026-09-12. Venue access, prices, software features and course arrangements can change; verify the source again for a real decision. The dated fictional narrative is not a live calendar or inbox.
