<!--
SPDX-FileCopyrightText: 2026 The HedgeDoc developers (see AUTHORS file)

SPDX-License-Identifier: CC-BY-SA-4.0
-->

# nodeBook fork surface & un-forking roadmap

This fork of hedgedoc/hedgedoc aims to shrink to zero. All nodeBook logic lives
in published npm packages (`@nodebook/core`, `/react`, `/dom`, `/markdown-it`);
what remains in-tree falls into these categories:

## 1. Extension glue (upstreaming candidate)

The nodeBook integration follows the exact pattern of upstream's ten
external-lib extensions (mermaid, katex, graphviz, …):

- `frontend/src/extensions/external-lib-app-extensions/nodebook/` — thin glue
  over `@nodebook/react`
- `external-lib-app-extensions.ts` — +2 registration lines
- `preconfigured-highlight-js.ts` — +4 lines (CNL hljs language)
- `sidebar.tsx` / `sidebar/types.ts` — +8 lines (stats menu mount; logic lives
  in `@nodebook/core` `computeNodeBookStatsFromMarkdown`)
- `next.config.js` — `transpilePackages` for the workspace packages (drops out
  when depending on published packages)

Roadmap: propose `NodeBookAppExtension` upstream as the eleventh external-lib
extension, built on the published packages.

## 2. Analyze backend (extraction planned)

`backend/src/nodebook/` + `backend/src/api/private/nodebook/` +
`llm.config.ts` + registrations in `app.module.ts` /
`private-api.module.ts`. Stateless (no tables) — proxies the in-network NLP
service. Roadmap: standalone service container; the frontend calls a
configured URL.

## 3. Generic fixes (offered upstream)

Branches based on `upstream/develop`, ready as PRs to hedgedoc/hedgedoc:

- `upstream-fix/realtime-yjs-state` — yjs state passed as `Uint8Array`, not
  `.buffer` (view offset/length loss)
- `upstream-fix/frontend-reconnect` — reconnect timeout `Math.max`→`Math.min`
  cap + state reset on websocket url change
- `upstream-fix/controlled-password-fields` — missing `value` prop

Mobile UX changes (`useIsMobile` guards in splitter/sign-in/new-note/app-bar,
swipe toggle) are candidates for a discussed feature PR.

## 4. Deployment overlay (never upstreams)

Branding and deployment-specific content, to move into an overlay applied at
build/deploy time once the extension is upstream:

- Logos/icons/webmanifest (`hedge-doc-logo-*`, `frontend/public/icons/*`,
  `apple-icon.png`, `favicon.ico`, `icon.png`)
- App metadata in `app/(editor)/layout.tsx`, `links.json`, `locales/en.json`
- `intro.md` (backend + frontend), seeds (`backend/src/database/seeds/*`,
  `docker/seed-content/`)
- `docker/Caddyfile`, `docker-compose.yml` (nlp service, ports), Dockerfiles
- Starter-note template in `new-note-button.tsx`

## 5. Deliberate divergences (kept until upstream moves)

- markdown-it v14 (upstream v13) + `next.config.js` extensionAlias; known jest
  debt (~20 suites deep-importing `.mjs`)
- Guarded migration `20260525000000_add_session_table.js` — compatibility shim
  for upstream's in-place edit of the initial migration; droppable once all
  deployments have run it. **The fork adds no database tables of its own.**

## Sync process

See the monthly sync playbook (conflict rules, lockfile regeneration) — last
sync PR #89, 2026-08-09.
