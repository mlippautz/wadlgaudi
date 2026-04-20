import { parseTcx } from '../lib/activity-parser';
import { generateAESKey, encryptSymmetric, decryptSymmetric } from '../lib/crypto';
import { saveActivity } from '../lib/storage';
import type { AtpClient } from '../lib/atp-client';

export class WUpload extends HTMLElement {
    public atpClient?: AtpClient;
    public friendsList: { did: string, handle: string }[] = [];
    private selectedFriends: Set<string> = new Set();
    private file: File | null = null;

    connectedCallback() {
        this.render();
        this.setupDragAndDrop();
        this.setupFriendsSelect();

        this.querySelector('#cancel-btn')?.addEventListener('click', () => {
            window.location.hash = '#/feed';
        });

        this.querySelector('#submit-btn')?.addEventListener('click', this.handleSubmit.bind(this));
    }

    setupDragAndDrop() {
        const dropzone = this.querySelector('.dropzone') as HTMLElement;
        const fileInput = this.querySelector('#file-input') as HTMLInputElement;

        dropzone.addEventListener('click', () => fileInput.click());

        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.style.borderColor = 'var(--primary-hover)';
            dropzone.style.background = 'rgba(139, 92, 246, 0.1)';
        });

        dropzone.addEventListener('dragleave', () => {
            dropzone.style.borderColor = 'var(--surface-border)';
            dropzone.style.background = 'transparent';
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            if (e.dataTransfer?.files.length) {
                this.file = e.dataTransfer.files[0];
                this.updateDropzoneUI();
            }
        });

        fileInput.addEventListener('change', () => {
            if (fileInput.files?.length) {
                this.file = fileInput.files[0];
                this.updateDropzoneUI();
            }
        });
    }

    updateDropzoneUI() {
        const dropzone = this.querySelector('.dropzone') as HTMLElement;
        if (this.file) {
            dropzone.innerHTML = `<p style="color: var(--secondary-color)">✅ ${this.file.name} selected.</p>`;
            dropzone.style.borderColor = 'var(--secondary-color)';
        }
    }

    setupFriendsSelect() {
        const listContainer = this.querySelector('.friends-list') as HTMLElement;
        listContainer.innerHTML = '';

        this.friendsList.forEach(friend => {
            const div = document.createElement('div');
            div.className = 'friend-item glass-panel';
            div.style.padding = '0.75rem';
            div.style.marginBottom = '0.5rem';
            div.style.cursor = 'pointer';
            div.style.display = 'flex';
            div.style.justifyContent = 'space-between';
            div.innerHTML = `<span>@${friend.handle}</span> <span class="check"></span>`;

            div.addEventListener('click', () => {
                if (this.selectedFriends.has(friend.did)) {
                    this.selectedFriends.delete(friend.did);
                    div.style.borderColor = 'var(--surface-border)';
                    (div.querySelector('.check') as HTMLElement).innerText = '';
                } else {
                    this.selectedFriends.add(friend.did);
                    div.style.borderColor = 'var(--primary-color)';
                    (div.querySelector('.check') as HTMLElement).innerText = '✅';
                }
            });

            listContainer.appendChild(div);
        });
    }

    async handleSubmit() {
        if (!this.file) {
            alert('Please select a TCX file first.');
            return;
        }
        
        const btn = this.querySelector('#submit-btn') as HTMLButtonElement;
        const statusMsg = document.createElement('div');
        statusMsg.style.marginTop = '1rem';
        statusMsg.style.fontSize = '0.9rem';
        statusMsg.style.color = 'var(--text-main)';
        btn.parentElement?.parentElement?.appendChild(statusMsg);

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
            
            let atpRecordKey: string | undefined = undefined;

            // Get or Prompt for Recovery Phrase (for E2EE Backup)
            let phrase = localStorage.getItem('wadlgaudi_phrase');
            if (!phrase) {
                phrase = prompt('Enter your 12-word recovery phrase for E2EE backup (or leave empty to skip sync-ability):');
                if (phrase) localStorage.setItem('wadlgaudi_phrase', phrase);
            }

            let encryptedSummary = "{}";
            if (phrase) {
                const { deriveMasterKey, exportKeyToBase64 } = await import('../lib/crypto');
                const masterKey = await deriveMasterKey(phrase);
                const activityKeyBase64 = await exportKeyToBase64(key);
                const summaryObj = {
                    polyline: summary.polyline,
                    activityKey: activityKeyBase64
                };
                const summaryBytes = new TextEncoder().encode(JSON.stringify(summaryObj));
                const encryptedSummaryBytes = await encryptSymmetric(masterKey, summaryBytes);
                encryptedSummary = btoa(String.fromCharCode(...encryptedSummaryBytes));
                statusMsg.innerHTML += 'E2EE Summary & Key backup prepared.<br>';
            }

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
                        accessList: {}, // Empty map for now
                        encryptedSummary: encryptedSummary,
                        sportType: summary.sportType,
                        distance: Math.round(summary.distance),
                        duration: Math.round(summary.duration),
                        calories: summary.calories ? Math.round(summary.calories) : undefined,
                        maxSpeed: summary.maxSpeed ? Math.round(summary.maxSpeed) : 0,
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

            // Export key to store locally
            const { exportKeyToBase64 } = await import('../lib/crypto');
            const keyBase64 = await exportKeyToBase64(key);

            // Save to local storage (including the blob)
            await saveActivity(summary, atpRecordKey, keyBase64, encryptedPackage);
            statusMsg.innerHTML += 'Activity saved to local storage (including full blob).<br>';

            btn.innerText = 'Success!';
            
            setTimeout(() => {
                alert(`Successfully verified crypto workflow! Shared with ${this.selectedFriends.size} friends (Simulated).`);
                window.location.hash = '#/feed';
            }, 3000);
            
        } catch (err) {
            console.error(err);
            statusMsg.innerHTML += `<span style="color: #ef4444">❌ Error: ${(err as Error).message}</span><br>`;
            btn.innerText = 'Publish to Bluesky';
            btn.disabled = false;
        }
    }

    render() {
        this.innerHTML = `
            <style>
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
            </style>
            <div class="glass-panel upload-container" style="padding: 2rem">
                <h3>Upload Activity</h3>
                
                <div class="dropzone">
                    <p>Drag and drop your .tcx file here, or click to browse.</p>
                </div>
                <input type="file" id="file-input" accept=".tcx" style="display:none" />

                <div class="section">
                    <h4>Share with Friends (E2E Encrypted)</h4>
                    <p style="font-size:0.85rem; color: var(--text-muted); margin-bottom:1rem;">Select who gets the decryption key.</p>
                    <div class="friends-list"></div>
                </div>

                <div class="actions">
                    <button id="cancel-btn">Cancel</button>
                    <button id="submit-btn">Publish to Bluesky</button>
                </div>
            </div>
        `;
    }
}

customElements.define('w-upload', WUpload);
