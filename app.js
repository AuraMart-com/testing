import { initializeApp } from "firebase/app";
import {
    getFirestore,
    doc as fbDoc,
    setDoc,
    getDocs,
    collection,
    deleteDoc,
    updateDoc
} from "firebase/firestore";

// ==========================================
// CRITICAL: WIRE UP YOUR LINKS HERE
// ==========================================
const BACKEND_API_URL = "https://script.google.com/macros/s/AKfycbzkNtjvOnmkexRXk_2j-wjUI98MTUcLy0VviSDqAHnpabgmolx6MUOdOi5ZCe1AFEgE/exec";

// Firebase App Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCn1rzZx2kSi_ak7y8aTN22ChnTtQK5XR8",
    authDomain: "hybrid-decoder-071nt.firebaseapp.com",
    projectId: "hybrid-decoder-071nt",
    storageBucket: "hybrid-decoder-071nt.firebasestorage.app",
    messagingSenderId: "650480695500",
    appId: "1:650480695500:web:e6d740b2c31c5f2e1cea69"
};

const OperationType = {
    CREATE: 'create',
    UPDATE: 'update',
    DELETE: 'delete',
    LIST: 'list',
    GET: 'get',
    WRITE: 'write',
};

// Initialize Firebase — always use default Firestore for this project
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// NOTE: enableIndexedDbPersistence is removed — it is deprecated in Firebase v10+.
// Firebase v10 uses multi-tab persistence automatically via IndexedDB by default.

function promiseWithTimeout(promise, ms, timeoutError = new Error("Operation timed out")) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(timeoutError), ms);
        promise.then(
            (res) => { clearTimeout(timer); resolve(res); },
            (err) => { clearTimeout(timer); reject(err); }
        );
    });
}

// =========================================================================
// SYSTEM DIAGNOSTICS: Google Apps Script Web App Validator & Setup Guide
// =========================================================================
function validateBackendConnection() {
    const url = BACKEND_API_URL;
    const banner = document.getElementById('backendDiagnosticBanner');
    if (!banner) return;

    let isInvalid = false;
    if (!url || url.startsWith("PASTE_") || url.trim() === "") {
        isInvalid = true;
    } else if (url.includes("/macros/library/")) {
        isInvalid = true;
    } else if (url.includes("/edit")) {
        isInvalid = true;
    } else if (url.includes("/d/")) {
        isInvalid = true;
    } else if (!url.includes("/macros/s/") || !url.includes("/exec")) {
        isInvalid = true;
    }

    if (isInvalid) {
        banner.style.display = "block";
        const templateArea = document.getElementById('appsScriptTemplateArea');
        if (templateArea) {
            templateArea.value =
                `// =========================================================================\n` +
                `// GOOGLE APPS SCRIPT: FULL SYNC BACKEND FOR SECURED VAULT (DRIVE ONLY)\n` +
                `// =========================================================================\n` +
                `const TARGET_DRIVE_FOLDER_ID = "1rbR0YnwU_9tPmeFqyhIR0mZVjFIYx6Sy";\n\n` +
                `function doPost(e) {\n` +
                `  try {\n` +
                `    var payload = JSON.parse(e.postData.contents);\n` +
                `    var action = payload.action || "upload";\n` +
                `    var folder = DriveApp.getFolderById(TARGET_DRIVE_FOLDER_ID);\n\n` +
                `    if (action === "readAll" || action === "sync" || action === "scan") {\n` +
                `      var data = readAllAssets();\n` +
                `      return createJsonResponse({ status: "SUCCESS", files: data.files, folders: data.folders });\n` +
                `    }\n` +
                `    if (action === "delete") {\n` +
                `      if (payload.driveLink && payload.driveLink.indexOf("http") === 0) {\n` +
                `        var assetId = extractIdFromUrl(payload.driveLink);\n` +
                `        if (assetId) {\n` +
                `          try {\n` +
                `            if (payload.assetType === "Folder") { DriveApp.getFolderById(assetId).setTrashed(true); }\n` +
                `            else { DriveApp.getFileById(assetId).setTrashed(true); }\n` +
                `          } catch (errDrive) {}\n` +
                `        }\n` +
                `      }\n` +
                `      return createJsonResponse({ status: "SUCCESS", message: "Deleted from Google Drive" });\n` +
                `    }\n` +
                `    if (action === "rename") {\n` +
                `      if (payload.driveLink && payload.driveLink.indexOf("http") === 0) {\n` +
                `        var assetId = extractIdFromUrl(payload.driveLink);\n` +
                `        if (assetId) {\n` +
                `          try {\n` +
                `            if (payload.assetType === "Folder") { DriveApp.getFolderById(assetId).setName(payload.title); }\n` +
                `            else { DriveApp.getFileById(assetId).setName(payload.title); }\n` +
                `          } catch (errDrive) {}\n` +
                `        }\n` +
                `      }\n` +
                `      return createJsonResponse({ status: "SUCCESS", message: "Asset renamed in Google Drive" });\n` +
                `    }\n` +
                `    var driveLink = payload.driveLink || "javascript:void(0)";\n` +
                `    var driveId = payload.id;\n` +
                `    if (payload.assetType === "Folder") {\n` +
                `      if (driveLink === "javascript:void(0)") {\n` +
                `        var parentFolder = folder;\n` +
                `        if (payload.parentFolder && payload.parentFolder !== "root") {\n` +
                `          try { parentFolder = DriveApp.getFolderById(payload.parentFolder); } catch (err) { parentFolder = folder; }\n` +
                `        }\n` +
                `        var newFolder = parentFolder.createFolder(payload.folderName);\n` +
                `        newFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);\n` +
                `        driveLink = newFolder.getUrl();\n` +
                `        driveId = newFolder.getId();\n` +
                `      }\n` +
                `    } else {\n` +
                `      if (payload.fileBase64 && payload.fileBase64 !== "EMPTY_FOLDER" && driveLink === "javascript:void(0)") {\n` +
                `        var base64Data = payload.fileBase64;\n` +
                `        if (base64Data.indexOf(",") > -1) { base64Data = base64Data.split(",")[1]; }\n` +
                `        var decodedBytes = Utilities.base64Decode(base64Data);\n` +
                `        var blob = Utilities.newBlob(decodedBytes, payload.fileType || "application/octet-stream", payload.fileName);\n` +
                `        var parentFolder = folder;\n` +
                `        if (payload.parentFolder && payload.parentFolder !== "root") {\n` +
                `          try { parentFolder = DriveApp.getFolderById(payload.parentFolder); } catch (err) { parentFolder = folder; }\n` +
                `        }\n` +
                `        var file = parentFolder.createFile(blob);\n` +
                `        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);\n` +
                `        driveLink = file.getUrl();\n` +
                `        driveId = file.getId();\n` +
                `      }\n` +
                `    }\n` +
                `    return createJsonResponse({ status: "SUCCESS", driveLink: driveLink, driveId: driveId });\n` +
                `  } catch (err) {\n` +
                `    return createJsonResponse({ status: "ERROR", message: err.toString() });\n` +
                `  }\n` +
                `}\n\n` +
                `function doGet(e) {\n` +
                `  var action = e && e.parameter && e.parameter.action;\n` +
                `  if (action === "readAll" || action === "sync" || action === "scan") {\n` +
                `    var data = readAllAssets();\n` +
                `    return createJsonResponse({ status: "SUCCESS", files: data.files, folders: data.folders });\n` +
                `  }\n` +
                `  return createJsonResponse({ status: "SUCCESS", message: "Endpoint active" });\n` +
                `}\n\n` +
                `function extractIdFromUrl(url) {\n` +
                `  var match = url.match(/[-\\w]{25,}/);\n` +
                `  return match ? match[0] : null;\n` +
                `}\n\n` +
                `function readAllAssets() {\n` +
                `  var files = []; var folders = [];\n` +
                `  try {\n` +
                `    var rootFolder = DriveApp.getFolderById(TARGET_DRIVE_FOLDER_ID);\n` +
                `    var scanResult = scanDriveFolder(rootFolder, "root");\n` +
                `    files = scanResult.files; folders = scanResult.folders;\n` +
                `  } catch (e) {}\n` +
                `  return { files: files, folders: folders };\n` +
                `}\n\n` +
                `function scanDriveFolder(folder, parentId) {\n` +
                `  var files = []; var folders = [];\n` +
                `  try {\n` +
                `    var driveFiles = folder.getFiles();\n` +
                `    while (driveFiles.hasNext()) {\n` +
                `      var file = driveFiles.next();\n` +
                `      var fSize = "N/A";\n` +
                `      try {\n` +
                `        var bytes = file.getSize();\n` +
                `        if (bytes > 0) {\n` +
                `          var k = 1024; var sizes = ["Bytes","KB","MB","GB"];\n` +
                `          var i = Math.floor(Math.log(bytes) / Math.log(k));\n` +
                `          fSize = parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];\n` +
                `        }\n` +
                `      } catch (e) {}\n` +
                `      files.push({ id: file.getId(), title: file.getName(), category: "Other", parentFolder: parentId,\n` +
                `        description: "Sync from Google Drive", driveLink: file.getUrl(), assetType: "File", fileSize: fSize });\n` +
                `    }\n` +
                `    var subFolders = folder.getFolders();\n` +
                `    while (subFolders.hasNext()) {\n` +
                `      var subFolder = subFolders.next();\n` +
                `      var foldId = subFolder.getId();\n` +
                `      folders.push({ id: foldId, title: subFolder.getName(), category: "Directory", parentFolder: parentId,\n` +
                `        description: "Sync from Google Drive", driveLink: subFolder.getUrl(), assetType: "Folder" });\n` +
                `      var subResult = scanDriveFolder(subFolder, foldId);\n` +
                `      files = files.concat(subResult.files);\n` +
                `      folders = folders.concat(subResult.folders);\n` +
                `    }\n` +
                `  } catch (err) {}\n` +
                `  return { files: files, folders: folders };\n` +
                `}\n\n` +
                `function createJsonResponse(data) {\n` +
                `  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);\n` +
                `}`;
        }
    } else {
        banner.style.display = "none";
    }
}

