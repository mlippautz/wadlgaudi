import { LitElement, html, css } from 'lit';
import { sharedStyles } from '../styles/shared-styles';
import { parseTcx } from '../lib/activity-parser';
import { generateAESKey, encryptSymmetric, decryptSymmetric, deriveMasterKey } from '../lib/crypto';
import { saveActivity, getPassphrase } from '../lib/storage';
import type { AtpClient } from '../lib/atp-client';

export class WGUpload extends LitElement {
    static properties = {
        atpClient: { type: Object },
        file: { type: Object },
    };

    declare atpClient?: AtpClient;
    private declare file: File | null;

    constructor() {
        super();
        this.file = null;
    }

    static styles = [
        sharedStyles,
        css`
            .upload-container {
                animation: fadeIn 0.3s ease;
            }
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            h3 { margin-bottom: 1rem; color: var(--primary-hover); }
            
            .dropzone {
                border: 2px dashed var(--surface-border);
                border-radius: var(--border-radius-md);
                padding: 3rem 2rem;
                text-align: center;
                cursor: pointer;
                transition: all 0.3s ease;
                margin-bottom: 2rem;
            }
            .dropzone p { color: var(--text-muted); }
            
            .section {
                margin-bottom: 2rem;
            }
            
            .actions {
                display: flex;
                gap: 1rem;
                justify-content: flex-end;
            }
            .friend-item {
                padding: 0.75rem;
                margin-bottom: 0.5rem;
                cursor: pointer;
                display: flex;
                justify-content: space-between;
                border: 1px solid var(--surface-border);
                border-radius: var(--border-radius-sm);
            }
            .friend-item.selected {
                border-color: var(--primary-color);
            }
        `
    ];

    render() {
        return html`
            <div class="glass-panel upload-container" style="padding: 2rem">
                <h3>Upload Activity</h3>
                
                <div class="dropzone" 
                     @click="${this.onDropzoneClick}"
                     @dragover="${this.onDragOver}"
                     @dragleave="${this.onDragLeave}"
                     @drop="${this.onDrop}"
                     style="${this.file ? 'border-color: var(--secondary-color);' : ''}">
                    ${this.file 
                        ? html`<p style="color: var(--secondary-color)">✅ ${this.file.name} selected.</p>`
                        : html`<p>Drag and drop your .tcx file here, or click to browse.</p>`
                    }
                </div>
                <input type="file" id="file-input" accept=".tcx" style="display:none" @change="${this.onFileChange}" />



                <div class="actions">
                    <button id="cancel-btn" @click="${() => window.location.hash = '#/feed'}">Cancel</button>
                    <button id="submit-btn" @click="${this.handleSubmit}">Publish to Bluesky</button>
                </div>
                <div id="status-msg" style="margin-top: 1rem; font-size: 0.9rem; color: var(--text-main);"></div>
            </div>
        `;
    }

    onDropzoneClick() {
        (this.renderRoot.querySelector('#file-input') as HTMLInputElement)?.click();
    }

    onDragOver(e: DragEvent) {
        e.preventDefault();
        const dropzone = this.renderRoot.querySelector('.dropzone') as HTMLElement;
        dropzone.style.borderColor = 'var(--primary-hover)';
        dropzone.style.background = 'rgba(139, 92, 246, 0.1)';
    }

    onDragLeave() {
        const dropzone = this.renderRoot.querySelector('.dropzone') as HTMLElement;
        dropzone.style.borderColor = this.file ? 'var(--secondary-color)' : 'var(--surface-border)';
        dropzone.style.background = 'transparent';
    }

    onDrop(e: DragEvent) {
        e.preventDefault();
        if (e.dataTransfer?.files.length) {
            this.file = e.dataTransfer.files[0];
            this.requestUpdate();
        }
    }

    onFileChange(e: Event) {
        const fileInput = e.target as HTMLInputElement;
        if (fileInput.files?.length) {
            this.file = fileInput.files[0];
            this.requestUpdate();
        }
    }



