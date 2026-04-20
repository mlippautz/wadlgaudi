# Wadlgaudi Roadmap: Remaining Tasks 🏎️💨🌑

This document tracks the remaining features and technical hurdles to make Wadlgaudi a fully functional, decentralized, and E2EE activity tracker.

## 1. Identity & Key Management 🔐
- [ ] **Recovery Phrase Generation:** Implement the 12-word BIP39 mnemonic setup flow.
- [ ] **Crypto Identity Record:** Implement `app.wadlgaudi.crypto` record to store the user's X25519 public key on their PDS.
- [ ] **Identity Persistence:** Implement "Self-Sharing" (encrypting the activity key for the owner) to ensure data can be recovered after clearing `localStorage`.
- [ ] **Secure Key Storage:** Use browser `SubtleCrypto` to store the private key in a non-exportable way if possible, or require a passcode to unlock.

## 2. Social Discovery & Networking 🌐
- [ ] **Follower Discovery:** Fetch the user's Bluesky followers/following list to populate the "Share" menu.
- [ ] **Global Discovery:** Create a "Global Feed" to see public activity summaries from the network.
- [ ] **User Search:** Add ability to find other Wadlgaudi users by their handle.

## 3. Advanced E2EE Sharing 🤝
- [ ] **Key Exchange Logic:** Automatically fetch a friend's public key from their `app.wadlgaudi.crypto` record when they are selected in the upload view.
- [ ] **Access List Automation:** Automatically encrypt the activity's symmetric key for all selected friends and populate the `accessList`.
- [ ] **Social Decryption:** Implement the logic for a "Friend" to decrypt a shared activity using their own private key.

## 4. UI / UX Enhancements ✨
- [ ] **Activity Map:** Render a static or interactive map using the decoded `polyline` on the feed cards and detail view.
- [ ] **Elevation Profile:** Parse and display elevation data from the TCX blob.
- [ ] **Activity Charts:** Add charts for speed, heart rate, and cadence over time.
- [ ] **Profile Page:** Create a user profile view showing their total stats and public activity history.

## 5. Reliability & Performance 🛠️
- [ ] **Background Sync:** Implement a Service Worker to handle uploads in the background if the user closes the tab.
- [ ] **Partial Sync:** Optimize the sync engine to only fetch new records since the last sync time.
- [ ] **Large Blob Handling:** Implement the `accessBlobFallback` logic for activities shared with >50 people (to stay under the 8KB record limit).

---
*Last Updated: 2026-04-19*
