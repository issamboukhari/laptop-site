# gen — Project Map

> Last updated: 2026-08-19 | Critical Upgrade + Spec Fix + Gemini Chat Panel | M1–M5 functional

## [TECH_STACK]

| Layer       | Technology          | Version  | Purpose                          |
|-------------|---------------------|----------|----------------------------------|
| Framework   | Next.js             | 16.3.1   | App Router, Server Components    |
| UI Library  | React               | 19.2.8   | Component model, hooks           |
| Language    | TypeScript          | ^5       | Type safety (strict)             |
| Styling     | Tailwind CSS        | ^4       | Utility-first CSS, Oxide engine  |
| Icons       | Lucide React        | 1.33.0   | Clean icon set                   |
| AI SDK      | @google/genai       | 2.17.1   | Gemini API (server-side only)    |
| Runtime     | Node.js             | 24.x LTS | Server environment               |
| Utilities   | clsx + tailwind-merge | latest | Class name composition           |

## [SYSTEM_FLOW]

```
1. User opens gen → SSR renders root layout with dark mode (inline script)
2. Home page: search bar + category filter + model grid (models with variant counts)
3. User searches/filters → Client-side filtering (no API call, instant)
4. User clicks a model → "Choose your configuration" screen with selectable variant cards
   (CPU/GPU/RAM/Storage/Display/Price + View Details / Add to Comparison buttons)
5. Add to Comparison → centralized store (localStorage "gen-compare-selected", max 2) →
   floating CompareBar on home/model/variant pages
6. Select 2 exact variant IDs → /compare?a={variantId}&b={variantId} (same-family comparisons work)
7. Compare page: exact config summaries, per-category spec comparison with ▲ winners,
   multi-criteria ratings (16 categories), priority recommendation, gaming analysis, Ask Gemini
   (dedicated chat panel at the bottom of the comparison)
8. Variant detail: complete spec sections (9 groups) with "Not available" for unknown fields;
   ratings grid derived from the exact configuration
9. Multi-criteria ratings computed client-side from actual specs (lib/scoring/ratings.ts),
   now using structured fields (coolingSystem, fans, ramType/speed, resolution, panelType,
   brightness, touchscreen, upgradeability, storageSlots)
10. Chat with Gemini → POST /api/chat → server calls Gemini → auto-context includes
    complete structured specs + all 16 ratings + scoring factors; never invents data;
    structured error codes (NO_API_KEY / SERVER_ERROR / network) shown inline without
    breaking the comparison; dedicated GeminiChatPanel with suggestions + animations
11. Favorites / Recent (localStorage) persist across sessions
12. Standalone index.html mirrors all features (no server, no API key needed)
```

## [ARCHITECTURE]