window.toggleDiagnosticDetails = function () {
    const details = document.getElementById('diagnosticDetails');
    const btn = document.querySelector('.diagnostic-toggle-btn');
    if (details && btn) {
        if (details.style.display === "none") {
            details.style.display = "block";
            btn.innerText = "[HIDE DETAILED STEPS/CODE]";
        } else {
            details.style.display = "none";
            btn.innerText = "[Show Connection Steps]";
        }
    }
};

window.copyAppsScriptTemplate = function () {
    const copyText = document.getElementById("appsScriptTemplateArea");
    if (copyText) {
        copyText.select();
        copyText.setSelectionRange(0, 99999);
        try {
            navigator.clipboard.writeText(copyText.value);
            showToast("Apps Script template copied to clipboard!", "success");
        } catch (err) {
            document.execCommand("copy");
            showToast("Apps Script template copied to clipboard!", "success");
        }
    }
};

// =========================================================================
// LOCAL INVENTORY — loaded from localStorage cache for instant boot
// =========================================================================
let fileInventory = [];
let folderInventory = [];

try {
    const cachedFiles = localStorage.getItem('vault_files_cache');
    const cachedFolders = localStorage.getItem('vault_folders_cache');
    if (cachedFiles) fileInventory = JSON.parse(cachedFiles);
    if (cachedFolders) folderInventory = JSON.parse(cachedFolders);
} catch (e) {
    console.warn("Failed to load local cache", e);
}

// =========================================================================
// TOAST NOTIFICATION SYSTEM
// =========================================================================
window.showToast = function (message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const card = document.createElement('div');
    // Normalize 'warning' to 'info' so the CSS class always exists
    const safeType = ['success', 'error', 'info'].includes(type) ? type : 'info';
    card.className = `toast-card ${safeType}`;

    const icons = { success: '✅', error: '❌', info: '🔔' };
    const icon = icons[safeType] || 'ℹ️';

    card.innerHTML = `
        <div class="toast-content">
            <span class="toast-icon">${icon}</span>
            <span class="toast-message">${message}</span>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
    `;

    container.appendChild(card);
    requestAnimationFrame(() => card.classList.add('active'));

    setTimeout(() => {
        card.classList.remove('active');
        card.addEventListener('transitionend', () => card.remove());
    }, 4000);
};

