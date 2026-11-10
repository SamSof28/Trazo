# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Existing monorepo: React 19 + Vite 7 + TypeScript + Tailwind CSS 4, TanStack Query, React Router, Zustand. API is Express + Prisma + Supabase; the SPA never talks to Supabase directly.

## Users

Travel advisors (`ADVISOR`) of a tourism agency and their administrators (`ADMIN`). Advisors work at a desk, often with a client in front of them or on a call, and need to turn a loose travel idea into a presentable plan quickly. Administrators also manage the catalog and advisor accounts.

## Product Purpose

Trazo turns a natural-language travel brief into an editable, publishable trip plan: destination, hotels, activities, transport, a day-by-day itinerary, a budget with the agency margin, and a branded PDF. It replaces spreadsheets, loose emails and manual copy-paste. Success means an advisor can go from a sentence to a plan they are proud to send in one sitting.

## Positioning

The AI never invents prices or final names. It proposes a structure anchored to the agency's real catalog, and the server recalculates every amount from persisted data. The advisor keeps control: every item can be swapped, edited or removed, and the client-facing PDF carries the agency's identity.

## Operating Context

- Advisors create a trip request from a single prompt, answer at most a few questions, then generate and refine a plan.
- Plans move through `DRAFT` → `SAVED` → `PUBLISHED`; `PUBLISHED` is read-only and must be duplicated to edit. `ARCHIVED` leaves the active flow.
- The catalog is Colombia-first and organized by destination, hotel, activity and transport. Prices are stored in minor units and displayed in COP.
- The plan is the artifact that gets shown and exported; the chat is a means, not the product.
- The demo is presented live to a professor and classmates; the first authenticated screen must explain who we are before asking for an AI prompt.

## Capabilities and Constraints

- Authentication with access token in memory and rotating refresh cookie. No public sign-up.
- Catalog browsing is authenticated. `ADVISOR` can read; `ADMIN` can write.
- Conversational intake is deterministic; the AI generation is asynchronous with progress states.
- Plan editing includes alternatives, item details, add/remove/reorder, margin 0–100, save, publish, archive and duplicate.
- Reports are JSON/CSV and PDF; the PDF is generated server-side from the persisted plan.
- No real payments, supplier bookings, multi-tenant support or public client portal in this MVP.
- Availability by date (HU 3.3–3.4), weather (HU 2.6) and load tests are not implemented; do not present them as done.
- The map is currently a destination context panel/link, not a live Leaflet map; do not claim live routing.

## Brand Commitments

- Name: **Trazo**. Voice: warm, direct, editorial, a little playful; Spanish (Colombia), no corporate filler.
- The product should feel like a travel atelier, not a booking engine: paper, maps, routes, handwritten annotations, real place names.
- Existing palette and type: forest, sand, mint, teal, orange and gold; Bricolage Grotesque for display, DM Sans for UI. Preserve them.
- Existing visual references: `docs/mockups/*.html`, the login screen and `frontend/Registro-html/Register.dc.html`. The world is soft, rounded, optimistic and precise.

## Evidence on Hand

- Seeded Supabase catalog: 7 Colombian destinations (Cartagena, Eje Cafetero, Medellín, San Andrés, Santa Marta, Bogotá, Guatapé), 14 hotels, 28 activities, 15 transport options.
- Real backend contract in `docs/API.md` and `docs/BACKEND.md`.
- Real admin credentials live in `backend/.env`; never expose them in UI copy, docs or the client bundle.
- The 7 destination photos are local WebP files in `frontend/public/images/destinations/` and are reused for hotels/activities/transport when those items do not have a specific asset. They are reference photography, not owned photography.
- The PDF is generated from persisted plans; no client-side price calculation is allowed.

## Product Principles

1. **The advisor stays the author.** The AI drafts; the human decides. Every generated choice must be visibly editable.
2. **Catalog truth over model fluency.** If a price or name is not in the catalog, it does not ship.
3. **Show the trip, not the machinery.** The interface leads with places, days, times and totals; AI states are supporting feedback.
4. **One screen, one next move.** Every surface should make the next action obvious without a manual.
5. **The exported plan is the brand.** The PDF is a client-facing artifact and deserves the same craft as the app.

## Accessibility & Inclusion

- Keyboard-operable controls, visible focus rings, semantic headings and labels.
- Status changes (generation, save, publish) announced with `aria-live`.
- Color is never the only carrier of status; badges include text.
- Respect reduced motion for non-essential animation.