    async handleSubmit() {
        if (!this.file) {
            alert('Please select a TCX file first.');
            return;
        }
        
        const btn = this.renderRoot.querySelector('#submit-btn') as HTMLButtonElement;
        const statusMsg = this.renderRoot.querySelector('#status-msg') as HTMLElement;

        btn.innerText = 'Processing...';
        btn.disabled = true;

        try {
            statusMsg.innerHTML = 'Reading file...<br>';
            const tcxString = await this.file.text();
            
            statusMsg.innerHTML += 'Parsing TCX...<br>';
            const summary = parseTcx(tcxString);
            
            statusMsg.innerHTML += `Parsed: ${summary.sportType}, Distance: ${(summary.distance / 1000).toFixed(2)}km<br>`;
            statusMsg.innerHTML += 'Generating AES-256-GCM key...<br>';
            const key = await generateAESKey();
            
            statusMsg.innerHTML += 'Encrypting payload...<br>';
            const dataBytes = new TextEncoder().encode(tcxString);
            const encryptedPackage = await encryptSymmetric(key, dataBytes);
            
            statusMsg.innerHTML += `Encrypted ${dataBytes.length} bytes into ${encryptedPackage.length} bytes (including IV).<br>`;
            statusMsg.innerHTML += 'Verifying decryption as owner...<br>';
            
            const decryptedBytes = await decryptSymmetric(key, encryptedPackage);
            const decryptedString = new TextDecoder().decode(decryptedBytes);
            
            if (decryptedString.length !== tcxString.length) {
                throw new Error("Decryption verification failed: length mismatch");
            }
            
            statusMsg.innerHTML += '<span style="color: var(--secondary-color)">✅ Local encryption & decryption verified successfully!</span><br>';
            
            // Derive master key and encrypt activity key
            const passphrase = getPassphrase();
            if (!passphrase) {
                throw new Error("Passphrase not found in settings. Please set it first.");
            }
            statusMsg.innerHTML += 'Deriving master key...<br>';
            const masterKey = await deriveMasterKey(passphrase);
            
            statusMsg.innerHTML += 'Encrypting activity key with master key...<br>';
            const rawActivityKey = await crypto.subtle.exportKey('raw', key);
            const encryptedActivityKeyBytes = await encryptSymmetric(masterKey, new Uint8Array(rawActivityKey));
            const encryptedActivityKeyBase64 = btoa(String.fromCharCode(...encryptedActivityKeyBytes));

            let atpRecordKey: string | undefined = undefined;

            // If we have an ATP Client and are authenticated, upload to the AT Protocol
            if (this.atpClient?.agent && this.atpClient.sessionDid) {
                try {
                    statusMsg.innerHTML += 'Uploading encrypted blob to AT Protocol...<br>';
                    const blob = await this.atpClient.uploadActivityBlob(encryptedPackage);
                    statusMsg.innerHTML += `Blob uploaded: ${blob.ref.toString().substring(0, 20)}...<br>`;

                    statusMsg.innerHTML += 'Publishing activity record...<br>';
                    const rkey = Date.now().toString(32); // Simple unique rkey
                    await this.atpClient.publishActivityRecord(rkey, {
                        activityBlob: blob,
                        encryptedActivityKey: encryptedActivityKeyBase64,
                        sportType: summary.sportType,
                        distance: Math.round(summary.distance),
                        duration: Math.round(summary.duration),
                        polyline: summary.polyline,
                        createdAt: new Date().toISOString()
                    });
                    atpRecordKey = rkey;
                    statusMsg.innerHTML += '<span style="color: var(--secondary-color)">✅ Published to AT Protocol!</span><br>';
                } catch (atpErr) {
                    console.error('AT Protocol upload failed', atpErr);
                    statusMsg.innerHTML += `<span style="color: #f59e0b">⚠️ AT Protocol upload failed, but saving locally: ${(atpErr as Error).message}</span><br>`;
                }
            }

            // Save to local storage (including the blob)
            // We store the encrypted activity key instead of the raw one
            await saveActivity(summary, atpRecordKey, encryptedActivityKeyBase64, encryptedPackage);
            statusMsg.innerHTML += 'Activity saved to local storage (including full blob).<br>';

            btn.innerText = 'Success!';
            
            setTimeout(() => {
                alert(`Successfully verified crypto workflow!`);
                window.location.hash = '#/feed';
            }, 3000);
            
        } catch (err) {
            console.error(err);
            statusMsg.innerHTML += `<span style="color: #ef4444">❌ Error: ${(err as Error).message}</span><br>`;
            btn.innerText = 'Publish to Bluesky';
            btn.disabled = false;
        }
    }
}

customElements.define('wg-upload', WGUpload);
