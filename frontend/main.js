import { createWalletClient, createPublicClient, custom, http } from 'viem';
import { hardhat } from 'viem/chains';
import abiData from './PatientRegistry.json';

// ================================================================
// CUSTOM TOAST NOTIFICATION (replaces alert)
// ================================================================
function showToast(message, type = 'info', detail = '') {
    // Remove existing toasts
    document.querySelectorAll('.ehr-toast').forEach(t => t.remove());

    const icons = {
        success: `<svg viewBox="0 0 24 24" fill="none" width="22" height="22"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M8 12l3 3 5-5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
        error:   `<svg viewBox="0 0 24 24" fill="none" width="22" height="22"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>`,
        info:    `<svg viewBox="0 0 24 24" fill="none" width="22" height="22"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 8v4M12 16v.01" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>`,
    };
    const colors = {
        success: { bg: '#f0faf7', border: '#0a6e5e', icon: '#0a6e5e', text: '#0a4a3a' },
        error:   { bg: '#fff5f5', border: '#dc2626', icon: '#dc2626', text: '#7f1d1d' },
        info:    { bg: '#f0f9ff', border: '#1a7fa8', icon: '#1a7fa8', text: '#0c4a6e' },
    };
    const c = colors[type] || colors.info;

    const toast = document.createElement('div');
    toast.className = 'ehr-toast';
    toast.style.cssText = `
        position: fixed; top: 24px; right: 24px; z-index: 99999;
        background: ${c.bg}; border: 1.5px solid ${c.border};
        border-radius: 14px; padding: 1rem 1.2rem;
        box-shadow: 0 8px 32px rgba(0,0,0,0.12);
        display: flex; align-items: flex-start; gap: 0.75rem;
        max-width: 380px; min-width: 260px;
        font-family: 'Be Vietnam Pro', sans-serif;
        animation: toastIn 0.3s cubic-bezier(0.34,1.56,0.64,1);
    `;
    toast.innerHTML = `
        <span style="color:${c.icon}; flex-shrink:0; margin-top:1px;">${icons[type]}</span>
        <div style="flex:1; min-width:0;">
            <div style="font-weight:700; font-size:0.92rem; color:${c.text}; line-height:1.3;">${message}</div>
            ${detail ? `<div style="font-size:0.78rem; color:#888; margin-top:3px; word-break:break-all; line-height:1.4;">${detail}</div>` : ''}
        </div>
        <button onclick="this.parentElement.remove()" style="
            background:none; border:none; cursor:pointer; color:#aaa;
            font-size:18px; line-height:1; padding:0; flex-shrink:0; margin-top:-2px;
            font-weight:300;
        ">×</button>
    `;

    // Add keyframe if not exists
    if (!document.getElementById('toast-style')) {
        const style = document.createElement('style');
        style.id = 'toast-style';
        style.textContent = `
            @keyframes toastIn {
                from { opacity:0; transform: translateX(40px) scale(0.95); }
                to   { opacity:1; transform: translateX(0) scale(1); }
            }
            @keyframes toastOut {
                from { opacity:1; transform: translateX(0) scale(1); }
                to   { opacity:0; transform: translateX(40px) scale(0.95); }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(toast);

    // Auto dismiss
    const duration = type === 'info' ? 2000 : 4000;
    setTimeout(() => {
        toast.style.animation = 'toastOut 0.25s ease forwards';
        setTimeout(() => toast.remove(), 250);
    }, duration);
}


const PINATA_JWT      = import.meta.env.VITE_PINATA_JWT;
const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS;
const abi             = abiData.abi;

const publicClient = createPublicClient({ chain: hardhat, transport: http() });
const walletClient = createWalletClient({ chain: hardhat, transport: custom(window.ethereum) });

let userAccount = '';
let myRecords   = []; // cache danh sách record

// ================================================================
// ENCRYPT / DECRYPT
// ================================================================
async function deriveKey(wallet) {
    const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(wallet.toLowerCase()), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: new TextEncoder().encode('patientehr-v1-salt'), iterations: 100000, hash: 'SHA-256' },
        km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
    );
}
async function encryptFile(file, wallet) {
    const key = await deriveKey(wallet);
    const iv  = crypto.getRandomValues(new Uint8Array(12));
    const enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, await file.arrayBuffer());

    // Store filename as UTF-8 with 2-byte length prefix (supports up to 65535 chars)
    const nameBytes = new TextEncoder().encode(file.name);
    const nameLen   = new Uint8Array(2);
    nameLen[0] = (nameBytes.length >> 8) & 0xff;
    nameLen[1] = nameBytes.length & 0xff;

    // Format: [12 iv] [2 nameLen] [nameBytes] [encryptedData]
    const out = new Uint8Array(12 + 2 + nameBytes.length + enc.byteLength);
    out.set(iv, 0);
    out.set(nameLen, 12);
    out.set(nameBytes, 14);
    out.set(new Uint8Array(enc), 14 + nameBytes.length);
    return new Blob([out], { type: 'application/octet-stream' });
}

async function decryptAndOpen(ipfsHash, wallet) {
    const res = await fetch(`https://gateway.pinata.cloud/ipfs/${ipfsHash}`);
    if (!res.ok) throw new Error('Cannot fetch file from IPFS');
    const key = await deriveKey(wallet);
    const buf = await (await res.blob()).arrayBuffer();

    const iv      = new Uint8Array(buf.slice(0, 12));
    const lenView = new Uint8Array(buf.slice(12, 14));
    const nameLen = (lenView[0] << 8) | lenView[1];

    // Handle both new format (with length prefix) and old format (64-byte fixed)
    let nm, dataStart;
    if (nameLen > 0 && nameLen < 500) {
        // New format
        nm        = new TextDecoder().decode(buf.slice(14, 14 + nameLen));
        dataStart = 14 + nameLen;
    } else {
        // Old format fallback (64-byte fixed name)
        nm        = new TextDecoder().decode(buf.slice(12, 76)).replace(/\0+$/, '');
        dataStart = 76;
    }

    const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, buf.slice(dataStart));
    const ext  = nm.split('.').pop().toLowerCase();
    const mime = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' }[ext] || 'application/octet-stream';
    const url  = URL.createObjectURL(new Blob([dec], { type: mime }));
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
}
async function hashPassword(pw) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function uploadToPinata(file) {
    const fd = new FormData(); fd.append('file', file);
    const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST', headers: { 'Authorization': `Bearer ${PINATA_JWT}` }, body: fd
    });
    if (!res.ok) throw new Error('Pinata upload failed');
    return (await res.json()).IpfsHash;
}

