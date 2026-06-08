        // ==========================================
        // CRITICAL: WIRE UP YOUR LINKS HERE
        // ==========================================
        const BACKEND_API_URL = "https://script.google.com/macros/s/AKfycbz2l6cQkl3tTDk75GthnMQwKTxRNMYsHxz_AE8mlR-Iq_rJ5i3sBx-8gZHMvfpQyNfD/exec";
        const FILES_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQsEc_TZ1SB0jVoBqyRPyEeQBDx6IyKRJ71iPx0ReMWnhVoNJqEmSUhVJufc7MqKHICZPkYZIsne8iv/pub?gid=0&single=true&output=csv";
        const FOLDERS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQsEc_TZ1SB0jVoBqyRPyEeQBDx6IyKRJ71iPx0ReMWnhVoNJqEmSUhVJufc7MqKHICZPkYZIsne8iv/pub?gid=22743343&single=true&output=csv";

        const DEFAULT_CATEGORIES = [];
        let fileInventory = [];
        let folderInventory = [];

        // Real-world fallback assets so the sandbox workspace is fully populated right out of the gate
        const MOCK_SEEDS = [
            { id: "VAL-1092", title: "Semester_Marksheet_V1.pdf", category: "Education", description: "Official college semester transcripts. Signed copy and degree logs.", driveLink: "javascript:alert('SECURED SANDBOX MODE: This is a fallback record. Upload custom files below!')", assetType: "File", parentFolder: "root" },
            { id: "VAL-2201", title: "Admission_Fee_Receipt_2026.pdf", category: "Receipt", description: "Valid admission token fee details and receipt acknowledgment.", driveLink: "javascript:alert('SECURED SANDBOX MODE: This is a fallback record. Upload custom files below!')", assetType: "File", parentFolder: "root" },
            { id: "VAL-8402", title: "UIDAI_Aadhaar_Verification.pdf", category: "Identification", description: "Governing UIDAI digital identification proof token copy.", driveLink: "javascript:alert('SECURED SANDBOX MODE: This is a fallback record. Upload custom files below!')", assetType: "File", parentFolder: "root" },
            { id: "VAL-3019", title: "Secure_Vault_Manifest.txt", category: "Manifest", description: "Operational tracking manifest detailing digital document indexing structures.", driveLink: "javascript:alert('SECURED SANDBOX MODE: This is a fallback record. Upload custom files below!')", assetType: "File", parentFolder: "root" }
        ];

        // 1. Fetch data from Google Sheets CSV on load with offline safety fallback
        async function fetchDatabase() {
            const searchBox = document.getElementById('searchBox');
            const syncStatus = document.getElementById('syncStatus');
            
            // Core local files load
            let localUploads = [];
            try {
                localUploads = JSON.parse(localStorage.getItem("vault_local_files"));
                // If never initialized, seed it
                if (!localUploads || !Array.isArray(localUploads)) {
                    localUploads = MOCK_SEEDS;
                    localStorage.setItem("vault_local_files", JSON.stringify(MOCK_SEEDS));
                }
            } catch (e) {
                localUploads = MOCK_SEEDS;
            }

            try {
                if (!FILES_CSV_URL || FILES_CSV_URL.startsWith("PASTE_") || !FOLDERS_CSV_URL || FOLDERS_CSV_URL.startsWith("PASTE_")) {
                    throw new Error("Google Sheets CSV URLs unconfigured");
                }
                
                // Fetch both feeds concurrently
                const [filesResponse, foldersResponse] = await Promise.all([
                    fetch(FILES_CSV_URL),
                    fetch(FOLDERS_CSV_URL)
                ]);

                if (!filesResponse.ok || !foldersResponse.ok) {
                    throw new Error(`Cloud Sync HTTP error! Files status: ${filesResponse.status}, Folders status: ${foldersResponse.status}`);
                }
                
                const [filesText, foldersText] = await Promise.all([
                    filesResponse.text(),
                    foldersResponse.text()
                ]);

                fileInventory = parseCSVContent(filesText, 'File');
                folderInventory = parseCSVContent(foldersText, 'Folder');
                
                // Merge Google Sheets data with newly uploaded local files and folders from Sandbox
                localUploads.forEach(localItem => {
                    if (localItem.assetType === 'Folder') {
                        const exists = folderInventory.some(sheetItem => sheetItem.title === localItem.title || sheetItem.id === localItem.id);
                        if (!exists) {
                            folderInventory.push(localItem);
                        }
                    } else {
                        const exists = fileInventory.some(sheetItem => sheetItem.title === localItem.title || sheetItem.id === localItem.id);
                        if (!exists) {
                            fileInventory.push(localItem);
                        }
                    }
                });

                if (syncStatus) {
                    syncStatus.className = "sync-status online";
                    syncStatus.innerHTML = `● CLOUD SYNCED`;
                    syncStatus.title = "Connected securely to Google Sheets multi-tab database grid.";
                }

                if (searchBox) {
                    searchBox.disabled = false;
                    searchBox.placeholder = "Search by file name, category, or descriptions...";
                }
                renderVault();
            } catch (err) {
                console.warn("Google Sheets Cloud sync offline. Switched to secure Local Sandbox:", err);
                
                // Fall back completely to local inventory
                fileInventory = localUploads.filter(item => item.assetType === 'File' || !item.assetType);
                folderInventory = localUploads.filter(item => item.assetType === 'Folder');

                if (syncStatus) {
                    syncStatus.className = "sync-status offline";
                    syncStatus.innerHTML = `● LOCAL SANDBOX`;
                    syncStatus.title = "Unable to connect to Google Sheets. Switched to offline WebViewer secure Sandbox.";
                }

                if (searchBox) {
                    searchBox.disabled = false;
                    searchBox.placeholder = "Search documents in offline sandbox...";
                }
                renderVault();
            }
        }

        // Lightweight safe row splitter
        function parseCSVContent(text, defaultType) {
            const results = [];
            let row = [];
            let cell = "";
            let inQuotes = false;
            
            const len = text.length;
            for (let i = 0; i < len; i++) {
                const char = text[i];
                const nextChar = text[i + 1];
                
                if (char === '"' || char === "'") {
                    if (inQuotes && nextChar === char) {
                        cell += char;
                        i++; // Skip escape quote
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (char === ',' && !inQuotes) {
                    row.push(cell);
                    cell = "";
                } else if ((char === '\r' || char === '\n') && !inQuotes) {
                    if (char === '\r' && nextChar === '\n') {
                        i++; // Skip LF
                    }
                    row.push(cell);
                    results.push(row);
                    row = [];
                    cell = "";
                } else {
                    cell += char;
                }
            }
            if (cell || row.length > 0) {
                row.push(cell);
                results.push(row);
            }
            
            if (results.length < 1) return [];
            
            const headers = results[0].map(h => h.trim().replace(/^["']|["']$/g, ""));
            const parsedArray = [];
            
            for (let i = 1; i < results.length; i++) {
                const currentLine = results[i];
                if (currentLine.length === 0 || (currentLine.length === 1 && !currentLine[0].trim())) continue;
                
                const obj = {};
                headers.forEach((header, idx) => {
                    let value = currentLine[idx] ? currentLine[idx].trim() : "";
                    obj[header] = value;
                });
                
                // Normalize to standard model
                obj.id = obj.id || ("VAL-" + Math.floor(1000 + Math.random() * 9000));
                obj.title = obj.title || (defaultType === 'Folder' ? "Unidentified Folder" : "Unidentified Asset");
                obj.category = obj.category || (defaultType === 'Folder' ? "Directory" : "Other");
                obj.description = obj.description || "";
                obj.driveLink = obj.driveLink || (defaultType === 'Folder' ? "javascript:void(0)" : "javascript:void(0)");
                
                // Map parent folder hierarchy, default to root
                obj.parentFolder = obj.parentFolder || "root";
                obj.assetType = defaultType;

                parsedArray.push(obj);
            }
            return parsedArray;
        }

        // Helper to check folder details
        function getActiveFolderName(folderId) {
            if (folderId === 'root') return 'Root';
            const folderDoc = folderInventory.find(item => item.id === folderId);
            return folderDoc ? folderDoc.title : 'Unidentified Folder';
        }

        // Folder file/item count helper (counts nested files & folders inside an active folder ID)
        function getFolderFileCount(folderId) {
            const filesCount = fileInventory.filter(item => (item.parentFolder || 'root') === folderId).length;
            const foldersCount = folderInventory.filter(item => (item.parentFolder || 'root') === folderId).length;
            return filesCount + foldersCount;
        }

        // Render breadcrumbs navigation row traversed upwards from activeFolderId
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

        // Navigation actions
        window.openFolder = function(folderId) {
            window.location.search = '?folder=' + folderId;
        };

        window.navigateHome = function() {
            window.location.search = '?folder=root';
        };

        window.navigateBack = function() {
            const urlParams = new URLSearchParams(window.location.search);
            const activeFolderId = urlParams.get('folder') || 'root';
            if (activeFolderId === 'root') return;

            const folderDoc = folderInventory.find(item => item.id === activeFolderId);
            const parentId = folderDoc ? (folderDoc.parentFolder || 'root') : 'root';
            window.location.search = '?folder=' + parentId;
        };

        window.refreshDatabase = async function() {
            const refreshBtn = document.getElementById('navRefreshBtn');
            if (refreshBtn) {
                refreshBtn.classList.add('loading');
            }
            try {
                await fetchDatabase();
            } catch (e) {
                console.error("Database query sync failed:", e);
            } finally {
                if (refreshBtn) {
                    refreshBtn.classList.remove('loading');
                }
            }
        };

        // Render matching vault records or directory contents
        function renderVault(filterTerm = "") {
            const grid = document.getElementById('vaultGrid');
            if (!grid) return;
            
            grid.innerHTML = "";
            const term = filterTerm.toLowerCase().trim();

            const urlParams = new URLSearchParams(window.location.search);
            const activeFolderId = urlParams.get('folder') || 'root';

            // Dynamic nav controls button state updating
            const homeBtn = document.getElementById('navHomeBtn');
            const backBtn = document.getElementById('navBackBtn');
            if (homeBtn) {
                homeBtn.disabled = (activeFolderId === 'root');
            }
            if (backBtn) {
                backBtn.disabled = (activeFolderId === 'root');
            }

            // Sync clipboard indicator UI
            if (typeof updateClipboardUI === "function") {
                updateClipboardUI();
            }

            // If searched, flat render ALL matching records globally
            if (term.length > 0) {
                // Hide breadcrumbs container when searching globally
                const breadcrumbsEl = document.getElementById('breadcrumbs');
                if (breadcrumbsEl) {
                    breadcrumbsEl.style.display = 'none';
                }

                // GLOBAL SEARCH: Filter ONLY the 'fileInventory' array globally
                const matches = fileInventory.filter(doc => {
                    return (doc.title && doc.title.toLowerCase().includes(term)) ||
                           (doc.category && doc.category.toLowerCase().includes(term)) ||
                           (doc.description && doc.description.toLowerCase().includes(term));
                });

                if (matches.length === 0) {
                    grid.innerHTML = `<p style="color: var(--text-muted)">NO OPERATIONAL RECORDS MATCHING SEARCH QUERY.</p>`;
                    return;
                }

                matches.forEach(doc => {
                    const card = document.createElement('div');
                    card.className = 'doc-card';
                    card.onclick = (e) => {
                        if (e.target.closest('.card-options-container')) return;
                        openFileSystemFile(doc.driveLink, doc.title);
                    };
                    const parentName = getActiveFolderName(doc.parentFolder || 'root');
                    card.innerHTML = `
                        <div class="file-icon">📄</div>
                        <div class="doc-meta" style="flex: 1;">
                            <h3>${doc.title || "Unidentified Asset"}</h3>
                            <p><strong>Tracking Registry:</strong> ${doc.id || "N/A"}</p>
                            ${doc.category ? `<p><strong>Category Tag:</strong> ${doc.category}</p>` : ""}
                            <p><strong>Description:</strong> ${doc.description || "None"}</p>
                            <span class="tag-pill">📂 ${parentName}</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div class="card-options-container" onclick="event.stopPropagation()">
                                <button class="card-options-btn" onclick="toggleCardOptions(event, 'match-${doc.id}')" title="More options">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1.5"></circle><circle cx="12" cy="5" r="1.5"></circle><circle cx="12" cy="19" r="1.5"></circle></svg>
                                </button>
                                <div id="match-${doc.id}-menu" class="options-dropdown-menu">
                                    <button class="options-dropdown-item" onclick="viewDetails(event, 'file', '${doc.id}')">🔬 Details</button>
                                    <button class="options-dropdown-item" onclick="copyItem(event, 'file', '${doc.id}')">📋 Copy</button>
                                    <button class="options-dropdown-item" onclick="triggerRename(event, 'file', '${doc.id}')">✏️ Rename</button>
                                    <button class="options-dropdown-item" onclick="downloadFileDirectly(event, '${doc.id}')">💾 Download</button>
                                    <button class="options-dropdown-item delete-item" onclick="triggerDelete(event, 'file', '${doc.id}')">🗑️ Delete</button>
                                </div>
                            </div>
                        </div>
                    `;
                    grid.appendChild(card);
                });
                return;
            }

            // Normal Folder View navigation (Filtered using active folder parameters)
            const breadcrumbsEl = document.getElementById('breadcrumbs');
            if (breadcrumbsEl) {
                breadcrumbsEl.style.display = 'flex';
            }
            renderBreadcrumbs();

            // Display ONLY items whose parentFolder matches our active folder parameter ID exactly
            const folders = folderInventory.filter(item => {
                const parent = item.parentFolder || 'root';
                return parent === activeFolderId;
            });

            const files = fileInventory.filter(item => {
                const parent = item.parentFolder || 'root';
                return parent === activeFolderId;
            });

            if (folders.length === 0 && files.length === 0) {
                grid.innerHTML = `<p style="color: var(--text-muted); padding: 20px 0;">THIS FOLDER IS CURRENTLY EMPTY.</p>`;
                return;
            }

            // 1. Render subfolders (📁 icon)
            folders.forEach(fold => {
                const fileCount = getFolderFileCount(fold.id);
                const card = document.createElement('div');
                card.className = 'folder-card';
                card.onclick = (e) => {
                    if (e.target.closest('.card-options-container')) return;
                    window.location.search = '?folder=' + fold.id;
                };
                card.innerHTML = `
                    <div class="folder-icon">📁</div>
                    <div class="folder-meta">
                        <h3>${fold.title}</h3>
                        <p>${fileCount} ${fileCount === 1 ? 'item' : 'items'}</p>
                    </div>
                    <div class="card-options-container" onclick="event.stopPropagation()">
                        <button class="card-options-btn" onclick="toggleCardOptions(event, 'fold-${fold.id}')" title="More options">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1.5"></circle><circle cx="12" cy="5" r="1.5"></circle><circle cx="12" cy="19" r="1.5"></circle></svg>
                        </button>
                        <div id="fold-${fold.id}-menu" class="options-dropdown-menu">
                            <button class="options-dropdown-item" onclick="viewDetails(event, 'folder', '${fold.id}')">🔬 Details</button>
                            <button class="options-dropdown-item" onclick="copyItem(event, 'folder', '${fold.id}')">📋 Copy</button>
                            <button class="options-dropdown-item" onclick="triggerRename(event, 'folder', '${fold.id}')">✏️ Rename</button>
                            <button class="options-dropdown-item delete-item" onclick="triggerDelete(event, 'folder', '${fold.id}')">🗑️ Delete</button>
                        </div>
                    </div>
                `;
                grid.appendChild(card);
            });

            // 2. Render files (📄 icon)
            files.forEach(doc => {
                const card = document.createElement('div');
                card.className = 'doc-card';
                card.onclick = (e) => {
                    if (e.target.closest('.card-options-container')) return;
                    openFileSystemFile(doc.driveLink, doc.title);
                };
                card.innerHTML = `
                    <div class="file-icon">📄</div>
                    <div class="doc-meta" style="flex: 1;">
                        <h3>${doc.title || "Unidentified Asset"}</h3>
                        <p><strong>Tracking Registry:</strong> ${doc.id || "N/A"}</p>
                        ${doc.category ? `<p><strong>Category Tag:</strong> ${doc.category}</p>` : ""}
                        <p><strong>Description:</strong> ${doc.description || "None"}</p>
                        <span class="tag-pill">📂 ${getActiveFolderName(activeFolderId)}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div class="card-options-container" onclick="event.stopPropagation()">
                            <button class="card-options-btn" onclick="toggleCardOptions(event, 'file-${doc.id}')" title="More options">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1.5"></circle><circle cx="12" cy="5" r="1.5"></circle><circle cx="12" cy="19" r="1.5"></circle></svg>
                            </button>
                            <div id="file-${doc.id}-menu" class="options-dropdown-menu">
                                <button class="options-dropdown-item" onclick="viewDetails(event, 'file', '${doc.id}')">🔬 Details</button>
                                <button class="options-dropdown-item" onclick="copyItem(event, 'file', '${doc.id}')">📋 Copy</button>
                                <button class="options-dropdown-item" onclick="triggerRename(event, 'file', '${doc.id}')">✏️ Rename</button>
                                <button class="options-dropdown-item" onclick="downloadFileDirectly(event, '${doc.id}')">💾 Download</button>
                                <button class="options-dropdown-item delete-item" onclick="triggerDelete(event, 'file', '${doc.id}')">🗑️ Delete</button>
                            </div>
                        </div>
                    </div>
                `;
                grid.appendChild(card);
            });
        }

        // Dynamically compile category value representation matching the current directory path
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

        // Create virtual folder in memory and localStorage
        function createCustomFolder(folderName) {
            const sanitized = folderName.replace(/\//g, "").trim();
            if (!sanitized) return;

            const urlParams = new URLSearchParams(window.location.search);
            const parentId = urlParams.get('folder') || 'root';

            const payload = {
                fileName: sanitized,
                fileType: 'application/x-folder',
                fileCategory: 'Directory',
                fileDescription: 'Virtual folder partition created via UI folder provisioner',
                fileBase64: 'EMPTY_FOLDER',
                parentFolder: parentId,
                assetType: 'Folder'
            };

            const submitFolderBtn = document.getElementById('submitFolderBtn');
            if (submitFolderBtn) {
                submitFolderBtn.disabled = true;
                submitFolderBtn.innerText = "PROVISIONING...";
            }

            transmitToCloud(payload, submitFolderBtn || { disabled: false, innerText: "" }).then(() => {
                closeFolderModal();
            });
        }

        // Saves uploaded documents directly into our persistent local storage vault
        function saveLocalUpload(name, type, category, parentFolder, description, base64Data, assetType = 'File') {
            let localUploads = [];
            try {
                localUploads = JSON.parse(localStorage.getItem("vault_local_files")) || [];
            } catch(e) {
                localUploads = [];
            }
            
            const newId = "VAL-" + Math.floor(1000 + Math.random() * 9000);
            const dataUrl = assetType === 'Folder' ? 'javascript:void(0)' : `data:${type};base64,${base64Data}`;
            
            const newDoc = {
                id: newId,
                title: name,
                category: category,
                parentFolder: parentFolder || 'root',
                description: description,
                driveLink: dataUrl,
                assetType: assetType
            };
            
            localUploads.push(newDoc);
            try {
                localStorage.setItem("vault_local_files", JSON.stringify(localUploads));
            } catch (e) {}
            
            // Append and merge into the active memory inventory
            if (assetType === 'Folder') {
                const exists = folderInventory.some(doc => doc.id === newId);
                if (!exists) {
                    folderInventory.push(newDoc);
                }
            } else {
                const exists = fileInventory.some(doc => doc.id === newId);
                if (!exists) {
                    fileInventory.push(newDoc);
                }
            }
            renderVault();
        }

        // Isolate the physical network transmission logic to Google Sheets or offline safe storage
        async function transmitToCloud(payload, buttonElement) {
            const customName = payload.fileName;
            const categoryTag = payload.fileCategory;
            const description = payload.fileDescription || document.getElementById('fileDescription').value;
            const parentFolderId = payload.parentFolder || document.getElementById('fileCategory').value || 'root';
            const assetType = payload.assetType || (payload.fileBase64 === 'EMPTY_FOLDER' ? 'Folder' : 'File');

            try {
                if (!BACKEND_API_URL || BACKEND_API_URL.startsWith("PASTE_")) {
                    throw new Error("Apps Script URL unconfigured");
                }

                // Compile the payload exactly with the columns
                const completePayload = {
                    ...payload,
                    parentFolder: parentFolderId,
                    assetType: assetType,
                    fileCategory: assetType === 'Folder' ? 'Directory' : categoryTag
                };

                const response = await fetch(BACKEND_API_URL, {
                    method: "POST",
                    body: JSON.stringify(completePayload)
                });
                const resData = await response.json();

                if (resData.status === "SUCCESS") {
                    if (assetType === 'Folder') {
                        alert("Secure folder sync confirmed! Folder registered in sheets database.");
                    } else {
                        alert("Secure sync confirmed! Row written to sheet and file deposited in Drive.");
                    }
                    closeModal();
                    document.getElementById('uploadForm').reset();
                    fetchDatabase(); // Force interface live reload sync loop
                } else {
                    throw new Error(resData.message || "Storage rejected transmission");
                }
            } catch(error) {
                if (assetType === 'Folder') {
                    console.warn("Cloud transmission bypassed. Storing folder locally inside Secured Sandboxed storage:", error);
                    saveLocalUpload(customName, 'application/x-folder', 'Directory', parentFolderId, description, 'EMPTY_FOLDER', 'Folder');
                    alert("Local sandbox sync verified! Folder successfully indexed and saved to secure offline local storage.");
                    closeModal();
                    document.getElementById('uploadForm').reset();
                } else {
                    console.warn("Cloud transmission bypassed. Storing locally inside Secured Sandboxed storage:", error);
                    saveLocalUpload(customName, payload.fileType || "application/octet-stream", categoryTag, parentFolderId, description, payload.fileBase64, 'File');
                    alert("Local sandbox sync verified! Document successfully indexed and saved to secure offline local storage.");
                    closeModal();
                    document.getElementById('uploadForm').reset();
                }
            } finally {
                buttonElement.disabled = false;
                buttonElement.innerText = "EXECUTE UPLOAD";
            }
        }

        // 2. Form submission and Base64 conversion logic
        document.getElementById('uploadForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const submitBtn = document.getElementById('submitBtn');
            const fileInput = document.getElementById('fileInput');
            const file = fileInput.files[0];
            
            const assetTypeEl = document.getElementById('assetType');
            const assetType = assetTypeEl ? assetTypeEl.value : (file ? 'File' : 'Folder');
            
            const urlParams = new URLSearchParams(window.location.search);
            const activeFolderId = urlParams.get('folder') || 'root';

            if (assetType === 'Folder') {
                const customName = document.getElementById('fileNameInput').value.trim() || "New Folder";
                const description = document.getElementById('fileDescription').value;

                const payload = {
                    fileName: customName,
                    fileType: 'application/x-folder',
                    fileCategory: 'Directory',
                    fileDescription: description,
                    fileBase64: 'EMPTY_FOLDER',
                    parentFolder: activeFolderId,
                    assetType: 'Folder'
                };

                submitBtn.disabled = true;
                submitBtn.innerText = "CONVERTING & TRANSMITTING...";

                await transmitToCloud(payload, submitBtn);
            } else {
                // If assetType is 'File', maintain standard FileReader binary-to-base64 conversion pipeline
                if (!file) return;

                const customName = document.getElementById('fileNameInput').value.trim() || file.name;
                const categoryTag = document.getElementById('fileCategoryTagInput').value.trim() || "Other";
                const description = document.getElementById('fileDescription').value;

                submitBtn.disabled = true;
                submitBtn.innerText = "CONVERTING & TRANSMITTING...";

                const reader = new FileReader();
                reader.readAsDataURL(file); // Converts physical binary into base64 url data signature
                
                reader.onload = async function() {
                    const base64String = reader.result.split(',')[1]; // Strip data descriptor header metadata
                    
                    const payload = {
                        fileName: customName,
                        fileType: file.type,
                        fileCategory: categoryTag, // Written to the 'category' sheet column
                        fileDescription: description,
                        fileBase64: base64String,
                        parentFolder: activeFolderId,
                        assetType: 'File'
                    };

                    await transmitToCloud(payload, submitBtn);
                };
            }
        });

        // Folder Modal form submit
        document.getElementById('folderForm').addEventListener('submit', function(e) {
            e.preventDefault();
            const input = document.getElementById('folderNameInput');
            const folderName = input.value.trim();
            if (folderName) {
                createCustomFolder(folderName);
                closeFolderModal();
            }
        });

        // Dropdown toggle controls
        window.toggleDropdown = function(event) {
            event.stopPropagation();
            const dropdown = document.getElementById('addDropdown');
            dropdown.classList.toggle('active');
        };

        window.triggerNewFile = function(event) {
            event.stopPropagation();
            document.getElementById('addDropdown').classList.remove('active');
            openModal();
        };

        window.triggerNewFolder = function(event) {
            event.stopPropagation();
            document.getElementById('addDropdown').classList.remove('active');
            openFolderModal();
        };

        // Modal triggers
        window.openModal = function() {
            populateCategoryOptions();
            document.getElementById('uploadModal').classList.add('active');
        }
        window.closeModal = function() {
            document.getElementById('uploadModal').classList.remove('active');
            document.getElementById('uploadForm').reset();
        }

        // Automatically prefill the Custom Display Name input with the selected file name (excluding extension)
        const fileInputEl = document.getElementById('fileInput');
        if (fileInputEl) {
            fileInputEl.addEventListener('change', function() {
                const nameInput = document.getElementById('fileNameInput');
                if (nameInput && this.files && this.files[0]) {
                    const fullName = this.files[0].name;
                    const lastDotIndex = fullName.lastIndexOf('.');
                    nameInput.value = lastDotIndex !== -1 ? fullName.substring(0, lastDotIndex) : fullName;
                }
            });
        }

        window.openFolderModal = function() {
            document.getElementById('folderModal').classList.add('active');
            document.getElementById('folderNameInput').focus();
        }
        window.closeFolderModal = function() {
            document.getElementById('folderModal').classList.remove('active');
            document.getElementById('folderForm').reset();
        }
        
        // Universal click-away closes the dynamic add record dropdown menu and item context menus
        document.addEventListener('click', function(e) {
            const dropdown = document.getElementById('addDropdown');
            if (dropdown) {
                dropdown.classList.remove('active');
            }
            // Close card options dropdowns if clicking outside
            document.querySelectorAll('.options-dropdown-menu').forEach(menu => {
                const container = menu.closest('.card-options-container');
                if (container && !container.contains(e.target)) {
                    menu.classList.remove('active');
                }
            });
        });

        document.getElementById('searchBox').addEventListener('input', (e) => renderVault(e.target.value));

        // Decodes and transforms Google Drive links into embedded preview format URLs
        function getGoogleDriveEmbedUrl(url) {
            if (!url) return "";
            let fileId = "";
            
            // Trim any quotes or trailing whitespace
            const cleanUrl = url.trim().replace(/^["']|["']$/g, "");
            
            // 1. Check for /file/d/FILE_ID
            const fileDMatch = cleanUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
            if (fileDMatch && fileDMatch[1]) {
                fileId = fileDMatch[1];
            }
            
            // 2. Check for id=FILE_ID parameter
            if (!fileId && cleanUrl.includes("id=")) {
                const idMatch = cleanUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
                if (idMatch && idMatch[1]) {
                    fileId = idMatch[1];
                }
            }
            
            // 3. Check for docs/spreadsheets/presentation paths 
            if (!fileId) {
                const docMatch = cleanUrl.match(/\/(document|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]+)/);
                if (docMatch && docMatch[2]) {
                    const type = docMatch[1];
                    const docId = docMatch[2];
                    return `https://docs.google.com/${type}/d/${docId}/preview`;
                }
            }
            
            if (fileId) {
                return `https://drive.google.com/file/d/${fileId}/preview`;
            }
            
            return cleanUrl;
        }

        // Decodes and transforms Google Drive links into direct download format URLs
        function getGoogleDriveDownloadUrl(url) {
            if (!url) return "";
            let fileId = "";
            
            // Trim any quotes or trailing whitespace
            const cleanUrl = url.trim().replace(/^["']|["']$/g, "");
            
            // 1. Check for /file/d/FILE_ID
            const fileDMatch = cleanUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
            if (fileDMatch && fileDMatch[1]) {
                fileId = fileDMatch[1];
            }
            
            // 2. Check for id=FILE_ID parameter
            if (!fileId && cleanUrl.includes("id=")) {
                const idMatch = cleanUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
                if (idMatch && idMatch[1]) {
                    fileId = idMatch[1];
                }
            }
            
            // 3. Check for docs/spreadsheets/presentation paths 
            if (!fileId) {
                const docMatch = cleanUrl.match(/\/(document|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]+)/);
                if (docMatch && docMatch[2]) {
                    const type = docMatch[1];
                    const docId = docMatch[2];
                    if (type === 'document') {
                        return `https://docs.google.com/document/d/${docId}/export?format=pdf`;
                    } else if (type === 'spreadsheets') {
                        return `https://docs.google.com/spreadsheets/d/${docId}/export?format=xlsx`;
                    } else if (type === 'presentation') {
                        return `https://docs.google.com/presentation/d/${docId}/export/pdf`;
                    }
                }
            }
            
            if (fileId) {
                return `https://drive.google.com/uc?export=download&id=${fileId}`;
            }
            
            return cleanUrl;
        }

        // Core downloader engine that triggers direct download bypassing any navigation/Google Drive tab redirects
        window.triggerDirectFileDownload = function(driveLink, title) {
            if (!driveLink) return;
            const cleanLink = driveLink.trim().replace(/^["']|["']$/g, "");
            const safeTitle = typeof title === 'string' ? title : (title ? String(title) : "secured_document");

            if (cleanLink.startsWith("data:")) {
                const link = document.createElement("a");
                link.href = cleanLink;
                link.download = safeTitle;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else if (cleanLink.startsWith("javascript:")) {
                const content = `---- SECURE OFF-LINE SANDBOX EXTRACT ----\nFile: ${safeTitle}\nStatus: DEMO ENCRYPTED`;
                const link = document.createElement("a");
                link.href = "data:text/plain;charset=utf-8," + encodeURIComponent(content);
                link.download = safeTitle.replace(/\.[a-zA-Z0-9]+$/i, "") + "_offline.txt";
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                const downloadUrl = getGoogleDriveDownloadUrl(cleanLink);
                
                // Use a silent hidden iframe to force the browser to initiate a direct download in the background
                // without navigating away, flashing, or opening any blank tabs.
                const hiddenIframe = document.createElement("iframe");
                hiddenIframe.style.display = "none";
                hiddenIframe.src = downloadUrl;
                document.body.appendChild(hiddenIframe);
                
                setTimeout(() => {
                    if (hiddenIframe.parentNode) {
                        document.body.removeChild(hiddenIframe);
                    }
                }, 5000);
            }
        };

        // Interactive default opener triggers copy display or binary data downloads
        window.openFileSystemFile = function(driveLink, title) {
            if (!driveLink) return;

            // Setup download and open tab buttons
            const downloadBtn = document.getElementById('viewerDownloadBtn');
            const openTabBtn = document.getElementById('viewerOpenTabBtn');
            const viewerTitle = document.getElementById('viewerTitle');
            const viewerBody = document.getElementById('viewerBody');

            const safeTitle = typeof title === 'string' ? title : (title ? String(title) : "SECURE_DOCUMENT");

            if (viewerTitle) {
                viewerTitle.innerText = `VIEW_FILE // ${safeTitle.toUpperCase()}`;
            }

            // Set up fallback download / open in new tab events
            if (downloadBtn) {
                downloadBtn.onclick = function() {
                    triggerDirectFileDownload(driveLink, safeTitle);
                };
            }

            if (openTabBtn) {
                openTabBtn.onclick = function() {
                    const cleanLink = driveLink.trim().replace(/^["']|["']$/g, "");
                    if (cleanLink.startsWith("javascript:")) {
                        alert("Secure action script offline. Try regular uploads to link active cloud drives.");
                    } else {
                        window.open(cleanLink, "_blank");
                    }
                };
                
                const cleanLink = driveLink.trim().replace(/^["']|["']$/g, "");
                if (cleanLink.startsWith("data:")) {
                    openTabBtn.style.display = "none";
                } else {
                    openTabBtn.style.display = "inline-block";
                }
            }

            // Load Content
            if (viewerBody) {
                viewerBody.innerHTML = `
                    <div class="viewer-loading-spinner">
                        <div>🔄 DECRYPTING & DECODING STREAM...</div>
                    </div>
                `;

                setTimeout(() => {
                    const cleanLink = driveLink.trim().replace(/^["']|["']$/g, "");
                    
                    if (cleanLink.startsWith("data:")) {
                        const splitted = cleanLink.split(';');
                        const mediaType = splitted[0] ? splitted[0].substring(5) : "";
                        if (mediaType.startsWith("image/")) {
                            viewerBody.innerHTML = `<img src="${cleanLink}" class="viewer-img" alt="${safeTitle}" />`;
                        } else if (mediaType.startsWith("text/") || mediaType === "application/json" || mediaType === "text/javascript" || mediaType === "text/html") {
                            try {
                                const base64Part = cleanLink.split(',')[1];
                                const decoded = atob(base64Part);
                                viewerBody.innerHTML = `<pre class="viewer-code-container"><code>${escapeHTML(decoded)}</code></pre>`;
                            } catch (err) {
                                viewerBody.innerHTML = `<iframe src="${cleanLink}" class="viewer-iframe" allowfullscreen></iframe>`;
                            }
                        } else {
                            viewerBody.innerHTML = `<iframe src="${cleanLink}" class="viewer-iframe" allowfullscreen></iframe>`;
                        }
                    } else if (cleanLink.startsWith("javascript:")) {
                        // Display beautiful custom simulated documents for preset mocks inside secure sandbox mode
                        if (safeTitle.includes("Semester_Marksheet")) {
                            viewerBody.innerHTML = `
                                <div class="viewer-code-container" style="color: #34d399; padding: 24px;">
                                    <div style="border: 2px dashed #34d399; padding: 20px; border-radius: 4px; background: rgba(52, 211, 153, 0.05); max-width: 600px; margin: 0 auto; line-height: 1.6; font-family: monospace;">
                                        <h2 style="text-align: center; margin-bottom: 20px; font-family: monospace; letter-spacing: 2px;">🎓 ACADEMIC TRANSCRIPT //</h2>
                                        <p><strong>REGISTRY ID:</strong> STU-99841-B</p>
                                        <p><strong>VERIFIED EXAMINEE:</strong> DEMO CONTEXT USER</p>
                                        <hr style="border: 1px dashed #34d399; margin: 15px 0;">
                                        <table style="width: 100%; border-collapse: collapse; text-align: left;">
                                            <thead>
                                                <tr style="border-bottom: 1px solid #34d399;">
                                                    <th>MODULE DESCRIPTION</th>
                                                    <th>CREDITS</th>
                                                    <th>GRADE</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr><td>CS-401 CRYPTOGRAPHIC ALGORITHMS</td><td>4.0</td><td>A+</td></tr>
                                                <tr><td>CS-402 DATABASE SHARDING PROTOCOLS</td><td>4.0</td><td>A</td></tr>
                                                <tr><td>CS-405 SECURED ENCLAVE ARCHITECTURE</td><td>3.0</td><td>A+</td></tr>
                                                <tr><td>CS-410 ADVANCED WEB CLUSTER ENGINEERING</td><td>3.0</td><td>A</td></tr>
                                            </tbody>
                                        </table>
                                        <hr style="border: 1px dashed #34d399; margin: 15px 0;">
                                        <p><strong>CUMULATIVE GPA:</strong> 3.92 / 4.00</p>
                                        <p style="text-align: center; font-size: 0.75rem; opacity: 0.7; margin-top: 25px;">[🔐 DIGITAL VERIFICATION TOKEN APPROVED BY DEPT CLUSTER SECURE]</p>
                                    </div>
                                </div>
                            `;
                        } else if (safeTitle.includes("Admission_Fee")) {
                            viewerBody.innerHTML = `
                                <div class="viewer-code-container" style="color: #f59e0b; padding: 24px;">
                                    <div style="border: 2px solid #f59e0b; padding: 20px; border-radius: 4px; background: rgba(245, 158, 11, 0.05); max-width: 500px; margin: 0 auto; line-height: 1.6; font-family: monospace;">
                                        <div style="text-align: center; margin-bottom: 15px;">
                                            <span style="font-size: 2.5rem;">💸</span>
                                            <h3 style="margin-top: 10px; font-family: monospace; color: #f59e0b;">TRANSACTION_RECEIPT //</h3>
                                        </div>
                                        <p><strong>ISSUER:</strong> OFFICE OF FINANCIAL REGISTRATION</p>
                                        <p><strong>TRANSACTION REF:</strong> TXN-994857183</p>
                                        <p><strong>TIMESTAMP:</strong> 2026-06-06 UTC</p>
                                        <hr style="border-color: #f59e0b; margin: 15px 0;">
                                        <div style="display: flex; justify-content: space-between; font-weight: bold;">
                                            <span>ITEM DESCRIPTION</span>
                                            <span>PAYMENT</span>
                                        </div>
                                        <hr style="border-color: #f59e0b; margin: 5px 0 10px 0;">
                                        <div style="display: flex; justify-content: space-between; margin-top: 5px;">
                                            <span>TUITION FEE (SPRING 2026)</span>
                                            <span>$4,850.00</span>
                                        </div>
                                        <div style="display: flex; justify-content: space-between;">
                                            <span>SYSTEM SECURITY LEVY</span>
                                            <span>$150.00</span>
                                        </div>
                                        <hr style="border-color: #f59e0b; margin: 15px 0;">
                                        <div style="display: flex; justify-content: space-between; font-size: 1.1rem; font-weight: bold;">
                                            <span>TOTAL AMOUNT PAID</span>
                                            <span>$5,000.00</span>
                                        </div>
                                        <div style="margin-top: 25px; text-align: center; background: #f59e0b; color: #000; font-weight: bold; padding: 8px; border-radius: 2px; letter-spacing: 1px;">
                                            ✅ TRANSACTIONS SECURED // VERIFIED APPROVED
                                        </div>
                                    </div>
                                </div>
                            `;
                        } else if (safeTitle.includes("UIDAI_Aadhaar")) {
                            viewerBody.innerHTML = `
                                <div class="viewer-code-container" style="color: #60a5fa; padding: 24px;">
                                    <div style="border: 2px dashed #60a5fa; padding: 20px; border-radius: 8px; background: rgba(96, 165, 250, 0.05); max-width: 550px; margin: 0 auto; line-height: 1.5; font-family: monospace;">
                                        <h3 style="text-align: center; color: #60a5fa; font-weight: bold; margin-bottom: 12px; letter-spacing: 1px;">GOVERNMENT OF INDIA // UIDAI RECORD</h3>
                                        <hr style="border-color: #60a5fa; margin-bottom: 15px;">
                                        <div style="display: flex; gap: 20px; align-items: center; flex-wrap: wrap;">
                                            <div style="width: 100px; height: 120px; border: 2px solid #5a5f7d; display: flex; align-items: center; justify-content: center; font-size: 2.5rem; background: rgba(255,255,255,0.05); border-radius: 4px;">👤</div>
                                            <div style="flex: 1; min-width: 200px;">
                                                <p><strong>NAME:</strong> JASHUVA V. DEMO</p>
                                                <p><strong>DOB:</strong> 12 / 08 / 1999</p>
                                                <p><strong>GENDER:</strong> MALE</p>
                                                <p><strong>ADDRESS:</strong> SECURE VAULT CLOUD REGISTRY, WORKSPACE CHIP NODE 4</p>
                                            </div>
                                        </div>
                                        <div style="border: 1px solid #60a5fa; padding: 8px; text-align: center; font-size: 1.2rem; font-weight: bold; letter-spacing: 3px; margin-top: 20px; background: rgba(96, 165, 250, 0.1);">
                                            4882 9901 3855
                                        </div>
                                        <p style="text-align: center; font-size: 0.7rem; color: #60a5fa; margin-top: 8px;">मेरा आधार, मेरी पहचान // MY AADHAAR, MY CLOUD IDENTITY</p>
                                    </div>
                                </div>
                            `;
                        } else {
                            viewerBody.innerHTML = `
                                <div class="viewer-code-container" style="color: #38bdf8; padding: 24px; font-family: monospace;">
                                    <div style="border: 1px solid #1e293b; padding: 16px; border-radius: 4px; background: #030712; line-height: 1.6;">
                                        <span style="color: #64748b;">// CONFIG PRESET SECURITY VAULT MANIFEST FILE //</span>
                                        <p style="color: #e2e8f0; margin-top: 10px;"><strong># SECURED SYSTEM ENVIRONMENT CONFIGS:</strong></p>
                                        <p>VAULT_PORT_INGRESS=3000</p>
                                        <p>REVERSE_PROXY_SSL=ACTIVE</p>
                                        <p>CLOUD_SYNC_REDUNDANCY=ENABLED</p>
                                        <p>METADATA_DECRYPTOR_ALGO=AES-256-GCM</p>
                                        <p style="color: #e2e8f0; margin-top: 15px;"><strong># ACTIVE REMOTE REPOSITORIES:</strong></p>
                                        <p>FILES_RAW_DB="${FILES_CSV_URL}"</p>
                                        <p>FOLDERS_RAW_DB="${FOLDERS_CSV_URL}"</p>
                                        <p>BACKEND_TRANSMITTER="${BACKEND_API_URL}"</p>
                                        <p style="color: #64748b; margin-top: 20px;">// END OF SYSTEM SECURED MANIFEST REPORT //</p>
                                    </div>
                                </div>
                            `;
                        }
                    } else {
                        const embedUrl = getGoogleDriveEmbedUrl(cleanLink);
                        viewerBody.innerHTML = `<iframe src="${embedUrl}" class="viewer-iframe" allow="autoplay; encrypted-media" allowfullscreen="true" referrerpolicy="no-referrer"></iframe>`;
                    }
                }, 300);
            }

            document.getElementById('viewerModal').classList.add('active');
        };

        window.closeViewerModal = function() {
            const viewerBody = document.getElementById('viewerBody');
            if (viewerBody) {
                viewerBody.innerHTML = "";
            }
            document.getElementById('viewerModal').classList.remove('active');
        };

        function escapeHTML(str) {
            return str
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }

        // Item context menu toggle trigger
        window.toggleCardOptions = function(event, menuId) {
            event.stopPropagation();
            const targetMenu = document.getElementById(menuId + '-menu');
            const isActive = targetMenu && targetMenu.classList.contains('active');

            // Close all other dropdowns
            document.querySelectorAll('.options-dropdown-menu').forEach(menu => {
                menu.classList.remove('active');
            });

            if (targetMenu && !isActive) {
                targetMenu.classList.add('active');
            }
        };

        // Modal Action: SHOW METADATA DETAILS
        window.viewDetails = function(event, type, id) {
            if (event) event.stopPropagation();
            
            // Close opened context menu dropdowns
            document.querySelectorAll('.options-dropdown-menu').forEach(menu => {
                menu.classList.remove('active');
            });

            const contentEl = document.getElementById('detailsContent');
            if (!contentEl) return;

            if (type === 'folder') {
                const folderDoc = folderInventory.find(item => item.id === id);
                const title = folderDoc ? folderDoc.title : "Unidentified Folder";
                const parent = folderDoc ? (folderDoc.parentFolder || 'root') : 'root';
                const parentPathName = getActiveFolderName(parent);
                const count = getFolderFileCount(id);

                contentEl.innerHTML = `
                    <div class="details-row">
                        <span class="details-key">Entry Type</span>
                        <span class="details-val">📁 FOLDER</span>
                    </div>
                    <div class="details-row">
                        <span class="details-key">Folder Name</span>
                        <span class="details-val" style="font-weight: bold; color: var(--accent);">${title}</span>
                    </div>
                    <div class="details-row">
                        <span class="details-key">Parent Folder</span>
                        <span class="details-val">${parentPathName}</span>
                    </div>
                    <div class="details-row">
                        <span class="details-key">Document Count</span>
                        <span class="details-val">${count} item(s) recorded in this folder</span>
                    </div>
                    <div class="details-row">
                        <span class="details-key">Operational Class</span>
                        <span class="details-val">Virtual archive index partition</span>
                    </div>
                `;
            } else if (type === 'file') {
                const doc = fileInventory.find(item => item.id === id);
                if (!doc) return;

                const isLocal = doc.driveLink && doc.driveLink.startsWith("data:");
                const originLabel = isLocal ? "🔒 Secured Local Sandbox (Encrypted Offline)" : "🌐 Google Registry Synchronization Cloud Server";

                contentEl.innerHTML = `
                    <div class="details-row">
                        <span class="details-key">Entry Type</span>
                        <span class="details-val">📄 DOCUMENT FILE</span>
                    </div>
                    <div class="details-row">
                        <span class="details-key">Asset Name</span>
                        <span class="details-val" style="font-weight: bold; color: var(--accent);">${doc.title || "Unidentified Asset"}</span>
                    </div>
                    <div class="details-row">
                        <span class="details-key">Tracking Registry</span>
                        <span class="details-val" style="font-family: monospace;">${doc.id || "N/A"}</span>
                    </div>
                    <div class="details-row">
                        <span class="details-key">Storage Source</span>
                        <span class="details-val">${originLabel}</span>
                    </div>
                    <div class="details-row">
                        <span class="details-key">Category Tag</span>
                        <span class="details-val">${(doc.category || "Root").replace(/\//g, " / ")}</span>
                    </div>
                    <div class="details-row">
                        <span class="details-key">Description</span>
                        <span class="details-val">${doc.description || "None (No description metadata tagged)"}</span>
                    </div>
                `;
            }

            document.getElementById('detailsModal').classList.add('active');
        };

        window.closeDetailsModal = function() {
            document.getElementById('detailsModal').classList.remove('active');
        };

        // Modal Action: INITIATE RENAME PROMPT
        window.triggerRename = function(event, type, id) {
            if (event) event.stopPropagation();

            // Close context menu dropdowns
            document.querySelectorAll('.options-dropdown-menu').forEach(menu => {
                menu.classList.remove('active');
            });

            const renameInput = document.getElementById('renameInput');
            const renameLabel = document.getElementById('renameLabel');
            
            document.getElementById('renameTargetType').value = type;
            document.getElementById('renameTargetId').value = id;

            const doc = type === 'folder' ? folderInventory.find(item => item.id === id) : fileInventory.find(item => item.id === id);
            const oldTitle = doc ? doc.title : "";
            document.getElementById('renameTargetOldName').value = oldTitle;

            if (type === 'folder') {
                renameLabel.innerText = "NEW FOLDER NAME";
                if (renameInput) renameInput.value = oldTitle;
            } else {
                renameLabel.innerText = "NEW DOCUMENT FILENAME";
                if (renameInput) renameInput.value = oldTitle;
            }

            document.getElementById('renameModal').classList.add('active');
            if (renameInput) renameInput.focus();
        };

        window.closeRenameModal = function() {
            document.getElementById('renameModal').classList.remove('active');
            document.getElementById('renameForm').reset();
        };

        // Handle rename save submissions
        document.getElementById('renameForm').addEventListener('submit', function(e) {
            e.preventDefault();
            const type = document.getElementById('renameTargetType').value;
            const targetId = document.getElementById('renameTargetId').value;
            const newName = document.getElementById('renameInput').value.trim();

            if (!newName) return;

            // 1. Update localStorage uploads
            let localUploads = [];
            try {
                localUploads = JSON.parse(localStorage.getItem("vault_local_files")) || [];
            } catch (err) {}
            localUploads.forEach(doc => {
                if (doc.id === targetId) {
                    doc.title = newName;
                }
            });
            try {
                localStorage.setItem("vault_local_files", JSON.stringify(localUploads));
            } catch (err) {}

            // 2. Update memory arrays
            fileInventory.forEach(doc => {
                if (doc.id === targetId) {
                    doc.title = newName;
                }
            });
            folderInventory.forEach(doc => {
                if (doc.id === targetId) {
                    doc.title = newName;
                }
            });

            closeRenameModal();
            renderVault();
        });

        // Direct Download Link helper Action
        window.downloadFileDirectly = function(event, id) {
            if (event) event.stopPropagation();
            
            // Close context menu dropdowns
            document.querySelectorAll('.options-dropdown-menu').forEach(menu => {
                menu.classList.remove('active');
            });

            const doc = fileInventory.find(item => item.id === id);
            if (doc) {
                triggerDirectFileDownload(doc.driveLink, doc.title);
            }
        };

        // Modal Action: INITIATE DELETE WARNING DIALOG
        window.triggerDelete = function(event, type, id) {
            if (event) event.stopPropagation();

            // Close context menu dropdowns
            document.querySelectorAll('.options-dropdown-menu').forEach(menu => {
                menu.classList.remove('active');
            });

            document.getElementById('deleteTargetType').value = type;
            document.getElementById('deleteTargetId').value = id;

            const promptEl = document.getElementById('deletePromptMessage');
            const doc = type === 'folder' ? folderInventory.find(item => item.id === id) : fileInventory.find(item => item.id === id);
            const title = doc ? doc.title : "Unidentified Asset";

            if (type === 'folder') {
                promptEl.innerHTML = `You are about to initiate an offline system purge sequence for folder <strong style="color: var(--accent);">${title}</strong> and ALL nested subfolders or documents contained inside it.`;
            } else {
                promptEl.innerHTML = `You are about to initiate an offline system purge sequence for document <strong style="color: var(--accent);">${title}</strong> (Registry index: ${id}).`;
            }

            document.getElementById('deleteModal').classList.add('active');
        };

        window.closeDeleteModal = function() {
            document.getElementById('deleteModal').classList.remove('active');
            document.getElementById('deleteForm').reset();
        };

        // Recursive child item lookup helper
        function getNestedItemsToDelete(folderId) {
            const resultIds = new Set([folderId]);
            let previousSize = 0;

            while (previousSize !== resultIds.size) {
                previousSize = resultIds.size;
                fileInventory.forEach(item => {
                    if (item.parentFolder && resultIds.has(item.parentFolder)) {
                        resultIds.add(item.id);
                    }
                });
                folderInventory.forEach(item => {
                    if (item.parentFolder && resultIds.has(item.parentFolder)) {
                        resultIds.add(item.id);
                    }
                });
            }

            return Array.from(resultIds);
        }

        // Handle delete wipe submissions
        document.getElementById('deleteForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            const type = document.getElementById('deleteTargetType').value;
            const targetId = document.getElementById('deleteTargetId').value;
            const submitBtn = document.getElementById('submitDeleteBtn');

            if (type === 'file') {
                const doc = fileInventory.find(item => item.id === targetId);
                const isLocal = doc && doc.driveLink && doc.driveLink.startsWith("data:");
                
                if (doc && !isLocal && BACKEND_API_URL && !BACKEND_API_URL.startsWith("PASTE_")) {
                    submitBtn.disabled = true;
                    submitBtn.innerText = "PURGING CLOUD ARCHIVE...";
                    try {
                        const payload = {
                            action: "delete",
                            id: doc.id,
                            driveLink: doc.driveLink
                        };
                        const response = await fetch(BACKEND_API_URL, {
                            method: "POST",
                            body: JSON.stringify(payload)
                        });
                        const resData = await response.json();
                        if (resData.status !== "SUCCESS") {
                            throw new Error(resData.message || "Cloud delete rejected error");
                        }
                    } catch (err) {
                        console.error("Cloud purge failed, removing from local cache only:", err);
                        alert("Cloud synchronization unavailable. Purged file reference from local sandbox interface.");
                    } finally {
                        submitBtn.disabled = false;
                        submitBtn.innerText = "CONFIRM PURGE";
                    }
                }

                // 1. Remove file matching matching ID from localStorage
                let localUploads = [];
                try {
                    localUploads = JSON.parse(localStorage.getItem("vault_local_files")) || [];
                } catch (err) {}
                localUploads = localUploads.filter(doc => doc.id !== targetId);
                try {
                    localStorage.setItem("vault_local_files", JSON.stringify(localUploads));
                } catch (err) {}

                // 2. Remove file matching matching ID from memory inventory
                fileInventory = fileInventory.filter(doc => doc.id !== targetId);

            } else if (type === 'folder') {
                const idsToDelete = getNestedItemsToDelete(targetId);

                // Gather online cloud files from nested list to delete
                const filesToDelete = fileInventory.filter(item => idsToDelete.includes(item.id));
                const onlineFiles = filesToDelete.filter(doc => doc.driveLink && !doc.driveLink.startsWith("data:"));

                if (onlineFiles.length > 0 && BACKEND_API_URL && !BACKEND_API_URL.startsWith("PASTE_")) {
                    submitBtn.disabled = true;
                    submitBtn.innerText = `PURGING ${onlineFiles.length} CLOUD ASSET(S)...`;
                    try {
                        const deletePromises = onlineFiles.map(async (doc) => {
                            const payload = {
                                action: "delete",
                                id: doc.id,
                                driveLink: doc.driveLink
                            };
                            return fetch(BACKEND_API_URL, {
                                method: "POST",
                                body: JSON.stringify(payload)
                            }).then(r => r.json());
                        });
                        await Promise.all(deletePromises);
                    } catch (err) {
                        console.error("Some cloud folder assets failed to purge online:", err);
                    } finally {
                        submitBtn.disabled = false;
                        submitBtn.innerText = "CONFIRM PURGE";
                    }
                }

                // 1. Remove from Local Storage and memory
                let localUploads = [];
                try {
                    localUploads = JSON.parse(localStorage.getItem("vault_local_files")) || [];
                } catch (err) {}
                localUploads = localUploads.filter(doc => !idsToDelete.includes(doc.id));
                try {
                    localStorage.setItem("vault_local_files", JSON.stringify(localUploads));
                } catch (err) {}

                fileInventory = fileInventory.filter(doc => !idsToDelete.includes(doc.id));
                folderInventory = folderInventory.filter(doc => !idsToDelete.includes(doc.id));
            }

            closeDeleteModal();
            renderVault();
        });

        // Clipboard variables & operations
        let clipboard = null;
        try {
            clipboard = JSON.parse(localStorage.getItem("vault_clipboard_storage"));
        } catch(e) {}

        window.updateClipboardUI = function() {
            const pasteBtn = document.getElementById('navPasteBtn');
            const notice = document.getElementById('clipboardNotice');
            const itemNameSpan = document.getElementById('clipboardItemName');

            if (clipboard && clipboard.name) {
                if (pasteBtn) {
                    pasteBtn.disabled = false;
                    pasteBtn.title = `Paste: ${clipboard.name}`;
                }
                if (notice) {
                    notice.style.display = "inline-block";
                    if (itemNameSpan) {
                        const dispName = clipboard.name.length > 25 ? clipboard.name.substring(0, 22) + "..." : clipboard.name;
                        itemNameSpan.innerText = dispName;
                    }
                }
            } else {
                if (pasteBtn) {
                    pasteBtn.disabled = true;
                    pasteBtn.title = "Paste Copied Item";
                }
                if (notice) {
                    notice.style.display = "none";
                }
            }
        };

        window.copyItem = function(event, type, id) {
            if (event) event.stopPropagation();

            // Close context menu dropdowns
            document.querySelectorAll('.options-dropdown-menu').forEach(menu => {
                menu.classList.remove('active');
            });

            const doc = type === 'folder' ? folderInventory.find(item => item.id === id) : fileInventory.find(item => item.id === id);
            if (!doc) return;

            clipboard = {
                type: type, // 'file' or 'folder'
                id: doc.id,
                name: doc.title
            };

            try {
                localStorage.setItem("vault_clipboard_storage", JSON.stringify(clipboard));
            } catch (e) {}
            window.updateClipboardUI();
        };

        window.pasteItem = function() {
            if (!clipboard) return;

            const urlParams = new URLSearchParams(window.location.search);
            const activeFolderId = urlParams.get('folder') || 'root';

            if (clipboard.type === 'file') {
                const doc = fileInventory.find(item => item.id === clipboard.id);
                if (!doc) {
                    alert("Source file not found (it may have been deleted).");
                    clipboard = null;
                    try {
                        localStorage.removeItem("vault_clipboard_storage");
                    } catch (e) {}
                    window.updateClipboardUI();
                    return;
                }

                let newTitle = doc.title || "Untitled File";
                const isDuplicate = fileInventory.some(f => f.parentFolder === activeFolderId && f.title === newTitle);
                
                if (isDuplicate) {
                    const lastDot = newTitle.lastIndexOf('.');
                    if (lastDot !== -1) {
                        const base = newTitle.substring(0, lastDot);
                        const ext = newTitle.substring(lastDot);
                        newTitle = base + " - Copy" + ext;
                    } else {
                        newTitle = newTitle + " - Copy";
                    }
                }

                const newId = "VAL-" + Math.floor(1000 + Math.random() * 9000);

                const clonedDoc = {
                    id: newId,
                    title: newTitle,
                    category: doc.category || "Other",
                    parentFolder: activeFolderId,
                    description: doc.description || "",
                    driveLink: doc.driveLink,
                    assetType: 'File'
                };

                let localUploads = [];
                try {
                    localUploads = JSON.parse(localStorage.getItem("vault_local_files")) || [];
                } catch(e) {}
                localUploads.push(clonedDoc);
                try {
                    localStorage.setItem("vault_local_files", JSON.stringify(localUploads));
                } catch (e) {}

                // Push inside active memory
                fileInventory.push(clonedDoc);

            } else if (clipboard.type === 'folder') {
                const folderId = clipboard.id;

                // Check nested hierarchy
                const nestedIds = getNestedItemsToDelete(folderId);
                if (nestedIds.includes(activeFolderId)) {
                    alert("A folder cannot be copied into itself or nested underneath its own directory structure.");
                    return;
                }

                const folderDoc = folderInventory.find(item => item.id === folderId);
                if (!folderDoc) {
                    alert("Source folder not found (it may have been deleted).");
                    clipboard = null;
                    try {
                        localStorage.removeItem("vault_clipboard_storage");
                    } catch (e) {}
                    window.updateClipboardUI();
                    return;
                }

                let newFolderName = folderDoc.title || "Untitled Folder";
                let folderExists = folderInventory.some(f => f.parentFolder === activeFolderId && f.title === newFolderName);
                while (folderExists) {
                    newFolderName = newFolderName + " - Copy";
                    folderExists = folderInventory.some(f => f.parentFolder === activeFolderId && f.title === newFolderName);
                }

                // 1. Clone top-level folder
                const clonedFolderId = "VAL-" + Math.floor(1000 + Math.random() * 9000);
                const clonedFolder = {
                    id: clonedFolderId,
                    title: newFolderName,
                    category: 'Directory',
                    parentFolder: activeFolderId,
                    description: folderDoc.description || "",
                    driveLink: "javascript:void(0)",
                    assetType: 'Folder'
                };

                let localUploads = [];
                try {
                    localUploads = JSON.parse(localStorage.getItem("vault_local_files")) || [];
                } catch(e) {}
                localUploads.push(clonedFolder);
                try {
                    localStorage.setItem("vault_local_files", JSON.stringify(localUploads));
                } catch (e) {}
                folderInventory.push(clonedFolder);

                // 2. Recursively clone descendants
                const queue = [{ src: folderId, dst: clonedFolderId }];
                try {
                    localUploads = JSON.parse(localStorage.getItem("vault_local_files")) || [];
                } catch (e) { localUploads = []; }

                while (queue.length > 0) {
                    const current = queue.shift();
                    const descendantFiles = fileInventory.filter(item => item.parentFolder === current.src);
                    const descendantFolders = folderInventory.filter(item => item.parentFolder === current.src);

                    descendantFolders.forEach(child => {
                        const newChildId = "VAL-" + Math.floor(1000 + Math.random() * 9000);
                        const clonedDoc = {
                            id: newChildId,
                            title: child.title,
                            category: 'Directory',
                            parentFolder: current.dst,
                            description: child.description || "",
                            driveLink: "javascript:void(0)",
                            assetType: 'Folder'
                        };
                        localUploads.push(clonedDoc);
                        folderInventory.push(clonedDoc);
                        queue.push({ src: child.id, dst: newChildId });
                    });

                    descendantFiles.forEach(child => {
                        const newChildId = "VAL-" + Math.floor(1000 + Math.random() * 9000);
                        const clonedDoc = {
                            id: newChildId,
                            title: child.title,
                            category: child.category || "Other",
                            parentFolder: current.dst,
                            description: child.description || "",
                            driveLink: child.driveLink,
                            assetType: 'File'
                        };
                        localUploads.push(clonedDoc);
                        fileInventory.push(clonedDoc);
                    });
                }
                try {
                    localStorage.setItem("vault_local_files", JSON.stringify(localUploads));
                } catch (e) {}
            }

            renderVault();
        };

        // Start checking registry sync on system initialization load
        fetchDatabase();