// =========================================================================
// CUSTOM ERROR MODAL
// =========================================================================
window.showErrorModal = function (title, message, troubleshootingList = []) {
    const existing = document.getElementById('customErrorModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'customErrorModal';
    Object.assign(modal.style, {
        position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
        backgroundColor: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: '999999'
    });

    let listHtml = '';
    if (troubleshootingList && troubleshootingList.length > 0) {
        listHtml = `
            <div style="margin-top:15px;text-align:left;background:rgba(239,68,68,0.08);padding:12px 16px;border-radius:8px;border:1px solid rgba(239,68,68,0.2);">
                <strong style="color:#f87171;font-size:0.85rem;display:block;margin-bottom:6px;">TROUBLESHOOTING CHECKLIST:</strong>
                <ul style="margin:0;padding-left:18px;color:#cbd5e1;font-size:0.8rem;display:flex;flex-direction:column;gap:4px;line-height:1.4;">
                    ${troubleshootingList.map(item => `<li>${item}</li>`).join('')}
                </ul>
            </div>`;
    }

    modal.innerHTML = `
        <div style="background:#1e293b;border:1px solid rgba(239,68,68,0.3);border-radius:12px;width:90%;max-width:480px;padding:24px;box-shadow:0 20px 25px -5px rgb(0 0 0/0.5);text-align:center;">
            <div style="font-size:2.5rem;margin-bottom:12px;">⚠️</div>
            <h3 style="color:#f87171;margin-bottom:8px;font-size:1.2rem;font-weight:600;">${title}</h3>
            <p style="color:#94a3b8;font-size:0.9rem;line-height:1.5;margin:0 0 15px 0;">${message}</p>
            ${listHtml}
            <button onclick="document.getElementById('customErrorModal').remove()" style="margin-top:20px;background:#ef4444;color:white;border:none;padding:8px 24px;border-radius:6px;font-weight:500;cursor:pointer;font-size:0.85rem;">Dismiss</button>
        </div>`;
    document.body.appendChild(modal);
};

// =========================================================================
// FIREBASE HELPERS
// =========================================================================
async function firestoreSet(collName, docId, data) {
    try {
        await promiseWithTimeout(
            setDoc(fbDoc(db, collName, docId), data, { merge: true }),
            6000
        );
        return true;
    } catch (err) {
        console.error(`Firestore SET failed [${collName}/${docId}]:`, err.message);
        throw err;
    }
}

async function firestoreUpdate(collName, docId, data) {
    try {
        await promiseWithTimeout(
            updateDoc(fbDoc(db, collName, docId), data),
            6000
        );
        return true;
    } catch (err) {
        console.error(`Firestore UPDATE failed [${collName}/${docId}]:`, err.message);
        throw err;
    }
}

async function firestoreDelete(collName, docId) {
    try {
        await promiseWithTimeout(
            deleteDoc(fbDoc(db, collName, docId)),
            6000
        );
        return true;
    } catch (err) {
        console.error(`Firestore DELETE failed [${collName}/${docId}]:`, err.message);
        throw err;
    }
}

// =========================================================================
// FETCH DATABASE FROM FIRESTORE
// =========================================================================
async function fetchDatabase() {
    validateBackendConnection();
    const searchBox = document.getElementById('searchBox');
    const syncStatus = document.getElementById('syncStatus');

    try {
        const [filesSnapshot, foldersSnapshot] = await Promise.all([
            promiseWithTimeout(getDocs(collection(db, "files")), 8000, new Error("Files collection read timed out")),
            promiseWithTimeout(getDocs(collection(db, "folders")), 8000, new Error("Folders collection read timed out"))
        ]);

        fileInventory = [];
        filesSnapshot.forEach(docSnap => {
            const data = docSnap.data();
            fileInventory.push({
                id: docSnap.id,
                title: data.title || "",
                category: data.category || "Other",
                parentFolder: data.parentFolder || "root",
                description: data.description || "",
                driveLink: data.driveLink || "javascript:void(0)",
                assetType: "File",
                fileSize: data.fileSize || "N/A"
            });
        });

        folderInventory = [];
        foldersSnapshot.forEach(docSnap => {
            const data = docSnap.data();
            folderInventory.push({
                id: docSnap.id,
                title: data.title || "",
                category: "Directory",
                parentFolder: data.parentFolder || "root",
                description: data.description || "",
                driveLink: data.driveLink || "javascript:void(0)",
                assetType: "Folder"
            });
        });

        // Save to localStorage for instant subsequent loads
        try {
            localStorage.setItem('vault_files_cache', JSON.stringify(fileInventory));
            localStorage.setItem('vault_folders_cache', JSON.stringify(folderInventory));
        } catch (e) { /* storage quota exceeded — ignore */ }

        if (syncStatus) {
            syncStatus.className = "sync-status online";
            syncStatus.innerHTML = `● CLOUD SYNCED`;
            syncStatus.title = "Connected securely to Firestore NoSQL cloud database.";
        }
        if (searchBox) {
            searchBox.disabled = false;
            searchBox.placeholder = "Search by file name, category, or descriptions...";
        }
        renderVault();
    } catch (err) {
        console.error("Firebase Cloud sync offline:", err);

        // Fallback to local cache
        try {
            const cachedFiles = localStorage.getItem('vault_files_cache');
            const cachedFolders = localStorage.getItem('vault_folders_cache');
            if (cachedFiles) fileInventory = JSON.parse(cachedFiles);
            if (cachedFolders) folderInventory = JSON.parse(cachedFolders);
        } catch (e) {
            fileInventory = [];
            folderInventory = [];
        }

        if (syncStatus) {
            syncStatus.className = "sync-status offline";
            syncStatus.innerHTML = `● SYNC OFFLINE`;
            syncStatus.title = "Unable to connect to Firebase. Error: " + err.message;
        }
        if (searchBox) {
            searchBox.disabled = false;
            searchBox.placeholder = "Search cached local vault files...";
        }
        showToast("Operating in Offline Cache Mode", "info");
        renderVault();
    }
}

// =========================================================================
// NAVIGATION HELPERS
// =========================================================================
function getActiveFolderName(folderId) {
    if (folderId === 'root') return 'Root';
    const folderDoc = folderInventory.find(item => item.id === folderId);
    return folderDoc ? folderDoc.title : 'Unidentified Folder';
}

function getFolderFileCount(folderId) {
    const filesCount = fileInventory.filter(item => (item.parentFolder || 'root') === folderId).length;
    const foldersCount = folderInventory.filter(item => (item.parentFolder || 'root') === folderId).length;
    return filesCount + foldersCount;
}

function renderBreadcrumbs() {
    const container = document.getElementById('breadcrumbs');
    if (!container) return;

    const urlParams = new URLSearchParams(window.location.search);
    const activeFolderId = urlParams.get('folder') || 'root';

    const trail = [];
    let currentId = activeFolderId;
    let loopGuard = 0;

    while (currentId && currentId !== 'root' && loopGuard < 50) {
        loopGuard++;
        const folderDoc = folderInventory.find(item => item.id === currentId);
        if (folderDoc) {
            trail.unshift(folderDoc);
            currentId = folderDoc.parentFolder || 'root';
        } else {
            break;
        }
    }

    let markup = `<span class="breadcrumb-item" onclick="window.location.search = '?folder=root'">📁 ROOT</span>`;
    trail.forEach((folderDoc, index) => {
        markup += ` <span class="breadcrumb-separator">/</span> `;
        if (index === trail.length - 1) {
            markup += `<span class="breadcrumb-current">${folderDoc.title.toUpperCase()}</span>`;
        } else {
            markup += `<span class="breadcrumb-item" onclick="window.location.search = '?folder=' + encodeURIComponent('${folderDoc.id}')">${folderDoc.title.toUpperCase()}</span>`;
        }
    });
    container.innerHTML = markup;
}

window.openFolder = function (folderId) { window.location.search = '?folder=' + folderId; };
window.navigateHome = function () { window.location.search = '?folder=root'; };
window.navigateBack = function () {
    const urlParams = new URLSearchParams(window.location.search);
    const activeFolderId = urlParams.get('folder') || 'root';
    if (activeFolderId === 'root') return;
    const folderDoc = folderInventory.find(item => item.id === activeFolderId);
    const parentId = folderDoc ? (folderDoc.parentFolder || 'root') : 'root';
    window.location.search = '?folder=' + parentId;
};

window.refreshDatabase = async function () {
    const refreshBtn = document.getElementById('navRefreshBtn');
    if (refreshBtn) refreshBtn.classList.add('loading');
    try {
        await fetchDatabase();
    } catch (e) {
        console.error("Database query sync failed:", e);
    } finally {
        if (refreshBtn) refreshBtn.classList.remove('loading');
    }
};

// =========================================================================
// SYNC GOOGLE DRIVE → FIRESTORE
// =========================================================================
window.syncDriveToDatabase = async function () {
    const syncBtn = document.getElementById('navSyncDriveBtn');
    if (syncBtn) syncBtn.classList.add('loading');
    showToast("Scanning Google Drive for files...", "info");

    try {
        if (!BACKEND_API_URL || BACKEND_API_URL.startsWith("PASTE_")) {
            throw new Error("Google Apps Script URL is not configured.");
        }

        let response = null;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        try {
            response = await fetch(BACKEND_API_URL, {
                method: "POST",
                body: JSON.stringify({ action: "readAll" }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
        } catch (postErr) {
            clearTimeout(timeoutId);
            const getController = new AbortController();
            const getTimeoutId = setTimeout(() => getController.abort(), 15000);
            try {
                const urlWithParams = BACKEND_API_URL + (BACKEND_API_URL.includes("?") ? "&" : "?") + "action=readAll";
                response = await fetch(urlWithParams, { method: "GET", signal: getController.signal });
                clearTimeout(getTimeoutId);
            } catch (getErr) {
                clearTimeout(getTimeoutId);
                throw new Error("Both POST and GET sync requests failed: " + getErr.message);
            }
        }

        if (!response || !response.ok) {
            throw new Error(`Server returned status ${response ? response.status : 'unknown'}`);
        }

        const resData = await response.json();
        if (resData.status !== "SUCCESS") throw new Error(resData.message || "Failed to scan files");

        const cloudFiles = resData.files || [];
        const cloudFolders = resData.folders || [];
        let newlyAddedCount = 0;
        let nextFolders = [...folderInventory];
        let nextFiles = [...fileInventory];

        cloudFolders.forEach(folder => {
            const cleanFolderId = String(folder.id).trim();
            const cleanParentFolder = folder.parentFolder || "root";
            const tempFolderIdx = nextFolders.findIndex(f =>
                String(f.id).startsWith("VAL-") && f.title === folder.title && String(f.parentFolder) === String(cleanParentFolder)
            );
            if (tempFolderIdx !== -1) {
                const tempId = nextFolders[tempFolderIdx].id;
                nextFolders.splice(tempFolderIdx, 1);
                nextFiles.forEach(f => { if (f.parentFolder === tempId) f.parentFolder = cleanFolderId; });
                nextFolders.forEach(f => { if (f.parentFolder === tempId) f.parentFolder = cleanFolderId; });
            }
            const exists = nextFolders.some(f => String(f.id).trim() === cleanFolderId);
            if (!exists) {
                nextFolders.push({ id: cleanFolderId, title: folder.title, category: "Directory", parentFolder: cleanParentFolder, description: folder.description || "Imported from Drive", driveLink: folder.driveLink || "javascript:void(0)", assetType: "Folder" });
                newlyAddedCount++;
            } else {
                const idx = nextFolders.findIndex(f => String(f.id).trim() === cleanFolderId);
                nextFolders[idx] = { ...nextFolders[idx], title: folder.title, parentFolder: cleanParentFolder, description: folder.description || nextFolders[idx].description, driveLink: folder.driveLink || nextFolders[idx].driveLink };
            }
        });

        cloudFiles.forEach(file => {
            const cleanFileId = String(file.id).trim();
            const cleanParentFolder = file.parentFolder || "root";
            const tempFileIdx = nextFiles.findIndex(f =>
                String(f.id).startsWith("VAL-") && f.title === file.title && String(f.parentFolder) === String(cleanParentFolder)
            );
            if (tempFileIdx !== -1) nextFiles.splice(tempFileIdx, 1);
            const exists = nextFiles.some(f => String(f.id).trim() === cleanFileId);
            if (!exists) {
                nextFiles.push({ id: cleanFileId, title: file.title, category: file.category || "Other", parentFolder: cleanParentFolder, description: file.description || "Imported from Drive", driveLink: file.driveLink || "javascript:void(0)", assetType: "File", fileSize: file.fileSize || "N/A" });
                newlyAddedCount++;
            } else {
                const idx = nextFiles.findIndex(f => String(f.id).trim() === cleanFileId);
                nextFiles[idx] = { ...nextFiles[idx], title: file.title, category: file.category || nextFiles[idx].category, parentFolder: cleanParentFolder, description: file.description || nextFiles[idx].description, driveLink: file.driveLink || nextFiles[idx].driveLink, fileSize: file.fileSize || nextFiles[idx].fileSize };
            }
        });

        folderInventory = nextFolders;
        fileInventory = nextFiles;
        try {
            localStorage.setItem('vault_files_cache', JSON.stringify(fileInventory));
            localStorage.setItem('vault_folders_cache', JSON.stringify(folderInventory));
        } catch (e) {}

        renderVault();
        showToast(newlyAddedCount > 0 ? `Synced! Found ${newlyAddedCount} new items from Drive.` : "Sync complete. All items are up to date!", "success");

        // Background Firestore write-back
        const folderPromises = cloudFolders.map(async (folder) => {
            const cleanFolderId = String(folder.id).trim();
            const cleanParentFolder = folder.parentFolder || "root";
            try {
                await firestoreSet('folders', cleanFolderId, { title: folder.title, category: "Directory", parentFolder: cleanParentFolder, description: folder.description || "Imported from Drive", driveLink: folder.driveLink || "javascript:void(0)", assetType: "Folder" });
            } catch (e) { console.warn("Background folder sync warning:", e.message); }
        });

        const filePromises = cloudFiles.map(async (file) => {
            const cleanFileId = String(file.id).trim();
            const cleanParentFolder = file.parentFolder || "root";
            try {
                await firestoreSet('files', cleanFileId, { title: file.title, category: file.category || "Other", parentFolder: cleanParentFolder, description: file.description || "Imported from Drive", driveLink: file.driveLink || "javascript:void(0)", assetType: "File", fileSize: file.fileSize || "N/A" });
            } catch (e) { console.warn("Background file sync warning:", e.message); }
        });

        Promise.all([...folderPromises, ...filePromises]).catch(err => console.warn("Background Firebase sync warnings:", err));
    } catch (err) {
        console.error("Drive sync failed:", err);
        showToast("Drive Sync Failed: " + err.message, "error");
        showErrorModal("GOOGLE DRIVE SYNC FAILED", "Unable to retrieve files from your Google Apps Script backend.", [
            "Ensure your Apps Script Web App URL is correctly pasted at the top of app.js.",
            "Verify 'Who has access' is set to 'Anyone' and 'Execute as' is set to 'Me'.",
            "Authorize permissions inside your Apps Script editor.",
            "Check that your Apps Script template matches the setup code provided."
        ]);
    } finally {
        if (syncBtn) syncBtn.classList.remove('loading');
    }
};

// =========================================================================
// RENDER VAULT
// =========================================================================
function renderVault(filterTerm = "") {
    const grid = document.getElementById('vaultGrid');
    if (!grid) return;

    grid.innerHTML = "";
    const term = filterTerm.toLowerCase().trim();
    const urlParams = new URLSearchParams(window.location.search);
    const activeFolderId = urlParams.get('folder') || 'root';

    const homeBtn = document.getElementById('navHomeBtn');
    const backBtn = document.getElementById('navBackBtn');
    if (homeBtn) homeBtn.disabled = (activeFolderId === 'root');
    if (backBtn) backBtn.disabled = (activeFolderId === 'root');

    if (typeof updateClipboardUI === "function") updateClipboardUI();

    if (term.length > 0) {
        const breadcrumbsEl = document.getElementById('breadcrumbs');
        if (breadcrumbsEl) breadcrumbsEl.style.display = 'none';

        const matches = fileInventory.filter(doc =>
            (doc.title && doc.title.toLowerCase().includes(term)) ||
            (doc.category && doc.category.toLowerCase().includes(term)) ||
            (doc.description && doc.description.toLowerCase().includes(term))
        );

        if (matches.length === 0) {
            grid.innerHTML = `<p style="color:var(--text-muted)">No files matching your search query.</p>`;
            return;
        }

        matches.forEach(doc => {
            const card = document.createElement('div');
            card.className = 'doc-card';
            card.onclick = (e) => {
                if (e.target.closest('.card-options-container') || e.target.closest('.card-checkbox-wrapper')) return;
                openFileSystemFile(doc.driveLink, doc.title, doc.id);
            };
            const parentName = getActiveFolderName(doc.parentFolder || 'root');
            const isChecked = selectedItems.some(it => it.id === doc.id);
            card.innerHTML = `
                <div class="card-checkbox-wrapper" onclick="event.stopPropagation()">
                    <input type="checkbox" class="card-select-checkbox" data-id="${doc.id}" data-type="file" onchange="toggleCardSelection(this)" ${isChecked ? 'checked' : ''}>
                </div>
                <div class="file-icon">📄</div>
                <div class="doc-meta" style="flex:1;">
                    <h3 title="${doc.title || 'Unidentified Asset'}">${doc.title || 'Unidentified Asset'}</h3>
                    ${doc.category ? `<p><strong>Category Tag:</strong> ${doc.category}</p>` : ""}
                    <p><strong>Description:</strong> ${doc.description || "None"}</p>
                    <span class="tag-pill">📂 ${parentName}</span>
                </div>
                <div style="display:flex;align-items:center;gap:10px;">
                    <div class="card-options-container" onclick="event.stopPropagation()">
                        <button class="card-options-btn" onclick="toggleCardOptions(event,'match-${doc.id}')" title="More options">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1.5"></circle><circle cx="12" cy="5" r="1.5"></circle><circle cx="12" cy="19" r="1.5"></circle></svg>
                        </button>
                        <div id="match-${doc.id}-menu" class="options-dropdown-menu">
                            <button class="options-dropdown-item" onclick="viewDetails(event,'file','${doc.id}')">🔬 Details</button>
                            <button class="options-dropdown-item" onclick="triggerEdit(event,'file','${doc.id}')">📝 Edit</button>
                            <button class="options-dropdown-item" onclick="copyItem(event,'file','${doc.id}')">📋 Copy</button>
                            <button class="options-dropdown-item" onclick="triggerMove(event,'file','${doc.id}')">🚚 Move</button>
                            <button class="options-dropdown-item" onclick="triggerRename(event,'file','${doc.id}')">✏️ Rename</button>
                            <button class="options-dropdown-item" onclick="downloadFileDirectly(event,'${doc.id}')">💾 Download</button>
                            <button class="options-dropdown-item delete-item" onclick="triggerDelete(event,'file','${doc.id}')">🗑️ Delete</button>
                        </div>
                    </div>
                </div>`;
            grid.appendChild(card);
        });
        return;
    }

    const breadcrumbsEl = document.getElementById('breadcrumbs');
    if (breadcrumbsEl) breadcrumbsEl.style.display = 'flex';
    renderBreadcrumbs();

    const folders = folderInventory.filter(item => (item.parentFolder || 'root') === activeFolderId);
    const files = fileInventory.filter(item => (item.parentFolder || 'root') === activeFolderId);

    if (folders.length === 0 && files.length === 0) {
        grid.innerHTML = `<p style="color:var(--text-muted);padding:20px 0;">THIS FOLDER IS CURRENTLY EMPTY.</p>`;
        return;
    }

    folders.forEach(fold => {
        const fileCount = getFolderFileCount(fold.id);
        const isChecked = selectedItems.some(it => it.id === fold.id);
        const card = document.createElement('div');
        card.className = 'folder-card';
        card.onclick = (e) => {
            if (e.target.closest('.card-options-container') || e.target.closest('.card-checkbox-wrapper')) return;
            window.location.search = '?folder=' + fold.id;
        };
        card.innerHTML = `
            <div class="card-checkbox-wrapper" onclick="event.stopPropagation()">
                <input type="checkbox" class="card-select-checkbox" data-id="${fold.id}" data-type="folder" onchange="toggleCardSelection(this)" ${isChecked ? 'checked' : ''}>
            </div>
            <div class="folder-icon">📁</div>
            <div class="folder-meta">
                <h3 title="${fold.title}">${fold.title}</h3>
                <p>${fileCount} ${fileCount === 1 ? 'item' : 'items'}</p>
            </div>
            <div class="card-options-container" onclick="event.stopPropagation()">
                <button class="card-options-btn" onclick="toggleCardOptions(event,'fold-${fold.id}')" title="More options">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1.5"></circle><circle cx="12" cy="5" r="1.5"></circle><circle cx="12" cy="19" r="1.5"></circle></svg>
                </button>
                <div id="fold-${fold.id}-menu" class="options-dropdown-menu">
                    <button class="options-dropdown-item" onclick="viewDetails(event,'folder','${fold.id}')">🔬 Details</button>
                    <button class="options-dropdown-item" onclick="triggerEdit(event,'folder','${fold.id}')">📝 Edit</button>
                    <button class="options-dropdown-item" onclick="copyItem(event,'folder','${fold.id}')">📋 Copy</button>
                    <button class="options-dropdown-item" onclick="triggerMove(event,'folder','${fold.id}')">🚚 Move</button>
                    <button class="options-dropdown-item" onclick="triggerRename(event,'folder','${fold.id}')">✏️ Rename</button>
                    <button class="options-dropdown-item delete-item" onclick="triggerDelete(event,'folder','${fold.id}')">🗑️ Delete</button>
                </div>
            </div>`;
        grid.appendChild(card);
    });

    files.forEach(doc => {
        const isChecked = selectedItems.some(it => it.id === doc.id);
        const card = document.createElement('div');
        card.className = 'doc-card';
        card.onclick = (e) => {
            if (e.target.closest('.card-options-container') || e.target.closest('.card-checkbox-wrapper')) return;
            openFileSystemFile(doc.driveLink, doc.title, doc.id);
        };
        card.innerHTML = `
            <div class="card-checkbox-wrapper" onclick="event.stopPropagation()">
                <input type="checkbox" class="card-select-checkbox" data-id="${doc.id}" data-type="file" onchange="toggleCardSelection(this)" ${isChecked ? 'checked' : ''}>
            </div>
            <div class="file-icon">📄</div>
            <div class="doc-meta" style="flex:1;">
                <h3 title="${doc.title || 'Unidentified Asset'}">${doc.title || 'Unidentified Asset'}</h3>
                ${doc.category ? `<p><strong>Category Tag:</strong> ${doc.category}</p>` : ""}
                <p><strong>Description:</strong> ${doc.description || "None"}</p>
                <span class="tag-pill">📂 ${getActiveFolderName(activeFolderId)}</span>
            </div>
            <div style="display:flex;align-items:center;gap:10px;">
                <div class="card-options-container" onclick="event.stopPropagation()">
                    <button class="card-options-btn" onclick="toggleCardOptions(event,'file-${doc.id}')" title="More options">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1.5"></circle><circle cx="12" cy="5" r="1.5"></circle><circle cx="12" cy="19" r="1.5"></circle></svg>
                    </button>
                    <div id="file-${doc.id}-menu" class="options-dropdown-menu">
                        <button class="options-dropdown-item" onclick="viewDetails(event,'file','${doc.id}')">🔬 Details</button>
                        <button class="options-dropdown-item" onclick="triggerEdit(event,'file','${doc.id}')">📝 Edit</button>
                        <button class="options-dropdown-item" onclick="copyItem(event,'file','${doc.id}')">📋 Copy</button>
                        <button class="options-dropdown-item" onclick="triggerMove(event,'file','${doc.id}')">🚚 Move</button>
                        <button class="options-dropdown-item" onclick="triggerRename(event,'file','${doc.id}')">✏️ Rename</button>
                        <button class="options-dropdown-item" onclick="downloadFileDirectly(event,'${doc.id}')">💾 Download</button>
                        <button class="options-dropdown-item delete-item" onclick="triggerDelete(event,'file','${doc.id}')">🗑️ Delete</button>
                    </div>
                </div>
            </div>`;
        grid.appendChild(card);
    });
}

// =========================================================================
// CATEGORY POPULATE
// =========================================================================
function populateCategoryOptions() {
    const categoryInput = document.getElementById('fileCategory');
    const categoryDisplay = document.getElementById('fileCategoryDisplay');
    if (!categoryInput) return;
    const urlParams = new URLSearchParams(window.location.search);
    const activeFolderId = urlParams.get('folder') || 'root';
    categoryInput.value = activeFolderId;
    if (categoryDisplay) {
        categoryDisplay.value = activeFolderId === 'root' ? "📁 ROOT" : ("📁 " + getActiveFolderName(activeFolderId).toUpperCase());
    }
}

// =========================================================================
// FOLDER CREATION
// =========================================================================
function createCustomFolder(folderName) {
    const sanitized = folderName.replace(/\//g, "").trim();
    if (!sanitized) return;
    const urlParams = new URLSearchParams(window.location.search);
    const parentId = urlParams.get('folder') || 'root';
    const generatedId = "VAL-" + Math.floor(1000 + Math.random() * 9000);
    const payload = {
        id: generatedId, folderName: sanitized, fileName: sanitized, title: sanitized, name: sanitized,
        fileType: 'application/x-folder', fileCategory: 'Directory', category: 'Directory',
        fileDescription: 'Virtual folder partition created via UI', description: 'Virtual folder partition created via UI',
        fileBase64: 'EMPTY_FOLDER', parentFolder: parentId, assetType: 'Folder', driveLink: 'javascript:void(0)'
    };
    const submitFolderBtn = document.getElementById('submitFolderBtn');
    if (submitFolderBtn) { submitFolderBtn.disabled = true; submitFolderBtn.innerText = "PROVISIONING..."; }
    transmitToCloud(payload, submitFolderBtn || { disabled: false, innerText: "" }).then((success) => {
        if (success) closeFolderModal();
    });
}

// =========================================================================
// LOCAL SAVE HELPER
// =========================================================================
function saveLocalUpload(name, type, category, parentFolder, description, base64Data, assetType = 'File', predefinedId = null, predefinedDriveLink = null, fileSize = 'N/A') {
    const newId = predefinedId || ("VAL-" + Math.floor(1000 + Math.random() * 9000));
    const dataUrl = predefinedDriveLink || 'javascript:void(0)';
    const newDoc = { id: newId, title: name, category, parentFolder: parentFolder || 'root', description, driveLink: dataUrl, assetType, fileSize };
    if (assetType === 'Folder') {
        const idx = folderInventory.findIndex(doc => doc.id === newId);
        if (idx === -1) folderInventory.push(newDoc); else folderInventory[idx] = newDoc;
    } else {
        const idx = fileInventory.findIndex(doc => doc.id === newId);
        if (idx === -1) fileInventory.push(newDoc); else fileInventory[idx] = newDoc;
    }
    renderVault();
}

// =========================================================================
// CLOUD TRANSMISSION
// =========================================================================
async function transmitToCloud(payload, buttonElement) {
    const customId = payload.id || ("VAL-" + Math.floor(1000 + Math.random() * 9000));
    const customName = payload.fileName;
    const categoryTag = payload.fileCategory;
    const description = payload.fileDescription || (document.getElementById('fileDescription') ? document.getElementById('fileDescription').value : '');
    const parentFolderId = payload.parentFolder || (document.getElementById('fileCategory') ? document.getElementById('fileCategory').value : 'root') || 'root';
    const assetType = payload.assetType || (payload.fileBase64 === 'EMPTY_FOLDER' ? 'Folder' : 'File');
    const fileSize = payload.fileSize || 'N/A';
    const originalText = buttonElement.id === 'submitFolderBtn' ? 'Add' : 'Upload';

    try {
        const completePayload = {
            ...payload, id: customId, title: customName, folderName: customName, fileName: customName, name: customName,
            category: assetType === 'Folder' ? 'Directory' : categoryTag,
            fileCategory: assetType === 'Folder' ? 'Directory' : categoryTag,
            description, fileDescription: description, parentFolder: parentFolderId,
            parenFolder: parentFolderId, assetType, driveLink: payload.driveLink || 'javascript:void(0)'
        };

        let finalDriveLink = payload.driveLink || 'javascript:void(0)';
        let finalDriveId = customId;

        if (BACKEND_API_URL && !BACKEND_API_URL.startsWith("PASTE_")) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 12000);
            try {
                const response = await fetch(BACKEND_API_URL, {
                    method: "POST", body: JSON.stringify(completePayload), signal: controller.signal
                });
                clearTimeout(timeoutId);
                if (response.ok) {
                    const resData = await response.json();
                    if (resData.status === "SUCCESS") {
                        finalDriveLink = resData.driveLink || finalDriveLink;
                        if (resData.driveId) finalDriveId = resData.driveId;
                    }
                }
            } catch (backendErr) {
                clearTimeout(timeoutId);
                console.warn("Apps Script sync bypassed (saving to Firestore only):", backendErr.message);
            }
        }

        const collName = assetType === 'Folder' ? 'folders' : 'files';
        const docPayload = {
            id: finalDriveId, title: customName,
            category: assetType === 'Folder' ? 'Directory' : (categoryTag || "Other"),
            parentFolder: parentFolderId, description, driveLink: finalDriveLink, assetType,
            createdAt: new Date().toISOString()
        };
        if (assetType === 'File') docPayload.fileSize = fileSize;

        await firestoreSet(collName, finalDriveId, docPayload);

        if (assetType === 'Folder') {
            saveLocalUpload(customName, 'application/x-folder', 'Directory', parentFolderId, description, 'EMPTY_FOLDER', 'Folder', finalDriveId, finalDriveLink, 'N/A');
            showToast(`Directory "${customName}" added successfully!`, "success");
        } else {
            saveLocalUpload(customName, payload.fileType || "application/octet-stream", categoryTag, parentFolderId, description, payload.fileBase64, 'File', finalDriveId, finalDriveLink, fileSize);
            showToast(`File "${customName}" uploaded successfully!`, "success");
        }
        closeModal();
        const uploadForm = document.getElementById('uploadForm');
        if (uploadForm) uploadForm.reset();
        fetchDatabase();
        return true;
    } catch (error) {
        console.error("Cloud transmission failed:", error);
        showToast("Upload Failed! Check console for details.", "error");
        showErrorModal("FILE TRANSMISSION FAILURE", `Unable to upload "${customName}".`, [
            "Ensure your Google Apps Script URL is correct and ends with /exec",
            "Ensure the Apps Script is deployed as a Web App with access set to 'Anyone'.",
            "Ensure you have authorized all permissions when deploying the Apps Script.",
            "Check that TARGET_DRIVE_FOLDER_ID in your Apps Script is correct and writable."
        ]);
        return false;
    } finally {
        buttonElement.disabled = false;
        buttonElement.innerText = originalText;
    }
}

// =========================================================================
// UPLOAD FORM SUBMIT
// =========================================================================
document.getElementById('uploadForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const submitBtn = document.getElementById('submitBtn');
    const fileInput = document.getElementById('fileInput');
    const urlParams = new URLSearchParams(window.location.search);
    const activeFolderId = urlParams.get('folder') || 'root';
    const files = fileInput.files;

    if (!files || files.length === 0) return;

    const categoryTag = document.getElementById('fileCategoryTagInput').value.trim() || "Other";
    const description = document.getElementById('fileDescription').value;
    submitBtn.disabled = true;

    const formatBytes = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        let customName = file.name;
        if (files.length === 1) customName = document.getElementById('fileNameInput').value.trim() || file.name;
        submitBtn.innerText = `UPLOADING [${i + 1}/${files.length}]: ${file.name.substring(0, 15)}...`;
        try {
            const base64String = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.onerror = (err) => reject(err);
            });
            const generatedId = "VAL-" + Math.floor(1000 + Math.random() * 9000);
            const payload = {
                id: generatedId, folderName: customName, fileName: customName, title: customName, name: customName,
                fileType: file.type, fileCategory: categoryTag, category: categoryTag,
                fileDescription: description, description, fileBase64: base64String,
                parentFolder: activeFolderId, assetType: 'File', driveLink: 'javascript:void(0)',
                fileSize: formatBytes(file.size)
            };
            await transmitToCloud(payload, submitBtn);
        } catch (err) {
            console.error(`Error uploading ${file.name}:`, err);
        }
    }
});

