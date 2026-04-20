# Goal Description

Architect and implement a privacy-first, fully decentralized activity tracker built on the AT Protocol (Bluesky), utilizing End-to-End Encryption (E2E) and native Web Components. This plan refines the high-level design outlined in the `design/` documents into actionable development phases.

## Decisions Made

- **Authentication**: We will implement the **AT Protocol OAuth specification** using `@atproto/oauth-client-browser` for a better user experience.
- **Lexicons**: We will proceed with custom/informal `app.wadlgaudi.*` Lexicons to start.
- **Activity Data Format**: We will focus on `.tcx` files, utilizing lightweight parsing libraries.
- **Crypto & Polyline Tooling**: We will utilize lightweight NPM packages (such as `bip39` for recovery phrases and `@mapbox/polyline` for compression) to simplify development, keeping the bundle size small.
- **Cross-Posting**: We will generate an interactive OG image/embed for the Bluesky cross-posts to provide a map preview.

## Proposed Changes

---

### Phase 1: Cryptography & CLI Tooling
Develop the foundational E2E encryption layer using the standard Web Crypto API, making it cross-compatible between browser and our Node CLI tools.

#### [NEW] `src/lib/crypto.ts`
- Implement `X25519` keypair generation for users.
- Implement symmetric encryption/decryption (`AES-256-GCM`).
- Add BIP39 12-word recovery phrase generation and seed restoration.
- Export clean, asynchronous functions.

#### [NEW] `scripts/crypto-cli.js`
- Create CLI commands to execute and verify the crypto workflows as dictated by the principles (e.g., `node scripts/crypto-cli.js generate-keys`).

#### [NEW] `tests/crypto.test.ts`
- Extensive unit tests covering the E2E encryption and decryption workflows.

---

### Phase 2: AT Protocol Integration & Data Layer
Create the business logic to handle reading and writing to the user's PDS server without coupling it to the UI.

#### [NEW] `src/lib/lexicons.ts`
- Define TypeScript interfaces matching the `app.wadlgaudi.crypto` and `app.wadlgaudi.activity` data models.

#### [NEW] `src/lib/atp-client.ts`
- Create a client class wrapping `@atproto/api` for authentication.
- Add methods: `publishPublicKey`, `resolveUserPublicKey`, `uploadActivityBlob`, `publishActivityRecord`, and `fetchFeed`.

#### [NEW] `tests/atp-client.test.ts`
- Unit tests mocking the AT Protocol API to ensure data payloads match the designed limits and formats.

---

### Phase 3: Activity Processing
Business logic for preparing activity data (e.g., extracting metadata and handling the "Soft Revocation" process).

#### [NEW] `src/lib/activity-parser.ts`
- Extract `distance`, `duration`, `sportType`, and coordinates from raw `.tcx` XML.
- Downsample and format coordinates for the lightweight Encrypted Summary.

#### [NEW] `src/lib/access-control.ts`
- Functions to manage the Activity Access List.
- Logic for "Soft Revocation": Decrypting the blob, generating a new `AES-256-GCM` key, re-encrypting, and replacing the Blob/Record on the PDS.

---

### Phase 4: UI & Web Components
Implement a rich, premium, and lightweight frontend entirely with native Web Components and vanilla CSS. 

#### [NEW] `index.css`
- Establish CSS variables for a dark-mode optimized, glassmorphic design system.
- Include modern typography (e.g., Inter/Roboto) and micro-animations for interactivity.

#### [NEW] `src/components/w-login.ts`
- A sleek sign-in form taking DID/handle and App Password.

#### [NEW] `src/components/w-feed.ts` & `w-activity-card.ts`
- A high-performance scrolling feed that decrypts activity summaries locally and renders stats/polylines.

#### [NEW] `src/components/w-upload.ts`
- An intuitive drag-and-drop zone for `.tcx` files.
- UI for sharing (selecting friends by DID/handle to add to the Access List).

## Verification Plan

### Automated Tests
- Run `npm test` to execute full coverage of the isolated business logic (Crypto, AT Protocol wrapper, Activity Parser).
- Execute CLI tools (e.g., `node scripts/crypto-cli.js`) to manually verify key reproducibility across sessions.

### Manual Verification
- **E2E Flow**: Launch the app locally via `npm run dev`. Log in using two separate test accounts on the AT Protocol sandbox network or live network.
- **Privacy Check**: Inspect the generated network requests and verify that the data payload sent to the PDS inside `app.wadlgaudi.activity` has its route and access map fully encrypted.
- **Revocation Check**: Share an activity with the second account, verify it loads in their feed. Revoke access from the first account, refresh the second account, and verify the activity is no longer decryptable.
- **UI Aesthetics**: Validate that the UI reflects a premium, fluid aesthetic with dynamic interactions and zero console errors.