```
app/
├── layout.tsx              # Root layout, fonts, theme inline script, metadata
├── page.tsx                # Home: search, filter, model grid (client) + CompareBar
├── globals.css             # Tailwind v4, gen brand colors, glass effects
├── api/
│   └── chat/route.ts       # POST → Gemini API (server-only, auto-context + full specs)
├── compare/
│   └── page.tsx            # Config summaries + spec comparison + ratings + gaming + chat
├── computer/
│   └── [id]/
│       ├── page.tsx        # Model "Choose configuration" screen + variant detail (spec sections + ratings)
│       └── ComputerActions.tsx  # Favorite + Add-to-Comparison buttons (client)

components/
├── ui/
│   ├── Button.tsx          # Primary/secondary/ghost/outline variants
│   ├── Card.tsx            # Card/CardHeader/CardContent/CardFooter
│   ├── Badge.tsx           # Default/accent/success/warning/danger/outline
│   └── SearchInput.tsx     # Search with icon, focus ring
├── layout/
│   ├── Header.tsx          # Sticky glass header, logo, nav, theme toggle
│   └── Footer.tsx          # Minimal footer
├── computer/
│   ├── ComputerCard.tsx    # Model card with variant count + compare/favorite buttons
│   ├── ComputerGrid.tsx    # Responsive grid wrapper
│   ├── VariantCard.tsx     # Config card: full specs, View Details + Add to Comparison
│   ├── SpecSections.tsx    # Complete spec display (9 groups, "Not available" fallback)
│   └── FilterBar.tsx       # Category filter pills with counts
├── compare/
│   ├── CompareBar.tsx      # Floating bottom bar: selected variants, remove, Compare Now
│   ├── SpecComparison.tsx  # Per-category spec rows with ▲/▼ winners
│   ├── RatingsComparison.tsx   # Side-by-side 16-category ratings with winners
│   └── GameCompatibility.tsx   # Game picker + per-computer compatibility verdicts
├── rating/
│   └── RatingsCard.tsx     # Per-computer multi-criteria rating grid
└── gemini/
    ├── GeminiChatPanel.tsx  # Dedicated chat panel: bubbles, input, suggestions, loading,
    │                       #   animations; config-issue errors show a setup prompt + action
    ├── GeminiSetupDialog.tsx # Add/Configure API key modal: password input, "where does it go"
    │                       #   explanation, Test Connection + Save & Enable, success/error states
    ├── ChatBubble.tsx      # Markdown-rendered chat message bubble
    ├── ChatInput.tsx       # Auto-resize textarea + send button
    └── TypingIndicator.tsx # Animated typing dots

lib/
├── data/
│   ├── types.ts            # ComputerVariant, ComputerModel, expanded ComputerSpecs,
│   │                       #   RatingCategory, ComputerRatings, Game, GameCompatibility
│   ├── computers.ts        # ~31 models / ~69 variants; MODEL_BASE_SPECS per-model chassis map;
│   │                       #   enrichVariant() merges base + variant specs then enrichSpecs()
│   │                       #   derives structured fields from display/ports strings
│   ├── games.ts            # 23 games + estimateGameCompatibility()
│   └── categories.ts       # USE_CASES, USE_CASE_WEIGHTS, CATEGORY_LABELS
├── server/
│   └── gemini.ts           # Server-only key manager: env GEMINI_API_KEY → runtime `.data/` file
│                           #   fallback; diagnoseGeminiError() classifies missing/invalid/revoked/
│                           #   quota/model/network; testGeminiConnection() verifies a key
├── scoring/
│   ├── algorithm.ts        # calculateScore(), calculateComparison() (per-use-case)
│   └── ratings.ts          # RATING_DEFINITIONS, calculateRatings() (16 categories)
└── utils/
    ├── cn.ts               # clsx + tailwind-merge
    ├── format.ts           # formatPrice, formatRam, formatStorage, formatWeight, formatBattery, getScoreColor/Bg
    └── specFormat.ts       # formatFullSpecs() — complete structured specs for Gemini context

hooks/
├── use-theme.ts            # DOM-based theme toggle (no setState-in-effect)
├── use-gemini-chat.ts      # Chat state, send/clear/history management
└── use-compare-selection.ts # Central compare store (gen-compare-selected, max 2, toggle/clear)
```

## [COMPLETE SPECS MODEL]

`ComputerSpecs` now supports 40+ structured fields grouped in UI as:
- Processor & Graphics: cpu, cpuCores, gpu, ram, ramType, ramSpeed, ramUpgradeable
- Storage: capacity, storageType, storageSlots, upgradeability
- Display: display, size, resolution, refreshRate, panelType, brightness, colorCoverage, aspectRatio, touchscreen, hdr
- Battery & Power: batteryLife, batteryCapacity, charger, weight, dimensions
- Connectivity & Ports: wifi, bluetooth, ethernet, usbA, usbC, thunderbolt, hdmi, displayPort, sdCard, audioJack
- Security & Biometrics: fingerprint, faceRecognition, irCamera, tpm, privacyShutter, smartCardReader
- Camera & Audio: webcam, microphones, speakers, audioFeatures
- Keyboard & Input: backlitKeyboard, rgbKeyboard, keyboardLayout, numpad, stylusSupport
- Build & Features: buildMaterial, militaryCertification, coolingSystem, fans, warranty

- `enrichSpecs()` (lib/data/computers.ts) parses existing `display`/`ports` strings into
  structured fields (resolution, panelType, aspectRatio, touchscreen, USB/Thunderbolt/HDMI
  counts, Ethernet/SD/audio presence). It never invents data.
- `MODEL_BASE_SPECS` (lib/data/computers.ts) is a chassis-level map keyed by model id:
  connectivity (wifi/bluetooth), security/biometrics, keyboard, and build/features fields
  shared by every configuration of a model family. `enrichVariant(modelId, variant)` merges
  `{ ...base, ...variant.specs }` then runs `enrichSpecs()` — variant-level values win, so
  explicit config data is never overridden. Same map mirrored in index.html.
- Any unverifiable field renders as **"Not available"** on the variant detail page,
  spec comparison, and in Gemini context. All 69 variants now have populated
  security + build/features fields; connectivity fields are populated except where the
  chassis genuinely lacks them (e.g. workstations have no Wi-Fi/keyboard → "Not available").
- Lenovo LOQ 15 added with 4 real configs (i5/RTX3050/8GB → i7/RTX4060/32GB/165Hz);
  extra configs added to Nitro 5, Predator Helios 18, XPS 14, Surface Laptop 7,
  iMac 24, Legion Tower 5.

## [MULTI-CRITERIA RATINGS]

16 categories, each 0–100, computed deterministically from actual specs:
`gaming, programming, university, editing, design, ai, battery, performance, portability, upgradeability, thermal, productivity, display, multimedia, value, longevity`.

