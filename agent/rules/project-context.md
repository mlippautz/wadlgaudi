# Wadlgaudi Activity Tracker: AI Agent Rules

When assisting with this codebase, always adhere to the following project-specific principles:

## 1. Core Philosophy: KISS
- **Keep it simple, stupid.** Avoid over-engineering.
- Prioritize native web APIs and standard JavaScript/TypeScript features over adding external dependencies. 
- Only pull in lightweight NPM packages (e.g., `bip39`, `@mapbox/polyline`) when strictly necessary, and avoid large frameworks.

## 2. Frontend Architecture
- **No Heavy Frameworks:** The web application is built using **TypeScript**, **Lit** (for Web Components), and vanilla CSS. Do not introduce React, Vue, Svelte, or TailwindCSS. We use Lit to reduce boilerplate while maintaining the lightweight spirit of native Web Components.
- **Design System:** Use CSS variables for a dark-mode optimized, glassmorphic design system with modern typography and micro-animations.

## 3. Cryptography & Tooling
- End-to-End Encryption (E2E) workflows use `X25519` and `AES-256-GCM` via the standard Web Crypto API.
- Every cryptography workflow must be reproducible and testable via easy-to-use CLI scripts (e.g., in `scripts/`).

## 4. Testing Requirements
- **Vitest** is the designated testing framework to support both Node.js business logic and UI component (DOM) testing.
- Every component and module must be fully unit tested.
- **Strict Separation:** Unit tests for business logic (e.g., AT Protocol integration, cryptography) must be kept entirely separate from UI component tests.

## 5. Protocol Constraints
- The app integrates directly with the **AT Protocol**.
- **Data Minimization**: Keep unencrypted data stored on the PDS minimal. Only fields necessary for the feed (time, distance, polyline, sport type, upload date) should be stored unencrypted in the record to respect privacy and size limits. Detailed or sensitive data (like calories and max speed) must be kept in the encrypted blob.
- Large payloads (like `.tcx` files) are always uploaded as AT Protocol Blobs and referenced via CID.
