import { describe, it, expect } from 'vitest';
import { generateAESKey, encryptSymmetric, decryptSymmetric, generateRecoveryPhrase, deriveSeedFromPhrase, generateX25519KeyPair } from '../src/lib/crypto';

describe('Cryptography Module', () => {
    it('should generate a valid 12-word BIP39 phrase', () => {
        const phrase = generateRecoveryPhrase();
        const words = phrase.split(' ');
        expect(words.length).toBe(12);
    });

    it('should derive consistent seed from phrase', async () => {
        const phrase = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
        const seed1 = await deriveSeedFromPhrase(phrase);
        const seed2 = await deriveSeedFromPhrase(phrase);
        expect(seed1).toEqual(seed2);
    });

    it('should generate an X25519 keypair', async () => {
        const keyPair = await generateX25519KeyPair();
        expect(keyPair.publicKey).toBeDefined();
        expect(keyPair.privateKey).toBeDefined();
        expect(keyPair.publicKey.algorithm.name).toBe('X25519');
    });

    it('should encrypt and decrypt payload symmetrically using AES-GCM', async () => {
        const key = await generateAESKey();
        const plaintext = new TextEncoder().encode('Test Data 123');
        
        const encrypted = await encryptSymmetric(key, plaintext);
        expect(encrypted).not.toEqual(plaintext);
        
        const decrypted = await decryptSymmetric(key, encrypted);
        expect(Array.from(decrypted)).toEqual(Array.from(plaintext));
    });
});