- Each rating is a weighted blend of normalized factors (CPU/GPU score, RAM + type/speed,
  storage + type, display refresh + panel quality + resolution + brightness + touch,
  battery life, weight, price, user rating, year, cooling, upgradeability).
- `thermal` uses real `coolingSystem`/`fans` data when present; otherwise category heuristic and marked `estimated`.
- `upgradeability` uses `ramUpgradeable`/`storageSlots`/`upgradeability` when present.
- Ratings appear on: variant detail page (grid), compare page (side-by-side + winners),
  and are passed to Gemini as automatic context with their scoring factors.
- Compare page lets users pick up to 3 priority categories → weighted overall recommendation.

## [GAMING ANALYSIS]

- Local game DB (23 games) with min/recommended CPU score, GPU score, RAM, storage.
- Verdict tiers: Excellent / Good / Playable / Not Recommended.
- Estimated FPS range @ 1080p computed from GPU/CPU headroom, clearly labeled as an estimate.

## [GEMINI INTEGRATION]

- `/api/chat` POST: `{ computerIds, question, history }` → Gemini `gemini-3.6-flash`.
- Automatic context per computer: brand/model, category, year, price, description +
  complete structured specs (`formatFullSpecs` in lib/utils/specFormat.ts) +
  all 16 multi-criteria ratings. Unknown fields are explicitly "Not available".
- System prompt: specialized computer advisor; politely redirects non-computer questions;
  never invents missing specs; can explain WHY a category scored N/100 from the provided
  specs and scoring factors.
- Frontend `useGeminiChat` sends `computerIds[]`; API resolves variants server-side via `findVariantById`.
- Structured error handling: API returns `{ error, code }` with classified diagnosis from
  `lib/server/gemini.ts` — NO_API_KEY / INVALID_API_KEY / UNAUTHORIZED / QUOTA_EXCEEDED /
  MODEL_NOT_FOUND / SERVER_ERROR / NETWORK (status 503/400/401/403/429/404/500/502).
- `useGeminiChat` maps codes to friendly titles/messages; `GeminiChatPanel` renders an amber
  "not configured" card with an **Add Gemini API key** action (opens `GeminiSetupDialog`) for
  config issues, or a red error with Retry otherwise. Comparison UI stays fully functional.
- `GeminiSetupDialog` lets the user paste a key (password field, never echoed), explains it is
  stored server-side only and recommends `GEMINI_API_KEY` in the environment / `.env.local`,
  provides **Test Gemini Connection** (success: "✓ Gemini connected successfully") and
  **Save & Enable**. Saving validates the key against Gemini before persisting to
  `.data/gemini-api-key` (gitignored, mode 0600, never in the frontend bundle).
- API endpoints: `GET/POST /api/gemini/config` (status / validate+save) and
  `POST /api/gemini/test` (verify a key without saving).
- `index.html` mirrors the setup flow: config-issue errors render an inline key input with
  Test + Save that call the same-origin endpoints.
- `index.html` is now served from `public/` (accessible at `/index.html` when the app runs),
  so its chat panel calls the same-origin `/api/chat` and works live. If the API/key is
  unavailable it shows a clear "Gemini unavailable" error while the comparison stays functional.

## [SECURITY]

- `.env.local` — Contains `GEMINI_API_KEY` (never committed, gitignored by `.env*`)
- API key only accessed server-side via `process.env.GEMINI_API_KEY`
- Frontend has zero references to the API key
- Standalone `index.html` uses no API key (ratings + game analysis are fully local)

## [ORPHANS & PENDING]

### This Session
- Spec population + Gemini chat panel + index.html mirror (prior session)
- Gemini API key handling: `lib/server/gemini.ts` (env → runtime `.data/` file fallback),
  structured diagnosis of missing/invalid/revoked/expired/quota/model/network errors,
  `testGeminiConnection()`; key validated before saving, persisted server-side only
- `/api/gemini/config` (GET status, POST validate+save) + `/api/gemini/test` endpoints
- `GeminiSetupDialog` (secure key entry, Test Connection, Save & Enable, clear success/error)
- `GeminiChatPanel` shows "Gemini AI is not configured. Add your Gemini API key…" prompt with
  an Add action for config issues; comparison stays functional
- `index.html` mirrors the setup flow with inline Test + Save
- Key never in frontend bundle / never echoed / never committed (`.data/` gitignored)
- Build + lint + tsc clean; live-tested missing/invalid/valid key paths

### Remaining Milestones
- [ ] **M6** — Design polish (Framer Motion animations, page transitions)
- [ ] **M7** — PWA config (@serwist/next, manifest, icons)
- [ ] **M8** — Mobile QA, final polish

### Specific Items
- [ ] Mobile comparison layout (horizontal scroll / stacked)
- [ ] Responsive comparison table for mobile
- [ ] Expand game DB with user-submitted titles