# Wadlgaudi Activity Tracker Design

Wadlgaudi is an activity tracker fully decentralized and hosted on the **AT Protocol** (the underlying protocol of Bluesky). It utilizes End-to-End Encryption (E2E) to keep sensitive activity data (e.g., GPS paths, heart rate) private while allowing users to share activities with selected friends.

## Platform Architecture

The application interacts directly with the user's Personal Data Server (PDS) on the AT Protocol.
To support Wadlgaudi's functionality, we define custom **Lexicons** (data schemas) within the `app.wadlgaudi.*` namespace.

### Cryptography & Key Management

1. **E2E Encryption Keys**: Each user generates an `X25519` (Curve25519) keypair specifically for E2E encryption. This is completely separate from their AT Protocol signing keys. 
2. **Key Backup & Sync**: Because E2E private keys generated in the browser are easily lost (e.g., clearing site data), the application generates a **12-word recovery phrase (BIP39)**. Users must back this up. Entering this phrase on a new device seamlessly restores their private key, ensuring they never lose access to their history.
3. **Public Key Discovery**: The user's public encryption key is published to their PDS as a custom Lexicon record (e.g., `app.wadlgaudi.profile` or `app.wadlgaudi.crypto`). This allows other users to easily resolve their DID and fetch the key to share activities with them.
4. **Symmetric Encryption**: Activities are encrypted using a strong symmetric encryption algorithm natively supported by web browsers, such as **`AES-256-GCM`**.

### Activity Schema & Storage

Due to the size limits of AT Protocol records (typically around ~8KB), large data payloads and dynamically growing lists are stored as **Blobs** (up to 50MB), while lightweight metadata is stored as a standard **Record**.

An activity consists of three parts:

#### 1. Activity Record (`app.wadlgaudi.activity`)
This is the main entry stored in the user's AT Protocol repository. It separates data into public metrics and encrypted fields for performance and privacy.
- **Optional Public Metadata**: Fields like `createdAt`, `sportType`, `distance`, and `duration` can optionally be stored unencrypted. This "Public Stats, Private Route" approach allows activities to surface in custom public Bluesky feeds while keeping the actual map/location private.
- **Encrypted Summary**: To ensure the app feed loads instantly without downloading massive files, a lightweight JSON summary (containing stats and perhaps a downsampled map polyline) is encrypted with the activity's symmetric key and stored directly as a string in this Record.
- **Activity Blob CID**: A reference to the encrypted raw data blob.
- **Access List**: A JSON map mapping user DIDs to their encrypted symmetric key. Storing this directly in the Record allows lightning-fast decryption and easy in-place updates when adding or removing friends.
- **Access Blob CID (Optional Fallback)**: If the Access List grows too large and approaches the ~8KB Record limit, this field acts as a fallback, pointing to a Blob containing the expanded list.

#### 2. Activity Blob
- Contains the actual raw activity data (e.g., a `.tcx` file).
- The payload is symmetrically encrypted using a randomly generated **`AES-256-GCM`** key (created per-activity).
- Stored as a blob in the AT Protocol.

#### 3. Access List & Fallback Blob
- The Access List is a JSON-encoded map mapping user identifiers (e.g., AT Protocol DIDs) to the symmetric key.
- The symmetric key is asymmetrically encrypted using each recipient's public `X25519` key (along with the owner's public key so they can decrypt their own activity).
- Storing this directly in the `app.wadlgaudi.activity` Record allows easy, in-place updates to add or remove users without needing to re-upload immutable Blobs.
- **Blob Fallback**: If an activity is shared with hundreds of users and the Access List exceeds the AT Protocol's ~8KB Record limit, the system gracefully "spills over" by uploading the JSON list as a **Blob** (which supports up to 50MB) and referencing it via the optional `Access Blob CID`. Updating this fallback Blob requires uploading a new Blob to replace it, trading off some in-place update convenience for unlimited sharing capacity.
- **Revocation Reality & Soft Revocation**: Because AT Protocol is decentralized, any user who already downloaded the encrypted `.tcx` and the symmetric key retains access to that specific file locally. True retroactive revocation is impossible. However, the app supports **"Soft Revocation"**: to revoke access, the client decrypts the original activity, re-encrypts it with a *brand new* symmetric key, uploads it as a new Blob, and updates the Activity Record to point to this new Blob alongside an updated Access List (which omits the revoked user). The old blob can then be deleted from the user's PDS, preventing future downloads.

## Social Features & Sharing

Wadlgaudi operates as a web application with a dedicated "feed" panel. In this panel, users can seamlessly view activities from the people they follow, provided they have been granted access via the Access List. Because of the Encrypted Summary in the Activity Record, the feed loads extremely fast without needing to fetch the heavy Activity Blobs.

Optionally, when creating an activity, a user can cross-post by generating a standard Bluesky post (`app.bsky.feed.post`) that links back to the custom activity record, boosting visibility on the broader network.