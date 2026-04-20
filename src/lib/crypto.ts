import * as bip39 from 'bip39';

/**
 * Ensures the Web Crypto API is available.
 */
const getCrypto = () => {
    if (typeof globalThis.crypto !== 'undefined') return globalThis.crypto;
    throw new Error('Web Crypto API is not available in this environment.');
};

/**
 * Generates a random AES-256-GCM key for symmetric encryption.
 */
export async function generateAESKey(): Promise<CryptoKey> {
    const crypto = getCrypto();
    return crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );
}

/**
 * Exports a CryptoKey to a Base64 string.
 */
export async function exportKeyToBase64(key: CryptoKey): Promise<string> {
    const exported = await crypto.subtle.exportKey('raw', key);
    return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

/**
 * Imports a CryptoKey from a Base64 string.
 */
export async function importKeyFromBase64(base64: string): Promise<CryptoKey> {
    const raw = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    return crypto.subtle.importKey(
        'raw',
        raw,
        { name: 'AES-GCM' },
        true,
        ['encrypt', 'decrypt']
    );
}

/**
 * Encrypts an array of bytes using AES-256-GCM and prepends the 12-byte IV.
 */
export async function encryptSymmetric(key: CryptoKey, data: Uint8Array): Promise<Uint8Array> {
    const crypto = getCrypto();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        data as BufferSource
    );
    
    // Package IV + ciphertext
    const result = new Uint8Array(iv.length + encrypted.byteLength);
    result.set(iv, 0);
    result.set(new Uint8Array(encrypted), iv.length);
    return result;
}

/**
 * Decrypts an AES-256-GCM encrypted payload (expects 12-byte IV at the start).
 */
export async function decryptSymmetric(key: CryptoKey, packagedData: Uint8Array): Promise<Uint8Array> {
    const crypto = getCrypto();
    const iv = packagedData.slice(0, 12);
    const ciphertext = packagedData.slice(12);
    
    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv as BufferSource },
        key,
        ciphertext as BufferSource
    );
    return new Uint8Array(decrypted);
}

/**
 * Generates a standard BIP39 12-word recovery phrase.
 */
export function generateRecoveryPhrase(): string {
    return bip39.generateMnemonic();
}

/**
 * Derives a raw seed from the BIP39 phrase.
 */
export async function deriveSeedFromPhrase(phrase: string): Promise<Uint8Array> {
    return new Uint8Array(await bip39.mnemonicToSeed(phrase));
}

/**
 * Generates an X25519 KeyPair using the native Web Crypto API.
 */
export async function generateX25519KeyPair(): Promise<CryptoKeyPair> {
    const crypto = getCrypto();
    return crypto.subtle.generateKey(
        { name: 'X25519' },
        true,
        ['deriveKey', 'deriveBits']
    ) as Promise<CryptoKeyPair>;
}