// Folder form submit
document.getElementById('folderForm').addEventListener('submit', function (e) {
    e.preventDefault();
    const input = document.getElementById('folderNameInput');
    const folderName = input.value.trim();
    if (folderName) createCustomFolder(folderName);
});

// Auto-fill filename from file picker
const fileInputEl = document.getElementById('fileInput');
if (fileInputEl) {
    fileInputEl.addEventListener('change', function () {
        const nameInput = document.getElementById('fileNameInput');
        if (nameInput && this.files && this.files[0]) {
            const fullName = this.files[0].name;
            const lastDotIndex = fullName.lastIndexOf('.');
            nameInput.value = lastDotIndex !== -1 ? fullName.substring(0, lastDotIndex) : fullName;
        }
    });
}

// =========================================================================
// DROPDOWN / MODAL CONTROLS
// =========================================================================
window.toggleDropdown = function (event) {
    event.stopPropagation();
    document.getElementById('addDropdown').classList.toggle('active');
};
window.triggerNewFile = function (event) {
    event.stopPropagation();
    document.getElementById('addDropdown').classList.remove('active');
    openModal();
};
window.triggerNewFolder = function (event) {
    event.stopPropagation();
    document.getElementById('addDropdown').classList.remove('active');
    openFolderModal();
};
window.openModal = function () { populateCategoryOptions(); document.getElementById('uploadModal').classList.add('active'); };
window.closeModal = function () { document.getElementById('uploadModal').classList.remove('active'); document.getElementById('uploadForm').reset(); };
window.openFolderModal = function () { document.getElementById('folderModal').classList.add('active'); document.getElementById('folderNameInput').focus(); };
window.closeFolderModal = function () { document.getElementById('folderModal').classList.remove('active'); document.getElementById('folderForm').reset(); };

