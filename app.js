        // ==========================================
        // CRITICAL: WIRE UP YOUR LINKS HERE
        // ==========================================
        const BACKEND_API_URL = "https://script.google.com/macros/s/AKfycbz2l6cQkl3tTDk75GthnMQwKTxRNMYsHxz_AE8mlR-Iq_rJ5i3sBx-8gZHMvfpQyNfD/exec";
        const SHEETS_CSV_URL  = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQsEc_TZ1SB0jVoBqyRPyEeQBDx6IyKRJ71iPx0ReMWnhVoNJqEmSUhVJufc7MqKHICZPkYZIsne8iv/pub?output=csv";

        const DEFAULT_CATEGORIES = [];
        let documentInventory = [];
        let currentPath = []; // Array of strings representing current folder path, e.g. ["Education", "2026"]

        // Real-world fallback assets so the sandbox workspace is fully populated right out of the gate
        const MOCK_SEEDS = [
            { id: "VAL-1092", title: "Semester_Marksheet_V1.pdf", category: "", description: "Official college semester transcripts. Signed copy and degree logs.", driveLink: "javascript:alert('SECURED SANDBOX MODE: This is a fallback record. Upload custom files below!')" },
            { id: "VAL-2201", title: "Admission_Fee_Receipt_2026.pdf", category: "", description: "Valid admission token fee details and receipt acknowledgment.", driveLink: "javascript:alert('SECURED SANDBOX MODE: This is a fallback record. Upload custom files below!')" },
            { id: "VAL-8402", title: "UIDAI_Aadhaar_Verification.pdf", category: "", description: "Governing UIDAI digital identification proof token copy.", driveLink: "javascript:alert('SECURED SANDBOX MODE: This is a fallback record. Upload custom files below!')" },
            { id: "VAL-3019", title: "Secure_Vault_Manifest.txt", category: "", description: "Operational tracking manifest detailing digital document indexing structures.", driveLink: "javascript:alert('SECURED SANDBOX MODE: This is a fallback record. Upload custom files below!')" }
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
                if (!SHEETS_CSV_URL || SHEETS_CSV_URL.startsWith("PASTE_")) {
                    throw new Error("Google Sheets CSV URL unconfigured");
                }
                
                const response = await fetch(SHEETS_CSV_URL);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const dataText = await response.text();
                parseCSV(dataText);
                
                // Merge Google Sheets data with newly uploaded local files
                localUploads.forEach(localFile => {
                    const exists = documentInventory.some(sheetFile => sheetFile.title === localFile.title || sheetFile.id === localFile.id);
                    if (!exists) {
                        documentInventory.push(localFile);
                    }
                });

                if (syncStatus) {
                    syncStatus.className = "sync-status online";
                    syncStatus.innerHTML = `● CLOUD SYNCED`;
                    syncStatus.title = "Connected securely to Google Sheets database grid.";
                }

                if (searchBox) {
                    searchBox.disabled = false;
                    searchBox.placeholder = "Search by file name, category, or descriptions...";
                }
                renderVault();
            } catch (err) {
                console.warn("Google Sheets live Cloud Sync offline. Switched to secure Local Sandbox:", err);
                
                // Fall back completely to local inventory
                documentInventory = localUploads;

                if (syncStatus) {
                    syncStatus.className = "sync-status offline";
                    syncStatus.innerHTML = `● LOCAL SANDBOX`;
                    syncStatus.title = "Unable to connect to Google Sheets. Switched to offline Local Sandbox storage.";
                }

                if (searchBox) {
                    searchBox.disabled = false;
                    searchBox.placeholder = "Search documents in offline sandbox...";
                }
                renderVault();
            }
        }

        // Lightweight safe row splitter
        function parseCSV(text) {
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
            
            if (results.length < 1) return;
            
            const headers = results[0].map(h => h.trim().replace(/^["']|["']$/g, ""));
            documentInventory = [];
            
            let sheetFolderMap = {};
            try {
                sheetFolderMap = JSON.parse(localStorage.getItem("vault_file_folders_map")) || {};
            } catch (e) {
                sheetFolderMap = {};
            }
            
            for (let i = 1; i < results.length; i++) {
                const currentLine = results[i];
                if (currentLine.length === 0 || (currentLine.length === 1 && !currentLine[0].trim())) continue;
                
                const obj = {};
                headers.forEach((header, idx) => {
                    let value = currentLine[idx] ? currentLine[idx].trim() : "";
                    obj[header] = value;
                });
                
                // Map to its local folder structure, defaulting to Root
                obj.folderPath = sheetFolderMap[obj.id] || "";
                documentInventory.push(obj);
            }
        }

        // Directory contents builder
        function getDirectoryContents() {
            const folders = new Map(); // name -> { fileCount: 0 }
            const files = [];

            // Add standard default categories if we are in Root level
            if (currentPath.length === 0) {
                DEFAULT_CATEGORIES.forEach(cat => {
                    folders.set(cat, { fileCount: 0 });
                });
            }

            // Fetch custom folders from localStorage to preserve empty state
            let emptyFolders = [];
            try {
                emptyFolders = JSON.parse(localStorage.getItem("vault_custom_empty_folders")) || [];
            } catch (e) {
                emptyFolders = [];
            }

            // Filter and register empty folders relevant under the currentPath
            emptyFolders.forEach(pathStr => {
                const parts = pathStr.split("/");
                if (parts.length === currentPath.length + 1) {
                    const isDirectSub = currentPath.every((val, idx) => val === parts[idx]);
                    if (isDirectSub) {
                        const folderName = parts[parts.length - 1];
                        if (!folders.has(folderName)) {
                            folders.set(folderName, { fileCount: 0 });
                        }
                    }
                }
            });

            // Group existing files from Google Sheets or local uploads using the folderPath parameter
            documentInventory.forEach(doc => {
                const folderPathStr = doc.folderPath ? doc.folderPath.trim() : "";
                const parts = folderPathStr ? folderPathStr.split("/") : [];

                // Is it exactly in the current directory?
                const isDirectFile = (parts.length === currentPath.length) && parts.every((val, idx) => val === currentPath[idx]);

                if (isDirectFile) {
                    files.push(doc);
                } else if (parts.length > currentPath.length) {
                    // Is it a child folder or nested underneath?
                    const isSubPath = currentPath.every((val, idx) => val === parts[idx]);
                    if (isSubPath) {
                        const directSubName = parts[currentPath.length];
                        if (directSubName) {
                            if (!folders.has(directSubName)) {
                                folders.set(directSubName, { fileCount: 0 });
                            }
                            folders.get(directSubName).fileCount++;
                        }
                    }
                }
            });

            return {
                folders: Array.from(folders.entries()).map(([name, data]) => ({ name, fileCount: data.fileCount })),
                files: files
            };
        }

        // Render breadcrumbs navigation row
        function renderBreadcrumbs() {
            const container = document.getElementById('breadcrumbs');
            if (!container) return;

            let markup = `<span class="breadcrumb-item" onclick="navigateBreadcrumb(-1)">📁 ROOT</span>`;

            currentPath.forEach((folderName, index) => {
                markup += ` <span class="breadcrumb-separator">/</span> `;
                if (index === currentPath.length - 1) {
                    markup += `<span class="breadcrumb-current">${folderName.toUpperCase()}</span>`;
                } else {
                    markup += `<span class="breadcrumb-item" onclick="navigateBreadcrumb(${index})">${folderName.toUpperCase()}</span>`;
                }
            });

            container.innerHTML = markup;
        }

        // Navigation actions
        window.openFolder = function(folderName) {
            currentPath.push(folderName);
            // Clear searchbox so we view the clean folder contents
            document.getElementById('searchBox').value = "";
            renderVault();
        };

        window.navigateBreadcrumb = function(index) {
            if (index === -1) {
                currentPath = [];
            } else {
                currentPath = currentPath.slice(0, index + 1);
            }
            // Clear searchbox on navigation change
            document.getElementById('searchBox').value = "";
            renderVault();
        };

        window.navigateHome = function() {
            currentPath = [];
            document.getElementById('searchBox').value = "";
            renderVault();
        };

        window.navigateBack = function() {
            if (currentPath.length > 0) {
                currentPath.pop();
                document.getElementById('searchBox').value = "";
                renderVault();
            }
        };

        window.refreshDatabase = async function() {
            const refreshBtn = document.getElementById('navRefreshBtn');
            if (refreshBtn) {
                refreshBtn.classList.add('loading');
            }
            try {
                // Fetch and update the directory metadata index asynchronously, keeping browser and app state
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
            grid.innerHTML = "";
            const term = filterTerm.toLowerCase().trim();

            // Dynamic nav controls button state updating
            const homeBtn = document.getElementById('navHomeBtn');
            const backBtn = document.getElementById('navBackBtn');
            if (homeBtn) {
                homeBtn.disabled = (currentPath.length === 0);
            }
            if (backBtn) {
                backBtn.disabled = (currentPath.length === 0);
            }

            // Sync clipboard indicator UI
            if (typeof updateClipboardUI === "function") {
                updateClipboardUI();
            }

            // If searched, flat render ALL matching records
            if (term.length > 0) {
                // Hide breadcrumbs container when searching globally
                document.getElementById('breadcrumbs').style.display = 'none';

                const matches = documentInventory.filter(doc => {
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
                    card.innerHTML = `
                        <div class="file-icon">📄</div>
                        <div class="doc-meta" style="flex: 1;">
                            <h3>${doc.title || "Unidentified Asset"}</h3>
                            <p><strong>Tracking Registry:</strong> ${doc.id || "N/A"}</p>
                            ${doc.category ? `<p><strong>Category Tag:</strong> ${doc.category}</p>` : ""}
                            <p><strong>Description:</strong> ${doc.description || "None"}</p>
                            <span class="tag-pill">📂 ${doc.folderPath ? doc.folderPath.replace(/\//g, " / ") : "Root"}</span>
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

            // Normal Folder View navigation
            document.getElementById('breadcrumbs').style.display = 'flex';
            renderBreadcrumbs();

            const contents = getDirectoryContents();

            if (contents.folders.length === 0 && contents.files.length === 0) {
                grid.innerHTML = `<p style="color: var(--text-muted); padding: 20px 0;">THIS FOLDER IS CURRENTLY EMPTY.</p>`;
                return;
            }

            // 1. Render subfolders
            contents.folders.forEach(fold => {
                const card = document.createElement('div');
                card.className = 'folder-card';
                card.onclick = (e) => {
                    if (e.target.closest('.card-options-container')) return;
                    openFolder(fold.name);
                };
                card.innerHTML = `
                    <div class="folder-icon">📁</div>
                    <div class="folder-meta">
                        <h3>${fold.name}</h3>
                        <p>${fold.fileCount} ${fold.fileCount === 1 ? 'file' : 'files'}</p>
                    </div>
                    <div class="card-options-container" onclick="event.stopPropagation()">
                        <button class="card-options-btn" onclick="toggleCardOptions(event, 'fold-${fold.name}')" title="More options">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1.5"></circle><circle cx="12" cy="5" r="1.5"></circle><circle cx="12" cy="19" r="1.5"></circle></svg>
                        </button>
                        <div id="fold-${fold.name}-menu" class="options-dropdown-menu">
                            <button class="options-dropdown-item" onclick="viewDetails(event, 'folder', null, '${fold.name}')">🔬 Details</button>
                            <button class="options-dropdown-item" onclick="copyItem(event, 'folder', null, '${fold.name}')">📋 Copy</button>
                            <button class="options-dropdown-item" onclick="triggerRename(event, 'folder', null, '${fold.name}')">✏️ Rename</button>
                            <button class="options-dropdown-item delete-item" onclick="triggerDelete(event, 'folder', null, '${fold.name}')">🗑️ Delete</button>
                        </div>
                    </div>
                `;
                grid.appendChild(card);
            });

            // 2. Render files
            contents.files.forEach(doc => {
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
                        <span class="tag-pill">📂 ${currentPath.join(" / ") || "Root"}</span>
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

            const pathStr = currentPath.join("/");
            categoryInput.value = pathStr; // can be empty string for Root
            if (categoryDisplay) {
                categoryDisplay.value = pathStr ? `📁 ${pathStr.replace(/\//g, " / ")}` : "📁 ROOT";
            }
        }

        // Create virtual folder in memory and localStorage
        function createCustomFolder(folderName) {
            const sanitized = folderName.replace(/\//g, "").trim();
            if (!sanitized) return;

            const fullPathStr = currentPath.length > 0 ? [...currentPath, sanitized].join("/") : sanitized;

            let emptyFolders = [];
            try {
                emptyFolders = JSON.parse(localStorage.getItem("vault_custom_empty_folders")) || [];
            } catch (e) {
                emptyFolders = [];
            }

            if (!emptyFolders.includes(fullPathStr)) {
                emptyFolders.push(fullPathStr);
                localStorage.setItem("vault_custom_empty_folders", JSON.stringify(emptyFolders));
            }

            // Immediately step inside the newly provisioned directory
            openFolder(sanitized);
        }

        // Saves uploaded documents directly into our persistent local storage vault
        function saveLocalUpload(name, type, category, folderPath, description, base64Data) {
            let localUploads = [];
            try {
                localUploads = JSON.parse(localStorage.getItem("vault_local_files")) || [];
            } catch(e) {
                localUploads = [];
            }
            
            const newId = "VAL-" + Math.floor(1000 + Math.random() * 9000);
            const dataUrl = `data:${type};base64,${base64Data}`;
            
            const newDoc = {
                id: newId,
                title: name,
                category: category,
                folderPath: folderPath,
                description: description,
                driveLink: dataUrl // clicking Pull Copy triggers directly downloading or displaying the actual data!
            };
            
            localUploads.push(newDoc);
            localStorage.setItem("vault_local_files", JSON.stringify(localUploads));
            
            // Map the folder position locally
            try {
                let sheetFolderMap = JSON.parse(localStorage.getItem("vault_file_folders_map")) || {};
                sheetFolderMap[newId] = folderPath;
                sheetFolderMap[name] = folderPath;
                localStorage.setItem("vault_file_folders_map", JSON.stringify(sheetFolderMap));
            } catch (err) {}

            // Append and merge into the active memory inventory
            const exists = documentInventory.some(doc => doc.id === newId);
            if (!exists) {
                documentInventory.push(newDoc);
            }
            renderVault();
        }

        // 2. Form submission and Base64 conversion logic
        document.getElementById('uploadForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const submitBtn = document.getElementById('submitBtn');
            const fileInput = document.getElementById('fileInput');
            const file = fileInput.files[0];
            
            const assetTypeEl = document.getElementById('assetType');
            const assetType = assetTypeEl ? assetTypeEl.value : (file ? 'File' : 'Folder');
            
            if (assetType === 'File' && !file) return;

            const customName = document.getElementById('fileNameInput').value.trim() || (file ? file.name : "New Folder");
            const categoryTag = document.getElementById('fileCategoryTagInput').value.trim() || (assetType === 'Folder' ? "Folder" : "Other");
            const folderPath = document.getElementById('fileCategory').value; // represents folder location path from directory state
            const description = document.getElementById('fileDescription').value;

            submitBtn.disabled = true;
            submitBtn.innerText = "CONVERTING & TRANSMITTING...";

            if (assetType === 'Folder') {
                const payload = {
                    fileName: customName,
                    fileType: 'application/x-folder',
                    fileCategory: categoryTag, // Written to the 'category' sheet column
                    fileDescription: description,
                    fileBase64: 'DIRECTORY_ENTRY'
                };

                // Store folder location map in advance so it syncs up nicely on refresh
                try {
                    let sheetFolderMap = JSON.parse(localStorage.getItem("vault_file_folders_map")) || {};
                    sheetFolderMap[customName] = folderPath;
                    localStorage.setItem("vault_file_folders_map", JSON.stringify(sheetFolderMap));
                } catch (e) {}

                // Register empty folder locally to display it immediately
                try {
                    const fullPathStr = folderPath ? `${folderPath}/${customName}` : customName;
                    let emptyFolders = JSON.parse(localStorage.getItem("vault_custom_empty_folders")) || [];
                    if (!emptyFolders.includes(fullPathStr)) {
                        emptyFolders.push(fullPathStr);
                        localStorage.setItem("vault_custom_empty_folders", JSON.stringify(emptyFolders));
                    }
                } catch (e) {}

                try {
                    if (!BACKEND_API_URL || BACKEND_API_URL.startsWith("PASTE_")) {
                        throw new Error("Apps Script URL unconfigured");
                    }

                    const response = await fetch(BACKEND_API_URL, {
                        method: "POST",
                        body: JSON.stringify(payload)
                    });
                    const resData = await response.json();

                    if (resData.status === "SUCCESS") {
                        if (resData.id) {
                            try {
                                let sheetFolderMap = JSON.parse(localStorage.getItem("vault_file_folders_map")) || {};
                                sheetFolderMap[resData.id] = folderPath;
                                localStorage.setItem("vault_file_folders_map", JSON.stringify(sheetFolderMap));
                            } catch (e) {}
                        }
                        alert("Secure fold sync confirmed! Folder registered in sheets database.");
                        closeModal();
                        document.getElementById('uploadForm').reset();
                        fetchDatabase(); // Force interface live reload sync loop
                    } else {
                        throw new Error(resData.message || "Storage rejected transmission");
                    }
                } catch(error) {
                    console.warn("Cloud transmission bypassed. Storing folder locally inside Secured Sandboxed storage:", error);
                    
                    const newId = "VAL-" + Math.floor(1000 + Math.random() * 9000);
                    const newDoc = {
                        id: newId,
                        title: customName,
                        category: categoryTag,
                        folderPath: folderPath,
                        description: description,
                        driveLink: "javascript:void(0)"
                    };
                    
                    let localUploads = [];
                    try {
                        localUploads = JSON.parse(localStorage.getItem("vault_local_files")) || [];
                    } catch(e) {}
                    localUploads.push(newDoc);
                    localStorage.setItem("vault_local_files", JSON.stringify(localUploads));
                    
                    alert("Local sandbox sync verified! Folder successfully indexed and saved to secure offline local storage.");
                    closeModal();
                    document.getElementById('uploadForm').reset();
                    renderVault();
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.innerText = "EXECUTE UPLOAD";
                }
            } else {
                // If assetType is 'File', maintain standard FileReader binary-to-base64 conversion pipeline
                const reader = new FileReader();
                reader.readAsDataURL(file); // Converts physical binary into base64 url data signature
                
                reader.onload = async function() {
                    const base64String = reader.result.split(',')[1]; // Strip data descriptor header metadata
                    
                    const payload = {
                        fileName: customName,
                        fileType: file.type,
                        fileCategory: categoryTag, // Written to the 'category' sheet column
                        fileDescription: description,
                        fileBase64: base64String
                    };

                    // Store folder location map in advance so it syncs up nicely on refresh
                    try {
                        let sheetFolderMap = JSON.parse(localStorage.getItem("vault_file_folders_map")) || {};
                        sheetFolderMap[customName] = folderPath;
                        localStorage.setItem("vault_file_folders_map", JSON.stringify(sheetFolderMap));
                    } catch (e) {}

                    try {
                        if (!BACKEND_API_URL || BACKEND_API_URL.startsWith("PASTE_")) {
                            throw new Error("Apps Script URL unconfigured");
                        }

                        const response = await fetch(BACKEND_API_URL, {
                            method: "POST",
                            body: JSON.stringify(payload)
                        });
                        const resData = await response.json();

                        if (resData.status === "SUCCESS") {
                            // If response returns ID, save folder mapping under that ID too
                            if (resData.id) {
                                try {
                                    let sheetFolderMap = JSON.parse(localStorage.getItem("vault_file_folders_map")) || {};
                                    sheetFolderMap[resData.id] = folderPath;
                                    localStorage.setItem("vault_file_folders_map", JSON.stringify(sheetFolderMap));
                                } catch (e) {}
                            }
                            alert("Secure sync confirmed! Row written to sheet and file deposited in Drive.");
                            closeModal();
                            document.getElementById('uploadForm').reset();
                            fetchDatabase(); // Force interface live reload sync loop
                        } else {
                            throw new Error(resData.message || "Storage rejected transmission");
                        }
                    } catch(error) {
                        console.warn("Cloud transmission bypassed. Storing locally inside Secured Sandboxed storage:", error);
                        
                        // Save document metadata and physical payload directly into localStorage index
                        saveLocalUpload(customName, file.type, categoryTag, folderPath, description, base64String);
                        
                        alert("Local sandbox sync verified! Document successfully indexed and saved to secure offline local storage.");
                        closeModal();
                        document.getElementById('uploadForm').reset();
                    } finally {
                        submitBtn.disabled = false;
                        submitBtn.innerText = "EXECUTE UPLOAD";
                    }
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
                                        <p>SHEETS_RAW_DB="${SHEETS_CSV_URL}"</p>
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
        window.viewDetails = function(event, type, id, folderName) {
            if (event) event.stopPropagation();
            
            // Close opened context menu dropdowns
            document.querySelectorAll('.options-dropdown-menu').forEach(menu => {
                menu.classList.remove('active');
            });

            const contentEl = document.getElementById('detailsContent');
            if (!contentEl) return;

            if (type === 'folder') {
                const folderPath = currentPath.join("/") + (currentPath.length > 0 ? "/" : "") + folderName;
                const count = documentInventory.filter(doc => {
                    const cat = doc.category || "";
                    return cat === folderPath || cat.startsWith(folderPath + "/");
                }).length;

                contentEl.innerHTML = `
                    <div class="details-row">
                        <span class="details-key">Entry Type</span>
                        <span class="details-val">📁 FOLDER</span>
                    </div>
                    <div class="details-row">
                        <span class="details-key">Folder Name</span>
                        <span class="details-val" style="font-weight: bold; color: var(--accent);">${folderName}</span>
                    </div>
                    <div class="details-row">
                        <span class="details-key">Registry Path</span>
                        <span class="details-val">${folderPath.replace(/\//g, " / ")}</span>
                    </div>
                    <div class="details-row">
                        <span class="details-key">Document Count</span>
                        <span class="details-val">${count} index(es) recorded in this directory branch</span>
                    </div>
                    <div class="details-row">
                        <span class="details-key">Operational Class</span>
                        <span class="details-val">Virtual archive index partition</span>
                    </div>
                `;
            } else if (type === 'file') {
                const doc = documentInventory.find(item => item.id === id);
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
        window.triggerRename = function(event, type, id, folderName) {
            if (event) event.stopPropagation();

            // Close context menu dropdowns
            document.querySelectorAll('.options-dropdown-menu').forEach(menu => {
                menu.classList.remove('active');
            });

            const renameInput = document.getElementById('renameInput');
            const renameLabel = document.getElementById('renameLabel');
            
            document.getElementById('renameTargetType').value = type;
            document.getElementById('renameTargetId').value = (type === 'folder' ? folderName : id);

            if (type === 'folder') {
                document.getElementById('renameTargetOldName').value = folderName;
                renameLabel.innerText = "NEW FOLDER NAME";
                if (renameInput) renameInput.value = folderName;
            } else {
                const doc = documentInventory.find(item => item.id === id);
                const oldTitle = doc ? doc.title : "";
                document.getElementById('renameTargetOldName').value = oldTitle;
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
            const oldName = document.getElementById('renameTargetOldName').value;
            const newName = document.getElementById('renameInput').value.trim();

            if (!newName) return;

            if (type === 'folder') {
                const oldFolderPath = currentPath.join("/") + (currentPath.length > 0 ? "/" : "") + oldName;
                const newFolderPath = currentPath.join("/") + (currentPath.length > 0 ? "/" : "") + newName;

                // 1. Update empty folders array
                let emptyFolders = [];
                try {
                    emptyFolders = JSON.parse(localStorage.getItem("vault_custom_empty_folders")) || [];
                } catch (err) {}
                emptyFolders = emptyFolders.map(p => {
                    if (p === oldFolderPath) {
                        return newFolderPath;
                    } else if (p.startsWith(oldFolderPath + "/")) {
                        return newFolderPath + p.substring(oldFolderPath.length);
                    }
                    return p;
                });
                localStorage.setItem("vault_custom_empty_folders", JSON.stringify(emptyFolders));

                // 2. Update local files array categories
                let localUploads = [];
                try {
                    localUploads = JSON.parse(localStorage.getItem("vault_local_files")) || [];
                } catch (err) {}
                localUploads.forEach(doc => {
                    const cat = doc.category || "";
                    if (cat === oldFolderPath) {
                        doc.category = newFolderPath;
                    } else if (cat.startsWith(oldFolderPath + "/")) {
                        doc.category = newFolderPath + cat.substring(oldFolderPath.length);
                    }
                });
                localStorage.setItem("vault_local_files", JSON.stringify(localUploads));

                // 3. Update memory document inventory categories
                documentInventory.forEach(doc => {
                    const cat = doc.category || "";
                    if (cat === oldFolderPath) {
                        doc.category = newFolderPath;
                    } else if (cat.startsWith(oldFolderPath + "/")) {
                        doc.category = newFolderPath + cat.substring(oldFolderPath.length);
                    }
                });

            } else if (type === 'file') {
                // 1. Update localStorage uploads title
                let localUploads = [];
                try {
                    localUploads = JSON.parse(localStorage.getItem("vault_local_files")) || [];
                } catch (err) {}
                localUploads.forEach(doc => {
                    if (doc.id === targetId) {
                        doc.title = newName;
                    }
                });
                localStorage.setItem("vault_local_files", JSON.stringify(localUploads));

                // 2. Update memory document inventory title
                documentInventory.forEach(doc => {
                    if (doc.id === targetId) {
                        doc.title = newName;
                    }
                });
            }

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

            const doc = documentInventory.find(item => item.id === id);
            if (doc) {
                triggerDirectFileDownload(doc.driveLink, doc.title);
            }
        };

        // Modal Action: INITIATE DELETE WARNING DIALOG
        window.triggerDelete = function(event, type, id, folderName) {
            if (event) event.stopPropagation();

            // Close context menu dropdowns
            document.querySelectorAll('.options-dropdown-menu').forEach(menu => {
                menu.classList.remove('active');
            });

            document.getElementById('deleteTargetType').value = type;
            document.getElementById('deleteTargetId').value = (type === 'folder' ? folderName : id);

            const promptEl = document.getElementById('deletePromptMessage');
            if (type === 'folder') {
                promptEl.innerHTML = `You are about to initiate an offline system purge sequence for folder <strong style="color: var(--accent);">${folderName}</strong> and ALL nested subfolders or documents contained inside it.`;
            } else {
                const doc = documentInventory.find(item => item.id === id);
                const title = doc ? doc.title : "Unidentified Asset";
                promptEl.innerHTML = `You are about to initiate an offline system purge sequence for document <strong style="color: var(--accent);">${title}</strong> (Registry index: ${id}).`;
            }

            document.getElementById('deleteModal').classList.add('active');
        };

        window.closeDeleteModal = function() {
            document.getElementById('deleteModal').classList.remove('active');
            document.getElementById('deleteForm').reset();
        };

        // Handle delete wipe submissions
        document.getElementById('deleteForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            const type = document.getElementById('deleteTargetType').value;
            const targetId = document.getElementById('deleteTargetId').value;
            const submitBtn = document.getElementById('submitDeleteBtn');

            if (type === 'file') {
                const doc = documentInventory.find(item => item.id === targetId);
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
                        alert("Cloud synchronization unavailable. Purged file reference from local sandbox interface. Please note the underlying cloud copy might need manual cleanup if Google Drive limits API interaction.");
                    } finally {
                        submitBtn.disabled = false;
                        submitBtn.innerText = "CONFIRM PURGE";
                    }
                }

                // 1. Remove files matching matching ID from localStorage
                let localUploads = [];
                try {
                    localUploads = JSON.parse(localStorage.getItem("vault_local_files")) || [];
                } catch (err) {}
                localUploads = localUploads.filter(doc => doc.id !== targetId);
                localStorage.setItem("vault_local_files", JSON.stringify(localUploads));

                // 2. Remove files matching matching ID from memory inventory
                documentInventory = documentInventory.filter(doc => doc.id !== targetId);

                // 3. Clear from folders mapping
                try {
                    let sheetFolderMap = JSON.parse(localStorage.getItem("vault_file_folders_map")) || {};
                    delete sheetFolderMap[targetId];
                    localStorage.setItem("vault_file_folders_map", JSON.stringify(sheetFolderMap));
                } catch (err) {}

            } else if (type === 'folder') {
                const targetPath = currentPath.join("/") + (currentPath.length > 0 ? "/" : "") + targetId;

                // Gather all nested documents underneath this folder branch
                const filesToDelete = documentInventory.filter(doc => {
                    const folder = doc.folderPath || "";
                    return folder === targetPath || folder.startsWith(targetPath + "/");
                });

                // Retrieve all subset files that live on the cloud Drive
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

                // 1. Remove from empty folders array
                let emptyFolders = [];
                try {
                    emptyFolders = JSON.parse(localStorage.getItem("vault_custom_empty_folders")) || [];
                } catch (err) {}
                emptyFolders = emptyFolders.filter(p => p !== targetPath && !p.startsWith(targetPath + "/"));
                localStorage.setItem("vault_custom_empty_folders", JSON.stringify(emptyFolders));

                // 2. Remove files under this folder path from Local Storage
                let localUploads = [];
                try {
                    localUploads = JSON.parse(localStorage.getItem("vault_local_files")) || [];
                } catch (err) {}
                localUploads = localUploads.filter(doc => {
                    const folder = doc.folderPath || "";
                    return folder !== targetPath && !folder.startsWith(targetPath + "/");
                });
                localStorage.setItem("vault_local_files", JSON.stringify(localUploads));

                // 3. Remove files under this folder path from memory inventory
                documentInventory = documentInventory.filter(doc => {
                    const folder = doc.folderPath || "";
                    return folder !== targetPath && !folder.startsWith(targetPath + "/");
                });

                // 4. Remove folder entries from folder path mapping
                try {
                    let sheetFolderMap = JSON.parse(localStorage.getItem("vault_file_folders_map")) || {};
                    for (const key in sheetFolderMap) {
                        const folder = sheetFolderMap[key] || "";
                        if (folder === targetPath || folder.startsWith(targetPath + "/")) {
                            delete sheetFolderMap[key];
                        }
                    }
                    localStorage.setItem("vault_file_folders_map", JSON.stringify(sheetFolderMap));
                } catch (err) {}
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

        window.copyItem = function(event, type, id, folderName) {
            if (event) event.stopPropagation();

            // Close context menu dropdowns
            document.querySelectorAll('.options-dropdown-menu').forEach(menu => {
                menu.classList.remove('active');
            });

            if (type === 'file') {
                const doc = documentInventory.find(item => item.id === id);
                if (!doc) return;
                clipboard = {
                    type: 'file',
                    id: doc.id,
                    name: doc.title,
                    sourcePath: doc.folderPath || ""
                };
            } else if (type === 'folder') {
                const folderPath = currentPath.join("/") + (currentPath.length > 0 ? "/" : "") + folderName;
                clipboard = {
                    type: 'folder',
                    id: folderName,
                    name: folderName,
                    sourcePath: folderPath
                };
            }

            localStorage.setItem("vault_clipboard_storage", JSON.stringify(clipboard));
            window.updateClipboardUI();
        };

        window.pasteItem = function() {
            if (!clipboard) return;

            const destPath = currentPath.join("/");

            if (clipboard.type === 'file') {
                const doc = documentInventory.find(item => item.id === clipboard.id);
                if (!doc) {
                    alert("Source file not found (it may have been deleted).");
                    clipboard = null;
                    localStorage.removeItem("vault_clipboard_storage");
                    window.updateClipboardUI();
                    return;
                }

                let newTitle = doc.title || "Untitled File";
                const contents = getDirectoryContents();
                let fileExists = contents.files.some(f => f.title === newTitle);
                
                if (fileExists) {
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
                    folderPath: destPath,
                    description: doc.description || "",
                    driveLink: doc.driveLink
                };

                let localUploads = [];
                try {
                    localUploads = JSON.parse(localStorage.getItem("vault_local_files")) || [];
                } catch(e) {}
                localUploads.push(clonedDoc);
                localStorage.setItem("vault_local_files", JSON.stringify(localUploads));

                // Save folder mapping
                try {
                    let sheetFolderMap = JSON.parse(localStorage.getItem("vault_file_folders_map")) || {};
                    sheetFolderMap[newId] = destPath;
                    sheetFolderMap[newTitle] = destPath;
                    localStorage.setItem("vault_file_folders_map", JSON.stringify(sheetFolderMap));
                } catch (e) {}

                // Push inside active memory
                const exists = documentInventory.some(doc => doc.id === newId);
                if (!exists) {
                    documentInventory.push(clonedDoc);
                }

            } else if (clipboard.type === 'folder') {
                const sourcePath = clipboard.sourcePath;
                const folderName = clipboard.name;

                if (sourcePath === destPath || sourcePath === destPath + "/" + folderName || destPath.startsWith(sourcePath + "/")) {
                    alert("A folder cannot be copied into itself or nested underneath its own directory structure.");
                    return;
                }

                let newFolderName = folderName;
                const contents = getDirectoryContents();
                let folderExists = contents.folders.some(f => f.name === newFolderName);
                while (folderExists) {
                    newFolderName = newFolderName + " - Copy";
                    folderExists = contents.folders.some(f => f.name === newFolderName);
                }

                const newFolderPath = destPath + (destPath.length > 0 ? "/" : "") + newFolderName;

                // 1. Add new folder registry to empty folders
                let emptyFolders = [];
                try {
                    emptyFolders = JSON.parse(localStorage.getItem("vault_custom_empty_folders")) || [];
                } catch (e) {}
                if (!emptyFolders.includes(newFolderPath)) {
                    emptyFolders.push(newFolderPath);
                }

                // 2. Scan and clone subfolders
                emptyFolders.forEach(p => {
                    if (p.startsWith(sourcePath + "/")) {
                        const subSuffix = p.substring(sourcePath.length);
                        const targetSubPath = newFolderPath + subSuffix;
                        if (!emptyFolders.includes(targetSubPath)) {
                            emptyFolders.push(targetSubPath);
                        }
                    }
                });
                localStorage.setItem("vault_custom_empty_folders", JSON.stringify(emptyFolders));

                // 3. Scan and clone descendant files
                let localUploads = [];
                try {
                    localUploads = JSON.parse(localStorage.getItem("vault_local_files")) || [];
                } catch (e) {}

                let sheetFolderMap = {};
                try {
                    sheetFolderMap = JSON.parse(localStorage.getItem("vault_file_folders_map")) || {};
                } catch (e) {}

                const filesToClone = documentInventory.filter(doc => {
                    const fPath = doc.folderPath || "";
                    return fPath === sourcePath || fPath.startsWith(sourcePath + "/");
                });

                filesToClone.forEach(doc => {
                    const relativePath = doc.folderPath.substring(sourcePath.length);
                    const targetFileFolderPath = newFolderPath + relativePath;

                    const newId = "VAL-" + Math.floor(1000 + Math.random() * 9000);
                    const clonedDoc = {
                        id: newId,
                        title: doc.title,
                        category: doc.category || "Other",
                        folderPath: targetFileFolderPath,
                        description: doc.description || "",
                        driveLink: doc.driveLink
                    };

                    localUploads.push(clonedDoc);
                    sheetFolderMap[newId] = targetFileFolderPath;
                    sheetFolderMap[doc.title] = targetFileFolderPath;

                    // Push clonedDoc directly to active memory
                    documentInventory.push(clonedDoc);
                });

                localStorage.setItem("vault_local_files", JSON.stringify(localUploads));
                localStorage.setItem("vault_file_folders_map", JSON.stringify(sheetFolderMap));
            }

            renderVault();
        };

        // Start checking registry sync on system initialization load
        fetchDatabase();