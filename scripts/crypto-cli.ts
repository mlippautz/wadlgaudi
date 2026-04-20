import { generateAESKey, encryptSymmetric, decryptSymmetric, generateRecoveryPhrase, deriveSeedFromPhrase, generateX25519KeyPair } from '../src/lib/crypto.js';

async function main() {
    console.log("=== Wadlgaudi Crypto Testing CLI ===\n");

    try {
        // 1. Test BIP39 Phrase
        console.log("1. Generating 12-word recovery phrase...");
        const phrase = generateRecoveryPhrase();
        console.log(`   Phrase: ${phrase}`);
        
        const seed = await deriveSeedFromPhrase(phrase);
        console.log(`   Seed (hex): ${Buffer.from(seed).toString('hex').substring(0, 32)}...`);

        // 2. Test X25519
        console.log("\n2. Generating X25519 KeyPair...");
        const keyPair = await generateX25519KeyPair();
        console.log("   Keypair generated successfully.");

        // 3. Test AES-GCM
        console.log("\n3. Testing AES-256-GCM Symmetric Encryption...");
        const aesKey = await generateAESKey();
        const plaintext = new TextEncoder().encode("Hello from Wadlgaudi Activity Tracker");
        
        const encryptedPayload = await encryptSymmetric(aesKey, plaintext);
        console.log(`   Encrypted bytes: ${encryptedPayload.length}`);
        
        const decrypted = await decryptSymmetric(aesKey, encryptedPayload);
        const decryptedText = new TextDecoder().decode(decrypted);
        console.log(`   Decrypted text: "${decryptedText}"`);

        console.log("\nAll crypto workflows executed successfully!");
    } catch (e) {
        console.error("Crypto workflow failed:", e);
    }
}

main();