document.addEventListener('click', function (e) {
    const dropdown = document.getElementById('addDropdown');
    if (dropdown) dropdown.classList.remove('active');
    document.querySelectorAll('.options-dropdown-menu').forEach(menu => {
        const container = menu.closest('.card-options-container');
        if (container && !container.contains(e.target)) menu.classList.remove('active');
    });
});

document.getElementById('searchBox').addEventListener('input', (e) => renderVault(e.target.value));

// =========================================================================
// GOOGLE DRIVE EMBED URL HELPERS
// =========================================================================
function getGoogleDriveEmbedUrl(url) {
    if (!url) return "";
    const cleanUrl = url.trim().replace(/^["']|["']$/g, "");
    let fileId = "";
    const fileDMatch = cleanUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileDMatch) fileId = fileDMatch[1];
    if (!fileId && cleanUrl.includes("id=")) {
        const idMatch = cleanUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (idMatch) fileId = idMatch[1];
    }
    if (!fileId) {
        const docMatch = cleanUrl.match(/\/(document|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]+)/);
        if (docMatch) return `https://docs.google.com/${docMatch[1]}/d/${docMatch[2]}/preview`;
    }
    return fileId ? `https://drive.google.com/file/d/${fileId}/preview` : cleanUrl;
}

function getGoogleDriveDownloadUrl(url) {
    if (!url) return "";
    const cleanUrl = url.trim().replace(/^["']|["']$/g, "");
    let fileId = "";
    const fileDMatch = cleanUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileDMatch) fileId = fileDMatch[1];
    if (!fileId && cleanUrl.includes("id=")) {
        const idMatch = cleanUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (idMatch) fileId = idMatch[1];
    }
    if (!fileId) {
        const docMatch = cleanUrl.match(/\/(document|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]+)/);
        if (docMatch) {
            const type = docMatch[1], docId = docMatch[2];
            if (type === 'document') return `https://docs.google.com/document/d/${docId}/export?format=pdf`;
            if (type === 'spreadsheets') return `https://docs.google.com/spreadsheets/d/${docId}/export?format=xlsx`;
            if (type === 'presentation') return `https://docs.google.com/presentation/d/${docId}/export/pdf`;
        }
    }
    return fileId ? `https://drive.google.com/uc?export=download&id=${fileId}` : cleanUrl;
}

