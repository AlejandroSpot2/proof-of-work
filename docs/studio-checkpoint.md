# Studio overhaul: implementation checkpoint

Started 13:32 PT. Build closes 18:00 PT.

## Throughput

- **Blocking first:** data fixes (EXAMPLE commit and merge dates; Kerf narrowed to docs and release process), global tokens and fonts (Geist, paper and cobalt). Done before any fan-out.
- **Independent workstreams:**
  - A. Attorney packet (delegated): `lib/packet/*`, `components/packet/*`, `app/packet/*`, `app/api/packet/*`, `app/api/p/[token]/packet/*`, `tests/packet.test.ts`.
  - B. Studio, portfolio, swarm, concept art, landing (me): `app/studio`, `app/portfolio`, `app/p/[token]` portfolio branch, `components/studio2/*`, `components/portfolio/*`, `app/page.tsx`.
- **Shared state:** none written by both. Both read `lib/views/project.ts` and the fixtures; neither edits them without saying so. The old workbench moves to `/workbench`; the guided demo stays at `/demo` as a legacy route.
- **Smallest safe decomposition:** two owners. The packet is a self-contained renderer with its own tests; the Studio is one coupled UI.

## Order

1. Portfolio component (hero, covers with concept art, project detail, proof drawer, capabilities, next build, SF roles) at `/portfolio` and `/p/[token]`.
2. Studio shell: sources rail, build, canvas with the CV "before" and the portfolio preview, editing, share, packet.
3. Swarm reveal.
4. Landing rewrite with direct entries.
5. Screenshots at 1440, 1280x720 and 390; critique rounds; walkthrough v3 with PDF download.

## Status

- [x] Data fixes, tokens, fonts
- [x] Packet (delegated), first version: 28-page PDF, two-pass TOC
- [x] Packet reframed as the First Consultation Kit: 29-page PDF, expandable preview, working download
- [x] Portfolio: hero, project index, covers with concept art, project views, proof, next build, SF roles
- [x] Studio: sources rail, build, editable preview, share, review
- [x] Swarm
- [x] Landing
- [x] Walkthrough v4: 12/12, including the kit PDF download
- [x] Final critique round, kit screenshots, attorney share link wired to the kit
