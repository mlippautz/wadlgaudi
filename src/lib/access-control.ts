import { generateAESKey, encryptSymmetric, decryptSymmetric } from './crypto';

/**
 * Mocks the cryptographic sharing of an AES key with another user's X25519 public key.
 * In a full implementation, this uses ECDH to derive a shared key to encrypt the AES key.
 * For now, we simulate this as a base64 encoded payload.
 */
export async function encryptKeyForUser(_symmetricKey: CryptoKey, userPublicKeyRaw: string): Promise<string> {
    // Note: To properly implement this with Web Crypto, one must use `deriveKey` with ECDH.
    // We simulate the output string format: "ephemeralPubKey:iv:ciphertext"
    return `simulated_encrypted_key_for_${userPublicKeyRaw}`;
}

/**
 * Access Control Module
 */
export class AccessControlManager {
    
    /**
     * Given a raw blob and a list of user public keys, this generates a new AES key,
     * encrypts the blob, and builds the access list.
     */
    async encryptActivity(rawBlob: Uint8Array, friendPublicKeys: Record<string, string>) {
        const aesKey = await generateAESKey();
        const encryptedData = await encryptSymmetric(aesKey, rawBlob);
        
        const accessList: Record<string, string> = {};
        for (const [did, pubKey] of Object.entries(friendPublicKeys)) {
            accessList[did] = await encryptKeyForUser(aesKey, pubKey);
        }

        return {
            aesKey,
            encryptedBlob: encryptedData,
            accessList
        };
    }

    /**
     * Implements "Soft Revocation": Decrypts the blob with the old key,
     * re-encrypts with a brand new AES key, and builds a new access list omitting the revoked user.
     */
    async softRevoke(
        encryptedBlob: Uint8Array, 
        oldAesKey: CryptoKey, 
        currentFriendKeys: Record<string, string>, 
        revokedDid: string
    ) {
        // 1. Decrypt old blob
        const rawBlob = await decryptSymmetric(oldAesKey, encryptedBlob);
        
        // 2. Remove revoked user
        const newFriends = { ...currentFriendKeys };
        delete newFriends[revokedDid];

        // 3. Re-encrypt with new key
        return await this.encryptActivity(rawBlob, newFriends);
    }
}