// ================================================================
// NAVIGATION
// ================================================================
function resetAddRecordForm() {
    const fields = ['addTitle', 'addExamDate', 'addDoctor', 'addCustomType'];
    fields.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const type = document.getElementById('addRecordType');
    if (type) type.selectedIndex = 0;
    const customInput = document.getElementById('addCustomType');
    if (customInput) customInput.style.display = 'none';
    const area = document.getElementById('addFileArea');
    if (area && area._reset) area._reset();
}

function showSection(id) {
    if (id === 'addRecordPage') resetAddRecordForm();
    document.querySelectorAll('.main-content').forEach(s => s.style.display = 'none');
    document.getElementById(id).style.display = 'flex';
    document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
    const map = { landingPage: 'menuHome', registerPage: 'menuRegister', loginPage: 'menuLogin', dashboard: 'menuDashboard' };
    if (map[id]) document.getElementById(map[id]).classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ================================================================
// RENDER RECORDS
// ================================================================
const TYPE_LABELS = {
    LabTest: 'Lab Test', Diagnosis: 'Diagnosis',
    Prescription: 'Prescription', Admission: 'Admission', Other: 'Other'
};

function renderRecords(records) {
    const container = document.getElementById('recordsList');
    if (!container) return;
    container.innerHTML = '';

    if (records.length === 0) {
        container.innerHTML = `
        <div class="dash-action-card" id="addFirstRecord" style="border:2px dashed #b2d8ce; cursor:pointer;">
            <div class="dac-icon teal">
                <svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
            </div>
            <div class="dac-content">
                <h3>Add Your First Visit</h3>
                <p>Start by adding your first medical visit record</p>
            </div>
            <svg class="dac-arrow" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </div>`;
        document.getElementById('addFirstRecord').onclick = () => showSection('addRecordPage');
        return;
    }

    records.forEach((r, i) => {
        const typeLabel = TYPE_LABELS[r.recordType] || r.recordType;
        const date      = new Date(Number(r.createdAt) * 1000).toLocaleDateString('en-GB');
        const fileCount = r.fileCount || 0;

        const card = document.createElement('div');
        card.className = 'dash-action-card record-item';
        card.style.cursor = 'default';
        card.innerHTML = `
            <div class="dac-icon teal">
                <svg viewBox="0 0 24 24" fill="none">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </div>
            <div class="dac-content">
                <h3>${r.title}</h3>
                <p>${typeLabel} &nbsp;·&nbsp; ${r.examDate} &nbsp;·&nbsp; ${r.doctor} &nbsp;·&nbsp; <strong style="color:#0a6e5e;">${fileCount} file${fileCount !== 1 ? 's' : ''}</strong> &nbsp;·&nbsp; ${date}</p>
            </div>
            <div style="display:flex; gap:0.5rem; flex-shrink:0;">
                <button class="rvc-btn-toggle" data-index="${i}">
                    <svg viewBox="0 0 24 24" fill="none" width="14"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/></svg>
                    View Files
                </button>
                <button class="rvc-btn-add-file" data-index="${i}">+ Add File</button>
            </div>
            <div class="rvc-files" id="files-${i}" style="display:none; width:100%; margin-top:1rem; padding-top:1rem; border-top:1px solid #e8f5f0;"></div>
        `;
        card.style.flexWrap = 'wrap';
        container.appendChild(card);
    });

    // Add new visit button
    const addCard = document.createElement('div');
    addCard.className = 'dash-action-card';
    addCard.id = 'addNewRecordBtn';
    addCard.style.cssText = 'border:2px dashed #b2d8ce; cursor:pointer;';
    addCard.innerHTML = `
        <div class="dac-icon teal">
            <svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
        </div>
        <div class="dac-content">
            <h3>Add New Visit</h3>
            <p>${records.length} visit${records.length !== 1 ? 's' : ''} recorded · Click to add a new one</p>
        </div>
        <svg class="dac-arrow" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
    container.appendChild(addCard);
    document.getElementById('addNewRecordBtn').onclick = () => showSection('addRecordPage');

    // Toggle files
    container.querySelectorAll('.rvc-btn-toggle').forEach(btn => {
        btn.onclick = async () => {
            const idx      = parseInt(btn.dataset.index);
            const filesDiv = document.getElementById(`files-${idx}`);
            if (filesDiv.style.display !== 'none') {
                filesDiv.style.display = 'none';
                btn.textContent = '▼ View Files';
                return;
            }
            btn.textContent = '▲ Hide Files';
            filesDiv.style.display = 'block';
            filesDiv.innerHTML = '<p style="color:#aaa; padding:0.8rem; text-align:center;">Loading files...</p>';

            try {
                const [account] = await walletClient.requestAddresses();
                const files = await publicClient.readContract({
                    address: contractAddress, abi,
                    functionName: 'getRecordFiles',
                    args: [BigInt(idx)], account
                });
                if (files.length === 0) {
                    filesDiv.innerHTML = '<p style="color:#aaa; padding:0.8rem; text-align:center;">No files in this record.</p>';
                    return;
                }
                filesDiv.innerHTML = files.map((f, fi) => {
                    const uploadTime = new Date(Number(f.uploadedAt) * 1000).toLocaleString('en-GB');
                    return `
                    <div class="dash-action-card" style="padding:0.9rem 1.2rem; cursor:default; margin-bottom:0;">
                        <div class="dac-icon teal" style="width:40px; height:40px; flex-shrink:0;">
                            <svg viewBox="0 0 24 24" fill="none" width="18"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M14 2v6h6M16 13H8M16 17H8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                        </div>
                        <div class="dac-content">
                            <h3 style="font-size:0.9rem;">${f.fileName || 'File ' + (fi + 1)}</h3>
                            <p>Uploaded ${uploadTime}</p>
                        </div>
                        <button class="rvc-btn-view" data-hash="${f.ipfsHash}"
                            style="background:#0a6e5e; color:#fff; border:none; border-radius:8px; padding:0.4rem 1rem; font-size:0.82rem; font-weight:600; cursor:pointer; font-family:inherit; display:flex; align-items:center; gap:0.4rem; flex-shrink:0;">
                            <svg viewBox="0 0 24 24" fill="none" width="13"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/></svg>
                            View
                        </button>
                    </div>`;
                }).join('');

                filesDiv.querySelectorAll('.rvc-btn-view').forEach(vBtn => {
                    vBtn.onclick = async () => {
                        try { showToast('Decrypting and loading file...', 'info'); await decryptAndOpen(vBtn.dataset.hash, userAccount); }
                        catch (e) { showToast('Error', 'error', e.message); }
                    };
                });
            } catch (e) {
                filesDiv.innerHTML = `<p style="color:red; padding:0.8rem;">Error loading files: ${e.message}</p>`;
            }
        };
    });

    // Edit removed — blockchain is immutable

    // Add file to existing record
    container.querySelectorAll('.rvc-btn-add-file').forEach(btn => {
        btn.onclick = () => {
            const idx = parseInt(btn.dataset.index);
            document.getElementById('addFileRecordIndex').value = idx;
            document.getElementById('addFileTitle').textContent = records[idx].title;
            document.getElementById('addFileInput').value       = '';
            document.getElementById('addFileLabel').innerHTML   = 'Drop file here or <strong>browse</strong>';
            showSection('addFilePage');
        };
    });
}

// ================================================================
// LOAD DASHBOARD
// ================================================================
async function loadDashboard() {
    const [account] = await walletClient.requestAddresses();
    userAccount = account;

    const data  = await publicClient.readContract({ address: contractAddress, abi, functionName: 'getMyDetails', account });
    const count = await publicClient.readContract({ address: contractAddress, abi, functionName: 'getRecordCount', account });

    document.getElementById('menuRegister').style.display  = 'none';
    document.getElementById('menuLogin').style.display     = 'none';
    document.getElementById('menuDashboard').style.display = 'block';
    document.getElementById('menuLogout').style.display    = 'block';
    // Hide hero CTA buttons + header Get Started when logged in
    const heroActions = document.getElementById('heroActions');
    if (heroActions) heroActions.style.display = 'none';
    const headerBtn = document.getElementById('headerRegisterBtn');
    if (headerBtn) headerBtn.style.display = 'none';
    document.getElementById('dashboardUserName').innerText = data[0];
    document.getElementById('dashName').innerText          = data[0];
    document.getElementById('dashName2').innerText         = data[0];
    document.getElementById('dashEmail').innerText         = data[1];
    document.getElementById('dashDoB').innerText           = data[2];
    document.getElementById('dashBlood').innerText         = data[3];
    document.getElementById('dashAddress').innerText       = userAccount;

    // Load tất cả record info
    const n = Number(count);
    myRecords = [];
    for (let i = 0; i < n; i++) {
        const info = await publicClient.readContract({
            address: contractAddress, abi,
            functionName: 'getRecordInfo',
            args: [BigInt(i)], account
        });
        myRecords.push({
            title:      info.title,
            recordType: info.recordType,
            examDate:   info.examDate,
            doctor:     info.doctor,
            createdAt:  info.createdAt,
            fileCount:  Number(info.fileCount),
        });
    }
    renderRecords(myRecords);

    const modal = document.getElementById('profileModal');
    document.getElementById('viewProfileBtn').onclick    = () => modal.style.display = 'flex';
    document.getElementById('closeProfileModal').onclick = () => modal.style.display = 'none';

    showSection('dashboard');
}

// ================================================================
// REGISTER
// ================================================================
document.getElementById('regSubmit').onclick = async () => {
    const name   = document.getElementById('regFullName').value.trim();
    const email  = document.getElementById('regEmail').value.trim();
    const dob    = document.getElementById('regDoB').value;
    const blood  = document.getElementById('regBloodGroup').value;
    const pw     = document.getElementById('regPassword').value;
    const pwConf = document.getElementById('regConfirmPassword').value;

    if (!name || !email || !dob)  { showToast('Please fill in all required fields!', 'error'); return; }
    if (!pw || pw.length < 6)     { showToast('Password must be at least 6 characters!', 'error'); return; }
    if (pw !== pwConf)            { showToast('Passwords do not match!', 'error'); return; }

    try {
        const [account] = await walletClient.requestAddresses();
        const { request } = await publicClient.simulateContract({
            account, address: contractAddress, abi,
            functionName: 'registerPatient',
            args: [name, email, dob, blood, await hashPassword(pw)]
        });
        const tx = await walletClient.writeContract(request);
        showToast('Registration successful!', 'success', `Transaction: ${tx.slice(0,18)}...`);
        showSection('loginPage');
    } catch (e) { console.error(e); showToast('Registration failed', 'error', e.shortMessage || e.message); }
};

// ================================================================
// ADD NEW VISIT RECORD
// ================================================================
// ================================================================
// MULTI-FILE UPLOAD UI — with X button to remove individual files
// ================================================================
function setupMultiFileUpload(areaId, inputId, labelId, listId) {
    const area  = document.getElementById(areaId);
    const input = document.getElementById(inputId);
    const label = document.getElementById(labelId);
    const list  = document.getElementById(listId);
    if (!area || !input) return;

    // Internal file list (array of File objects)
    let selectedFiles = [];

    function syncInputFiles() {
        const dt = new DataTransfer();
        selectedFiles.forEach(f => dt.items.add(f));
        input.files = dt.files;
    }

    function renderList() {
        if (!list) return;
        list.innerHTML = '';

        if (selectedFiles.length === 0) {
            label.innerHTML = 'Drop files here or <strong>browse</strong>';
            return;
        }

        label.innerHTML = `<strong>${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''} ready to upload</strong>`;

        selectedFiles.forEach((f, i) => {
            const item = document.createElement('div');
            item.style.cssText = 'display:flex;align-items:center;gap:0.7rem;background:#f6fdfb;border:1.5px solid #d4ede6;border-radius:10px;padding:0.6rem 0.9rem;font-size:0.85rem;transition:border-color 0.2s;';
            item.innerHTML = `
                <div style="width:34px;height:34px;background:rgba(10,110,94,0.08);border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    <svg viewBox="0 0 24 24" fill="none" width="16"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="#0a6e5e" stroke-width="2" stroke-linecap="round"/><path d="M14 2v6h6M16 13H8M16 17H8" stroke="#0a6e5e" stroke-width="2" stroke-linecap="round"/></svg>
                </div>
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:700;color:#1a3a2a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${f.name}</div>
                    <div style="font-size:0.75rem;color:#aaa;margin-top:1px;">${(f.size/1024).toFixed(1)} KB</div>
                </div>
                <button data-index="${i}" style="width:28px;height:28px;border-radius:50%;border:1.5px solid #e0e0e0;background:#fff;color:#888;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:14px;font-weight:700;transition:all 0.2s;"
                    onmouseover="this.style.background='#fee2e2';this.style.borderColor='#dc2626';this.style.color='#dc2626';"
                    onmouseout="this.style.background='#fff';this.style.borderColor='#e0e0e0';this.style.color='#888';">
                    ×
                </button>`;
            // Remove file on X click
            item.querySelector('button').onclick = (e) => {
                e.stopPropagation();
                selectedFiles.splice(i, 1);
                syncInputFiles();
                renderList();
            };
            list.appendChild(item);
        });
    }

    // Click to browse
    area.onclick = (e) => {
        if (e.target.tagName === 'BUTTON') return;
        input.click();
    };

    // File input change
    input.onchange = () => {
        Array.from(input.files).forEach(f => {
            // Avoid duplicates by name
            if (!selectedFiles.find(sf => sf.name === f.name)) {
                selectedFiles.push(f);
            }
        });
        syncInputFiles();
        renderList();
    };

    // Drag & drop
    area.ondragover  = e => { e.preventDefault(); area.style.borderColor = '#0a6e5e'; area.style.background = 'rgba(10,110,94,0.03)'; };
    area.ondragleave = () => { area.style.borderColor = ''; area.style.background = ''; };
    area.ondrop = e => {
        e.preventDefault();
        area.style.borderColor = ''; area.style.background = '';
        Array.from(e.dataTransfer.files).forEach(f => {
            if (!selectedFiles.find(sf => sf.name === f.name)) selectedFiles.push(f);
        });
        syncInputFiles();
        renderList();
    };

    // Expose getFiles for submit handler
    area._getFiles = () => selectedFiles;
    area._reset    = () => { selectedFiles = []; syncInputFiles(); renderList(); };
}

setupMultiFileUpload('addFileArea', 'addFile', 'addFileLabel', 'addFileList');

// Show/hide custom type input when Other is selected
document.getElementById('addRecordType')?.addEventListener('change', function() {
    const customInput = document.getElementById('addCustomType');
    if (!customInput) return;
    if (this.value === 'Other') {
        customInput.style.display = 'block';
        customInput.focus();
    } else {
        customInput.style.display = 'none';
        customInput.value = '';
    }
});

document.getElementById('addRecordSubmit')?.addEventListener('click', async () => {
    const title      = document.getElementById('addTitle').value.trim();
    const typeSelect = document.getElementById('addRecordType').value;
    const customType = document.getElementById('addCustomType')?.value.trim();
    const type       = (typeSelect === 'Other' && customType) ? customType : typeSelect;
    const examDate   = document.getElementById('addExamDate').value;
    const doctor     = document.getElementById('addDoctor').value.trim();
    const area       = document.getElementById('addFileArea');
    const fi         = document.getElementById('addFile');
    const files      = area?._getFiles ? area._getFiles() : Array.from(fi?.files || []);

    if (!title || !examDate || !doctor) {
        showToast('Please fill in all required fields!', 'error'); return;
    }
    if (typeSelect === 'Other' && !customType) {
        const inp = document.getElementById('addCustomType');
        if (inp) { inp.style.display = 'block'; inp.focus(); }
        showToast('Please specify the document type!', 'error'); return;
    }
    if (files.length === 0) {
        showToast('Please upload at least one file!', 'error'); return;
    }
    try {
        const [account] = await walletClient.requestAddresses();

        // Step 1: Create the record
        const { request } = await publicClient.simulateContract({
            account, address: contractAddress, abi,
            functionName: 'addRecord',
            args: [title, type, examDate, doctor]
        });
        const tx = await walletClient.writeContract(request);

        // Step 2: Upload files
        if (files.length > 0) {
            // Get the new record index
            const count = await publicClient.readContract({
                address: contractAddress, abi, functionName: 'getRecordCount', account
            });
            const newIndex = Number(count) - 1;

            for (let i = 0; i < files.length; i++) {
                showToast(`Uploading ${i + 1}/${files.length}`, 'info', files[i].name);
                const blob = await encryptFile(files[i], account);
                const hash = await uploadToPinata(new File([blob], 'record.enc'));
                const { request: fileReq } = await publicClient.simulateContract({
                    account, address: contractAddress, abi,
                    functionName: 'addFileToRecord',
                    args: [BigInt(newIndex), hash, files[i].name]
                });
                await walletClient.writeContract(fileReq);
            }
            showToast(`Record saved with ${files.length} file${files.length > 1 ? 's' : ''}!`, 'success');
        }

        // Reset file list
        const addArea = document.getElementById('addFileArea');
        if (addArea && addArea._reset) addArea._reset();

        await loadDashboard();
    } catch (e) { console.error(e); showToast('Error', 'error', e.shortMessage || e.message); }
});

// ================================================================
// ADD FILES TO EXISTING RECORD (multiple)
// ================================================================
setupMultiFileUpload('addFileUploadArea', 'addFileInput', 'addFileLabel2', 'addFileList2');

document.getElementById('addFileSubmit')?.addEventListener('click', async () => {
    const recordIndex  = parseInt(document.getElementById('addFileRecordIndex').value);
    const uploadArea   = document.getElementById('addFileUploadArea');
    const fi           = document.getElementById('addFileInput');
    const files        = uploadArea && uploadArea._getFiles ? uploadArea._getFiles() : (fi ? Array.from(fi.files) : []);

    if (files.length === 0) { showToast('Please select at least one file!', 'error'); return; }

    try {
        const [account] = await walletClient.requestAddresses();

        for (let i = 0; i < files.length; i++) {
            showToast(`Uploading ${i + 1}/${files.length}`, 'info', files[i].name);
            const blob = await encryptFile(files[i], account);
            const hash = await uploadToPinata(new File([blob], 'record.enc'));
            const { request } = await publicClient.simulateContract({
                account, address: contractAddress, abi,
                functionName: 'addFileToRecord',
                args: [BigInt(recordIndex), hash, files[i].name]
            });
            await walletClient.writeContract(request);
        }

        showToast(`${files.length} file${files.length > 1 ? 's' : ''} added!`, 'success');
        if (uploadArea && uploadArea._reset) uploadArea._reset();
        await loadDashboard();
    } catch (e) { console.error(e); showToast('Error', 'error', e.shortMessage || e.message); }
});

// Edit Record removed — blockchain is immutable, records cannot be modified

// ================================================================
// LOGIN
// ================================================================
document.getElementById('loginSubmit').onclick = async () => {
    const email = document.getElementById('loginEmail').value.trim();
    const pw    = document.getElementById('loginPassword').value;
    if (!email || !pw) { showToast('Please enter your email and password!', 'error'); return; }
    try {
        const [account] = await walletClient.requestAddresses();
        userAccount = account;
        const isReg = await publicClient.readContract({ address: contractAddress, abi, functionName: 'isUserRegistered', args: [account] });
        if (!isReg) { showToast('Wallet not registered', 'error', 'Please create an account first.'); return; }
        const isValid = await publicClient.readContract({ address: contractAddress, abi, functionName: 'verifyPassword', args: [await hashPassword(pw)], account });
        if (!isValid) { showToast('Incorrect password', 'error'); return; }
        const data = await publicClient.readContract({ address: contractAddress, abi, functionName: 'getMyDetails', account });
        if (data[1].toLowerCase() !== email.toLowerCase()) { showToast('Email does not match this wallet', 'error'); return; }
        await loadDashboard();
    } catch (e) { console.error(e); showToast('Login failed', 'error', e.shortMessage || e.message); }
};

// ================================================================
// LOGOUT
// ================================================================
document.getElementById('menuLogout').onclick = () => {
    userAccount = ''; myRecords = [];
    document.getElementById('menuLogout').style.display    = 'none';
    document.getElementById('menuDashboard').style.display = 'none';
    document.getElementById('menuRegister').style.display  = 'block';
    document.getElementById('menuLogin').style.display     = 'block';
    // Show hero CTA buttons + header Get Started again on logout
    const heroActions = document.getElementById('heroActions');
    if (heroActions) heroActions.style.display = 'flex';
    const headerBtn = document.getElementById('headerRegisterBtn');
    if (headerBtn) headerBtn.style.display = '';
    showSection('landingPage');
};

// ================================================================
// PASSWORD TOGGLE
// ================================================================
document.querySelectorAll('.cih-pw-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
        const input = document.getElementById(btn.dataset.target);
        const hide  = input.type === 'password';
        input.type  = hide ? 'text' : 'password';
        btn.querySelector('.eye-show').style.display = hide ? 'none' : '';
        btn.querySelector('.eye-hide').style.display = hide ? '' : 'none';
    });
});

// ================================================================
// FILE UPLOAD UI
// ================================================================
function setupFileUpload(areaId, inputId, labelId) {
    const area = document.getElementById(areaId), input = document.getElementById(inputId), label = document.getElementById(labelId);
    if (!area || !input) return;
    area.onclick = () => input.click();
    input.onchange = () => {
        if (input.files[0] && label) { label.innerHTML = `<strong>✓ ${input.files[0].name}</strong>`; area.style.borderColor = '#0a6e5e'; }
    };
    area.ondragover  = e => { e.preventDefault(); area.style.borderColor = '#0a6e5e'; };
    area.ondragleave = () => { area.style.borderColor = ''; };
    area.ondrop = e => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) { const dt = new DataTransfer(); dt.items.add(file); input.files = dt.files; if (label) label.innerHTML = `<strong>✓ ${file.name}</strong>`; area.style.borderColor = '#0a6e5e'; }
    };
}
// addFileArea + addFileUploadArea handled by setupMultiFileUpload above

// ================================================================
// NAVIGATION
// ================================================================
document.getElementById('menuDashboard').onclick     = () => loadDashboard();
document.getElementById('menuHome').onclick          = () => showSection('landingPage');
document.getElementById('menuRegister').onclick      = () => showSection('registerPage');
document.getElementById('menuLogin').onclick         = () => showSection('loginPage');
document.getElementById('landingGetStarted').onclick = () => showSection('registerPage');
document.getElementById('landingLoginBtn').onclick   = () => showSection('loginPage');
document.getElementById('headerRegisterBtn').onclick = () => showSection('registerPage');
document.getElementById('regClose').onclick          = () => showSection('landingPage');
document.getElementById('loginClose').onclick        = () => showSection('landingPage');
document.getElementById('addRecordClose')?.addEventListener('click',  () => showSection('dashboard'));
document.getElementById('addFileClose')?.addEventListener('click',    () => showSection('dashboard'));
// editRecordClose removed

window.addEventListener('scroll', () => {
    const h = document.getElementById('mainHeader');
    h.style.boxShadow = window.scrollY > 10 ? '0 4px 30px rgba(10,110,94,0.15)' : '0 2px 20px rgba(10,110,94,0.1)';
});
document.getElementById('goToRegisterFromLogin')?.addEventListener('click', e => { e.preventDefault(); showSection('registerPage'); });

showSection('landingPage');