window.triggerDirectFileDownload = function (driveLink, title) {
    if (!driveLink) return;
    const cleanLink = driveLink.trim().replace(/^["']|["']$/g, "");
    const safeTitle = typeof title === 'string' ? title : String(title || "document");
    if (cleanLink.startsWith("data:")) {
        const link = document.createElement("a");
        link.href = cleanLink; link.download = safeTitle;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    } else if (cleanLink.startsWith("javascript:")) {
        showErrorModal("Google Drive Link Pending",
            `"${safeTitle}" doesn't have a Drive link yet. Sync with Google Drive first.`,
            ["Click the green sync button to fetch Drive links.", "Ensure your Apps Script URL is configured."]);
    } else {
        const hiddenIframe = document.createElement("iframe");
        hiddenIframe.style.display = "none";
        hiddenIframe.src = getGoogleDriveDownloadUrl(cleanLink);
        document.body.appendChild(hiddenIframe);
        setTimeout(() => { if (hiddenIframe.parentNode) document.body.removeChild(hiddenIframe); }, 5000);
    }
};

// =========================================================================
// FILE VIEWER
// =========================================================================
window.openFileSystemFile = function (driveLink, title) {
    if (!driveLink) return;
    const downloadBtn = document.getElementById('viewerDownloadBtn');
    const openTabBtn = document.getElementById('viewerOpenTabBtn');
    const viewerTitle = document.getElementById('viewerTitle');
    const viewerBody = document.getElementById('viewerBody');
    const safeTitle = typeof title === 'string' ? title : String(title || "DOCUMENT");
    if (viewerTitle) viewerTitle.innerText = `Preview: ${safeTitle}`;
    if (downloadBtn) downloadBtn.onclick = function () { triggerDirectFileDownload(driveLink, safeTitle); };
    if (openTabBtn) {
        const cleanLink = driveLink.trim().replace(/^["']|["']$/g, "");
        openTabBtn.onclick = function () {
            if (cleanLink.startsWith("javascript:")) showToast("Drive Link Pending! Try syncing first.", "error");
            else window.open(cleanLink, "_blank");
        };
        openTabBtn.style.display = cleanLink.startsWith("data:") ? "none" : "inline-block";
    }
    if (viewerBody) {
        viewerBody.innerHTML = `<div class="viewer-loading-spinner"><div>🔄 Loading Preview...</div></div>`;
        setTimeout(() => {
            const cleanLink = driveLink.trim().replace(/^["']|["']$/g, "");
            if (cleanLink.startsWith("data:")) {
                const mediaType = cleanLink.split(';')[0].substring(5);
                if (mediaType.startsWith("image/")) {
                    viewerBody.innerHTML = `<img src="${cleanLink}" class="viewer-img" alt="${safeTitle}" />`;
                } else if (mediaType.startsWith("text/") || mediaType === "application/json") {
                    try {
                        const decoded = atob(cleanLink.split(',')[1]);
                        viewerBody.innerHTML = `<pre class="viewer-code-container"><code>${escapeHTML(decoded)}</code></pre>`;
                    } catch (err) {
                        viewerBody.innerHTML = `<iframe src="${cleanLink}" class="viewer-iframe" allowfullscreen></iframe>`;
                    }
                } else {
                    viewerBody.innerHTML = `<iframe src="${cleanLink}" class="viewer-iframe" allowfullscreen></iframe>`;
                }
            } else if (cleanLink.startsWith("javascript:")) {
                viewerBody.innerHTML = `
                    <div class="viewer-code-container" style="color:#38bdf8;padding:24px;font-family:monospace;">
                        <div style="border:1px solid #1e293b;padding:16px;border-radius:4px;background:#030712;line-height:1.6;">
                            <p style="color:#64748b;">// Drive link not yet synced //</p>
                            <p style="color:#e2e8f0;margin-top:10px;"><strong>File:</strong> ${safeTitle}</p>
                            <p style="margin-top:8px;">Click the green <strong>↓ Sync Drive</strong> button to fetch the live Google Drive link for this file.</p>
                        </div>
                    </div>`;
            } else {
                const embedUrl = getGoogleDriveEmbedUrl(cleanLink);
                viewerBody.innerHTML = `<iframe src="${embedUrl}" class="viewer-iframe" allow="autoplay; encrypted-media" allowfullscreen="true" referrerpolicy="no-referrer"></iframe>`;
            }
        }, 300);
    }
    document.getElementById('viewerModal').classList.add('active');
};

window.closeViewerModal = function () {
    const viewerBody = document.getElementById('viewerBody');
    if (viewerBody) viewerBody.innerHTML = "";
    document.getElementById('viewerModal').classList.remove('active');
};

function escapeHTML(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// =========================================================================
// CONTEXT MENU TOGGLE
// =========================================================================
window.toggleCardOptions = function (event, menuId) {
    event.stopPropagation();
    const targetMenu = document.getElementById(menuId + '-menu');
    const isActive = targetMenu && targetMenu.classList.contains('active');
    document.querySelectorAll('.options-dropdown-menu').forEach(menu => menu.classList.remove('active'));
    if (targetMenu && !isActive) targetMenu.classList.add('active');
};

// =========================================================================
// DETAILS MODAL
// =========================================================================
window.viewDetails = function (event, type, id) {
    if (event) event.stopPropagation();
    document.querySelectorAll('.options-dropdown-menu').forEach(menu => menu.classList.remove('active'));
    const contentEl = document.getElementById('detailsContent');
    if (!contentEl) return;
    if (type === 'folder') {
        const folderDoc = folderInventory.find(item => item.id === id);
        const title = folderDoc ? folderDoc.title : "Unknown";
        const parent = folderDoc ? (folderDoc.parentFolder || 'root') : 'root';
        const count = getFolderFileCount(id);
        contentEl.innerHTML = `
            <div class="details-row"><span class="details-key">Entry Type</span><span class="details-val">📁 FOLDER</span></div>
            <div class="details-row"><span class="details-key">Folder Name</span><span class="details-val" style="color:var(--accent);font-weight:bold;">${title}</span></div>
            <div class="details-row"><span class="details-key">Parent Folder</span><span class="details-val">${getActiveFolderName(parent)}</span></div>
            <div class="details-row"><span class="details-key">Item Count</span><span class="details-val">${count} item(s)</span></div>`;
    } else {
        const doc = fileInventory.find(item => item.id === id);
        if (!doc) return;
        const isCloud = doc.driveLink && !doc.driveLink.startsWith("javascript:") && !doc.driveLink.startsWith("data:");
        contentEl.innerHTML = `
            <div class="details-row"><span class="details-key">Entry Type</span><span class="details-val">📄 Document File</span></div>
            <div class="details-row"><span class="details-key">Asset Name</span><span class="details-val" style="color:var(--accent);font-weight:bold;">${doc.title || "Unknown"}</span></div>
            <div class="details-row"><span class="details-key">File Size</span><span class="details-val" style="font-family:var(--font-mono);color:var(--accent);">${doc.fileSize || "N/A"}</span></div>
            <div class="details-row"><span class="details-key">Storage</span><span class="details-val">${isCloud ? "🌐 Google Drive" : "⏳ Pending Drive Sync"}</span></div>
            <div class="details-row"><span class="details-key">Category</span><span class="details-val">${doc.category || "Other"}</span></div>
            <div class="details-row"><span class="details-key">Description</span><span class="details-val">${doc.description || "None"}</span></div>`;
    }
    document.getElementById('detailsModal').classList.add('active');
};
window.closeDetailsModal = function () { document.getElementById('detailsModal').classList.remove('active'); };

// =========================================================================
// EDIT MODAL
// =========================================================================
window.triggerEdit = function (event, type, id) {
    if (event) event.stopPropagation();
    document.querySelectorAll('.options-dropdown-menu').forEach(menu => menu.classList.remove('active'));
    document.getElementById('editTargetType').value = type;
    document.getElementById('editTargetId').value = id;
    const nameInput = document.getElementById('editItemName');
    const categoryInput = document.getElementById('editItemCategory');
    const categoryGroup = document.getElementById('editItemCategoryGroup');
    const descriptionInput = document.getElementById('editItemDescription');
    const doc = type === 'folder' ? folderInventory.find(item => item.id === id) : fileInventory.find(item => item.id === id);
    if (!doc) { showToast("Item not found.", "error"); return; }
    if (nameInput) nameInput.value = doc.title || "";
    if (descriptionInput) descriptionInput.value = doc.description || "";
    if (type === 'folder') { if (categoryGroup) categoryGroup.style.display = 'none'; }
    else { if (categoryGroup) categoryGroup.style.display = 'block'; if (categoryInput) categoryInput.value = doc.category || "Other"; }
    document.getElementById('editModal').classList.add('active');
    if (nameInput) nameInput.focus();
};
window.closeEditModal = function () { document.getElementById('editModal').classList.remove('active'); document.getElementById('editForm').reset(); };

document.getElementById('editForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const type = document.getElementById('editTargetType').value;
    const targetId = document.getElementById('editTargetId').value;
    const newName = document.getElementById('editItemName').value.trim();
    const newCategory = type === 'file' ? document.getElementById('editItemCategory').value.trim() : 'Directory';
    const newDescription = document.getElementById('editItemDescription').value.trim();
    if (!newName) return;
    const item = type === 'folder' ? folderInventory.find(doc => doc.id === targetId) : fileInventory.find(doc => doc.id === targetId);
    if (!item) { showToast("Update failed: item not found.", "error"); closeEditModal(); return; }
    const submitEditBtn = document.getElementById('submitEditBtn');
    if (submitEditBtn) { submitEditBtn.disabled = true; submitEditBtn.innerText = "SAVING..."; }
    try {
        const collName = type === 'folder' ? 'folders' : 'files';
        const patchData = { title: newName, description: newDescription };
        if (type === 'file') patchData.category = newCategory;
        await firestoreUpdate(collName, targetId, patchData);
        if (type === 'file') {
            fileInventory.forEach(doc => { if (doc.id === targetId) { doc.title = newName; doc.category = newCategory; doc.description = newDescription; } });
        } else {
            folderInventory.forEach(doc => { if (doc.id === targetId) { doc.title = newName; doc.description = newDescription; } });
        }
        showToast("Metadata updated successfully!", "success");
        closeEditModal();
        renderVault();
    } catch (err) {
        console.error("Metadata update failure:", err);
        showToast("Update failed!", "error");
    } finally {
        if (submitEditBtn) { submitEditBtn.disabled = false; submitEditBtn.innerText = "Update"; }
    }
});

// =========================================================================
// RENAME MODAL
// =========================================================================
window.triggerRename = function (event, type, id) {
    if (event) event.stopPropagation();
    document.querySelectorAll('.options-dropdown-menu').forEach(menu => menu.classList.remove('active'));
    document.getElementById('renameTargetType').value = type;
    document.getElementById('renameTargetId').value = id;
    const renameInput = document.getElementById('renameInput');
    const renameLabel = document.getElementById('renameLabel');
    const doc = type === 'folder' ? folderInventory.find(item => item.id === id) : fileInventory.find(item => item.id === id);
    const oldTitle = doc ? doc.title : "";
    document.getElementById('renameTargetOldName').value = oldTitle;
    renameLabel.innerText = type === 'folder' ? "NEW FOLDER NAME" : "NEW DOCUMENT FILENAME";
    if (renameInput) { renameInput.value = oldTitle; }
    document.getElementById('renameModal').classList.add('active');
    if (renameInput) renameInput.focus();
};
window.closeRenameModal = function () { document.getElementById('renameModal').classList.remove('active'); document.getElementById('renameForm').reset(); };

document.getElementById('renameForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const type = document.getElementById('renameTargetType').value;
    const targetId = document.getElementById('renameTargetId').value;
    const newName = document.getElementById('renameInput').value.trim();
    if (!newName) return;
    const item = type === 'folder' ? folderInventory.find(doc => doc.id === targetId) : fileInventory.find(doc => doc.id === targetId);
    if (!item) { showToast("Rename failed: item not found.", "error"); closeRenameModal(); return; }
    const submitRenameBtn = document.getElementById('submitRenameBtn');
    if (submitRenameBtn) { submitRenameBtn.disabled = true; submitRenameBtn.innerText = "RENAMING..."; }
    try {
        if (BACKEND_API_URL && !BACKEND_API_URL.startsWith("PASTE_") && item.driveLink && !item.driveLink.startsWith("javascript:")) {
            const renamePayload = { action: "rename", id: targetId, title: newName, fileName: newName, folderName: newName, name: newName, assetType: type === 'folder' ? 'Folder' : 'File', driveLink: item.driveLink };
            fetch(BACKEND_API_URL, { method: "POST", body: JSON.stringify(renamePayload) }).catch(() => {});
        }
        const collName = type === 'folder' ? 'folders' : 'files';
        await firestoreUpdate(collName, targetId, { title: newName });
        fileInventory.forEach(doc => { if (doc.id === targetId) doc.title = newName; });
        folderInventory.forEach(doc => { if (doc.id === targetId) doc.title = newName; });
        showToast(`Renamed to "${newName}"!`, "success");
        closeRenameModal();
        renderVault();
    } catch (err) {
        console.error("Rename failure:", err);
        showToast("Rename failed!", "error");
    } finally {
        if (submitRenameBtn) { submitRenameBtn.disabled = false; submitRenameBtn.innerText = "Rename"; }
    }
});

// =========================================================================
// DOWNLOAD
// =========================================================================
window.downloadFileDirectly = function (event, id) {
    if (event) event.stopPropagation();
    document.querySelectorAll('.options-dropdown-menu').forEach(menu => menu.classList.remove('active'));
    const doc = fileInventory.find(item => item.id === id);
    if (doc) triggerDirectFileDownload(doc.driveLink, doc.title);
};

// =========================================================================
// DELETE MODAL
// =========================================================================
function getNestedItemsToDelete(folderId) {
    const resultIds = new Set([folderId]);
    let previousSize = 0;
    while (previousSize !== resultIds.size) {
        previousSize = resultIds.size;
        fileInventory.forEach(item => { if (item.parentFolder && resultIds.has(item.parentFolder)) resultIds.add(item.id); });
        folderInventory.forEach(item => { if (item.parentFolder && resultIds.has(item.parentFolder)) resultIds.add(item.id); });
    }
    return Array.from(resultIds);
}

window.triggerDelete = function (event, type, id) {
    if (event) event.stopPropagation();
    document.querySelectorAll('.options-dropdown-menu').forEach(menu => menu.classList.remove('active'));
    document.getElementById('deleteTargetType').value = type;
    document.getElementById('deleteTargetId').value = id;
    const promptEl = document.getElementById('deletePromptMessage');
    const doc = type === 'folder' ? folderInventory.find(item => item.id === id) : fileInventory.find(item => item.id === id);
    const title = doc ? doc.title : "Unknown";
    promptEl.innerHTML = type === 'folder'
        ? `You are about to permanently delete the folder <strong style="color:var(--accent);">${title}</strong> and ALL its contents.`
        : `You are about to permanently delete <strong style="color:var(--accent);">${title}</strong>.`;
    document.getElementById('deleteModal').classList.add('active');
};
window.closeDeleteModal = function () { document.getElementById('deleteModal').classList.remove('active'); document.getElementById('deleteForm').reset(); };

document.getElementById('deleteForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const type = document.getElementById('deleteTargetType').value;
    const targetId = document.getElementById('deleteTargetId').value;
    const submitBtn = document.getElementById('submitDeleteBtn');

    async function driveDelete(items) {
        if (!BACKEND_API_URL || BACKEND_API_URL.startsWith("PASTE_")) return;
        await Promise.all(items.map(item =>
            fetch(BACKEND_API_URL, { method: "POST", body: JSON.stringify({ action: "delete", id: item.id, assetType: item.assetType, driveLink: item.driveLink || "javascript:void(0)" }) }).catch(() => {})
        ));
    }

    if (type === 'multi') {
        const itemsToDelete = JSON.parse(targetId);
        submitBtn.disabled = true;
        submitBtn.innerText = `PURGING ${itemsToDelete.length} ITEMS...`;
        const allIdsToDelete = new Set();
        const filesToDelete = [], foldersToDelete = [];
        for (const item of itemsToDelete) {
            if (item.type === 'file') {
                const doc = fileInventory.find(it => it.id === item.id);
                if (doc) { filesToDelete.push(doc); allIdsToDelete.add(doc.id); }
            } else {
                getNestedItemsToDelete(item.id).forEach(id => {
                    allIdsToDelete.add(id);
                    const f = folderInventory.find(it => it.id === id);
                    if (f && !foldersToDelete.find(x => x.id === id)) foldersToDelete.push(f);
                    const fl = fileInventory.find(it => it.id === id);
                    if (fl && !filesToDelete.find(x => x.id === id)) filesToDelete.push(fl);
                });
            }
        }
        try {
            await driveDelete([...filesToDelete.map(d => ({ ...d, assetType: 'File' })), ...foldersToDelete.map(d => ({ ...d, assetType: 'Folder' }))]);
            await Promise.all([
                ...filesToDelete.map(d => firestoreDelete('files', d.id).catch(err => console.warn(err))),
                ...foldersToDelete.map(d => firestoreDelete('folders', d.id).catch(err => console.warn(err)))
            ]);
            fileInventory = fileInventory.filter(doc => !allIdsToDelete.has(doc.id));
            folderInventory = folderInventory.filter(doc => !allIdsToDelete.has(doc.id));
            showToast(`Deleted ${itemsToDelete.length} items!`, "success");
            closeDeleteModal(); clearSelected(); renderVault();
        } catch (err) {
            showToast("Multi-delete failed!", "error");
        } finally {
            submitBtn.disabled = false; submitBtn.innerText = "Confirm";
        }
        return;
    }

    if (type === 'file') {
        const doc = fileInventory.find(item => item.id === targetId);
        if (!doc) { showToast("File not found.", "error"); closeDeleteModal(); return; }
        submitBtn.disabled = true; submitBtn.innerText = "DELETING...";
        try {
            await driveDelete([{ ...doc, assetType: 'File' }]);
            await firestoreDelete('files', targetId);
            fileInventory = fileInventory.filter(item => item.id !== targetId);
            showToast(`"${doc.title}" deleted!`, "success");
            closeDeleteModal(); renderVault();
        } catch (err) {
            showToast("Delete failed!", "error");
        } finally {
            submitBtn.disabled = false; submitBtn.innerText = "Confirm";
        }
    } else if (type === 'folder') {
        const docFolder = folderInventory.find(item => item.id === targetId);
        if (!docFolder) { showToast("Folder not found.", "error"); closeDeleteModal(); return; }
        const idsToDelete = getNestedItemsToDelete(targetId);
        const filesToDelete = fileInventory.filter(item => idsToDelete.includes(item.id));
        const foldersToDelete = folderInventory.filter(item => idsToDelete.includes(item.id));
        submitBtn.disabled = true; submitBtn.innerText = `PURGING...`;
        try {
            await driveDelete([...filesToDelete.map(d => ({ ...d, assetType: 'File' })), ...foldersToDelete.map(d => ({ ...d, assetType: 'Folder' }))]);
            await Promise.all([
                ...filesToDelete.map(d => firestoreDelete('files', d.id).catch(err => console.warn(err))),
                ...foldersToDelete.map(d => firestoreDelete('folders', d.id).catch(err => console.warn(err))),
                firestoreDelete('folders', targetId).catch(err => console.warn(err))
            ]);
            const allIds = new Set(idsToDelete);
            fileInventory = fileInventory.filter(doc => !allIds.has(doc.id));
            folderInventory = folderInventory.filter(doc => !allIds.has(doc.id));
            showToast(`Folder "${docFolder.title}" deleted!`, "success");
            closeDeleteModal(); renderVault();
        } catch (err) {
            showToast("Folder delete failed!", "error");
        } finally {
            submitBtn.disabled = false; submitBtn.innerText = "Confirm";
        }
    }
});

// =========================================================================
// CLIPBOARD
// =========================================================================
let clipboard = null;
try { clipboard = JSON.parse(sessionStorage.getItem("vault_clipboard_storage")); } catch (e) {}

window.updateClipboardUI = function () {
    const pasteBtn = document.getElementById('navPasteBtn');
    const notice = document.getElementById('clipboardNotice');
    const itemNameSpan = document.getElementById('clipboardItemName');
    let isHidden = false;
    try { isHidden = sessionStorage.getItem("vault_clipboard_hidden") === "true"; } catch (e) {}
    if (clipboard && clipboard.name && !isHidden) {
        if (pasteBtn) { pasteBtn.disabled = false; pasteBtn.title = `Paste: ${clipboard.name}`; }
        if (notice) {
            notice.style.display = "inline-block";
            if (itemNameSpan) itemNameSpan.innerText = clipboard.name.length > 25 ? clipboard.name.substring(0, 22) + "..." : clipboard.name;
        }
    } else {
        if (pasteBtn) { pasteBtn.disabled = true; pasteBtn.title = "Paste Copied Item"; }
        if (notice) notice.style.display = "none";
    }
};

window.copyItem = function (event, type, id) {
    if (event) event.stopPropagation();
    document.querySelectorAll('.options-dropdown-menu').forEach(menu => menu.classList.remove('active'));
    const doc = type === 'folder' ? folderInventory.find(item => item.id === id) : fileInventory.find(item => item.id === id);
    if (!doc) return;
    clipboard = { type, id: doc.id, name: doc.title };
    try { sessionStorage.setItem("vault_clipboard_storage", JSON.stringify(clipboard)); sessionStorage.setItem("vault_clipboard_hidden", "false"); } catch (e) {}
    window.updateClipboardUI();
};

window.pasteItem = async function () {
    if (!clipboard) return;
    const urlParams = new URLSearchParams(window.location.search);
    const activeFolderId = urlParams.get('folder') || 'root';
    const pasteBtn = document.getElementById('navPasteBtn');
    const originalHTML = pasteBtn ? pasteBtn.innerHTML : "";
    if (pasteBtn) { pasteBtn.disabled = true; pasteBtn.innerHTML = "⚙️ PASTING..."; }

    const itemsToPaste = clipboard.isMulti ? clipboard.items : [{ id: clipboard.id, type: clipboard.type, name: clipboard.name }];
    let successCount = 0;

    for (const item of itemsToPaste) {
        if (item.type === 'file') {
            const doc = fileInventory.find(it => it.id === item.id);
            if (!doc) continue;
            let newTitle = doc.title || "Untitled File";
            if (fileInventory.some(f => f.parentFolder === activeFolderId && f.title === newTitle)) {
                const lastDot = newTitle.lastIndexOf('.');
                newTitle = lastDot !== -1 ? newTitle.substring(0, lastDot) + " - Copy" + newTitle.substring(lastDot) : newTitle + " - Copy";
            }
            const newId = "VAL-" + Math.floor(1000 + Math.random() * 9000);
            const clonedDoc = { id: newId, title: newTitle, category: doc.category || "Other", parentFolder: activeFolderId, description: doc.description || "", driveLink: doc.driveLink, assetType: 'File', fileSize: doc.fileSize || "N/A" };
            try {
                await firestoreSet('files', newId, { title: clonedDoc.title, category: clonedDoc.category, parentFolder: clonedDoc.parentFolder, description: clonedDoc.description, driveLink: clonedDoc.driveLink || "javascript:void(0)", assetType: 'File', fileSize: clonedDoc.fileSize, createdAt: new Date().toISOString() });
                fileInventory.push(clonedDoc);
                successCount++;
            } catch (e) { console.error("Paste file error:", e); }
        } else if (item.type === 'folder') {
            const folderId = item.id;
            const nestedIds = getNestedItemsToDelete(folderId);
            if (nestedIds.includes(activeFolderId)) { showToast("Cannot paste a folder inside itself.", "error"); continue; }
            const folderDoc = folderInventory.find(it => it.id === folderId);
            if (!folderDoc) continue;
            let newFolderName = folderDoc.title || "Untitled Folder";
            while (folderInventory.some(f => f.parentFolder === activeFolderId && f.title === newFolderName)) newFolderName += " - Copy";
            const clonedFolderId = "VAL-" + Math.floor(1000 + Math.random() * 9000);
            const recordsToSync = [{ id: clonedFolderId, title: newFolderName, category: 'Directory', parentFolder: activeFolderId, description: folderDoc.description || "", driveLink: "javascript:void(0)", assetType: 'Folder' }];
            const queue = [{ src: folderId, dst: clonedFolderId }];
            while (queue.length > 0) {
                const current = queue.shift();
                folderInventory.filter(it => it.parentFolder === current.src).forEach(child => {
                    const newChildId = "VAL-" + Math.floor(1000 + Math.random() * 9000);
                    recordsToSync.push({ id: newChildId, title: child.title, category: 'Directory', parentFolder: current.dst, description: child.description || "", driveLink: "javascript:void(0)", assetType: 'Folder' });
                    queue.push({ src: child.id, dst: newChildId });
                });
                fileInventory.filter(it => it.parentFolder === current.src).forEach(child => {
                    recordsToSync.push({ id: "VAL-" + Math.floor(1000 + Math.random() * 9000), title: child.title, category: child.category || "Other", parentFolder: current.dst, description: child.description || "", driveLink: child.driveLink, assetType: 'File', fileSize: child.fileSize || "N/A" });
                });
            }
            try {
                for (const rec of recordsToSync) {
                    const collName = rec.assetType === 'Folder' ? 'folders' : 'files';
                    const dbPayload = { title: rec.title, category: rec.category, parentFolder: rec.parentFolder, description: rec.description, driveLink: rec.driveLink || "javascript:void(0)", assetType: rec.assetType, createdAt: new Date().toISOString() };
                    if (rec.assetType === 'File') dbPayload.fileSize = rec.fileSize || "N/A";
                    await firestoreSet(collName, rec.id, dbPayload);
                    if (rec.assetType === 'Folder') folderInventory.push(rec); else fileInventory.push(rec);
                }
                successCount++;
            } catch (e) { console.error("Paste folder error:", e); }
        }
    }

    if (successCount > 0) {
        showToast("Pasted successfully!", "success");
        try { sessionStorage.setItem("vault_clipboard_hidden", "true"); } catch (e) {}
    } else {
        showToast("Nothing to paste.", "info");
    }
    if (pasteBtn) { pasteBtn.disabled = false; pasteBtn.innerHTML = originalHTML; }
    window.updateClipboardUI();
    renderVault();
    fetchDatabase();
};

// =========================================================================
// MULTI-SELECT
// =========================================================================
let selectedItems = [];

window.toggleCardSelection = function (checkbox) {
    const id = checkbox.getAttribute('data-id');
    const type = checkbox.getAttribute('data-type');
    if (checkbox.checked) { if (!selectedItems.some(it => it.id === id)) selectedItems.push({ id, type }); }
    else { selectedItems = selectedItems.filter(it => it.id !== id); }
    window.updateMultiSelectBar();
};
window.clearSelected = function () {
    selectedItems = [];
    document.querySelectorAll('.card-select-checkbox').forEach(cb => cb.checked = false);
    window.updateMultiSelectBar();
};
window.updateMultiSelectBar = function () {
    const count = selectedItems.length;
    const bar = document.getElementById('multiSelectBar');
    const countEl = document.getElementById('multiSelectCount');
    if (bar && countEl) {
        countEl.innerText = `${count} ${count === 1 ? 'item' : 'items'} selected`;
        bar.classList.toggle('active', count > 0);
    }
};
window.multiCopySelected = function () {
    if (selectedItems.length === 0) return;
    clipboard = { isMulti: true, items: [...selectedItems] };
    try { sessionStorage.setItem("vault_clipboard_storage", JSON.stringify(clipboard)); sessionStorage.setItem("vault_clipboard_hidden", "false"); } catch (e) {}
    showToast(`Copied ${selectedItems.length} items!`, "success");
    window.updateClipboardUI();
    clearSelected();
};

// =========================================================================
// MOVE MODAL
// =========================================================================
window.triggerMove = function (event, type, id) {
    if (event) event.stopPropagation();
    document.querySelectorAll('.options-dropdown-menu').forEach(menu => menu.classList.remove('active'));
    document.getElementById('moveTargetType').value = type;
    document.getElementById('moveTargetId').value = id;
    const selectEl = document.getElementById('moveDestinationSelect');
    if (selectEl) {
        selectEl.innerHTML = '';
        const rootOpt = document.createElement('option');
        rootOpt.value = 'root'; rootOpt.textContent = '📁 ROOT (Main Vault)';
        selectEl.appendChild(rootOpt);
        const restrictedIds = type === 'folder' ? getNestedItemsToDelete(id) : [];
        if (type === 'folder' && !restrictedIds.includes(id)) restrictedIds.push(id);
        folderInventory.forEach(f => {
            if (restrictedIds.includes(f.id)) return;
            const opt = document.createElement('option');
            opt.value = f.id; opt.textContent = `📁 ${f.title}`;
            selectEl.appendChild(opt);
        });
    }
    document.getElementById('moveModal').classList.add('active');
};
window.closeMoveModal = function () { document.getElementById('moveModal').classList.remove('active'); document.getElementById('moveForm').reset(); };

window.multiMoveSelected = function () {
    if (selectedItems.length === 0) return;
    document.getElementById('moveTargetType').value = 'multi';
    document.getElementById('moveTargetId').value = JSON.stringify(selectedItems);
    const selectEl = document.getElementById('moveDestinationSelect');
    if (selectEl) {
        selectEl.innerHTML = '';
        const rootOpt = document.createElement('option');
        rootOpt.value = 'root'; rootOpt.textContent = '📁 ROOT (Main Vault)';
        selectEl.appendChild(rootOpt);
        const restrictedIds = [];
        selectedItems.filter(it => it.type === 'folder').forEach(foldItem => {
            getNestedItemsToDelete(foldItem.id).forEach(id => { if (!restrictedIds.includes(id)) restrictedIds.push(id); });
            if (!restrictedIds.includes(foldItem.id)) restrictedIds.push(foldItem.id);
        });
        folderInventory.forEach(f => {
            if (restrictedIds.includes(f.id)) return;
            const opt = document.createElement('option');
            opt.value = f.id; opt.textContent = `📁 ${f.title}`;
            selectEl.appendChild(opt);
        });
    }
    document.getElementById('moveModal').classList.add('active');
};

document.getElementById('moveForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const type = document.getElementById('moveTargetType').value;
    const targetId = document.getElementById('moveTargetId').value;
    const destinationId = document.getElementById('moveDestinationSelect').value;
    const submitBtn = document.getElementById('submitMoveBtn');
    submitBtn.disabled = true; submitBtn.innerText = "MOVING...";
    try {
        if (type === 'multi') {
            const itemsToMove = JSON.parse(targetId);
            await Promise.all(itemsToMove.map(async (item) => {
                const collName = item.type === 'folder' ? 'folders' : 'files';
                await firestoreUpdate(collName, item.id, { parentFolder: destinationId });
                const inv = item.type === 'folder' ? folderInventory : fileInventory;
                const idx = inv.findIndex(it => it.id === item.id);
                if (idx !== -1) inv[idx].parentFolder = destinationId;
            }));
            showToast(`Moved ${itemsToMove.length} items!`, "success");
        } else {
            const collName = type === 'folder' ? 'folders' : 'files';
            await firestoreUpdate(collName, targetId, { parentFolder: destinationId });
            const inv = type === 'folder' ? folderInventory : fileInventory;
            const idx = inv.findIndex(it => it.id === targetId);
            if (idx !== -1) inv[idx].parentFolder = destinationId;
            showToast("Moved successfully!", "success");
        }
        closeMoveModal(); clearSelected(); renderVault(); fetchDatabase();
    } catch (err) {
        console.error("Move failure:", err);
        showToast("Move failed!", "error");
    } finally {
        submitBtn.disabled = false; submitBtn.innerText = "Move";
    }
});

window.multiDeleteSelected = function () {
    if (selectedItems.length === 0) return;
    document.getElementById('deleteTargetType').value = 'multi';
    document.getElementById('deleteTargetId').value = JSON.stringify(selectedItems);
    const promptEl = document.getElementById('deletePromptMessage');
    if (promptEl) promptEl.innerText = `You are about to permanently delete ${selectedItems.length} selected item(s). Folders will be deleted recursively.`;
    document.getElementById('deleteModal').classList.add('active');
};

// =========================================================================
// INITIALISE
// =========================================================================
fetchDatabase();
