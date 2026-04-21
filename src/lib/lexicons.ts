/**
 * Wadlgaudi Custom Lexicons
 * 
 * These interfaces map exactly to the data structures we store
 * on the AT Protocol PDS.
 */

export interface WadlgaudiCrypto {
    $type: 'app.wadlgaudi.crypto';
    
    // The user's X25519 public key (Base64 or hex encoded)
    publicKey: string;
    
    createdAt: string;
}

/**
 * Wadlgaudi Activity Record
 * 
 * RULE: Keep unencrypted data stored on PDS minimal.
 * Only fields necessary for the feed (time, distance, polyline, sport type, upload date)
 * should be stored unencrypted. Detailed or sensitive data must be kept in the encrypted blob.
 */
export interface WadlgaudiActivity {
    $type: 'app.wadlgaudi.activity';
    createdAt: string;
    
    // Optional public metadata
    sportType?: string;
    distance?: number;
    duration?: number;

    polyline?: string;

    // AT Protocol Blob reference for the raw encrypted .tcx
    activityBlob: any; 
    
    // Base64 encoded activity key encrypted with master key
    encryptedActivityKey: string;
}
