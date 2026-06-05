        // ==========================================
        // CRITICAL: WIRE UP YOUR LINKS HERE
        // ==========================================
        const BACKEND_API_URL = "https://script.google.com/macros/s/AKfycbz2l6cQkl3tTDk75GthnMQwKTxRNMYsHxz_AE8mlR-Iq_rJ5i3sBx-8gZHMvfpQyNfD/exec";
        const SHEETS_CSV_URL  = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQsEc_TZ1SB0jVoBqyRPyEeQBDx6IyKRJ71iPx0ReMWnhVoNJqEmSUhVJufc7MqKHICZPkYZIsne8iv/pub?output=csv";

        const DEFAULT_CATEGORIES = ["Education", "Identification", "Admission", "Other"];
        let documentInventory = [];
        let currentPath = []; // Array of strings representing current folder path, e.g. ["Education", "2026"]

        // 1. Fetch data from Google Sheets CSV on load
        async function fetchDatabase() {
            if (!SHEETS_CSV_URL || SHEETS_CSV_URL.startsWith("PASTE_")) return;
            try {
                const response = await fetch(SHEETS_CSV_URL);
                const dataText = await response.text();
                parseCSV(dataText);
                
                const searchBox = document.getElementById('searchBox');
                searchBox.disabled = false;
                searchBox.placeholder = "Search by file name, category, or descriptions...";
                renderVault();
            } catch (err) {
                console.error("Fetch synced framework crash:", err);
                document.getElementById('vaultGrid').innerHTML = "<p style='color:var(--error-color)'>CRITICAL CONNECTION INTERRUPT: DATABASE REFUSED PARSING.</p>";
            }
        }

        // Lightweight safe row splitter
        function parseCSV(text) {
            const lines = text.split("\n");
            if (lines.length < 1) return;
            const headers = lines[0].split(",").map(h => h.trim().replace(/["']/g, ""));
            documentInventory = [];

            for (let i = 1; i < lines.length; i++) {
                if (!lines[i].trim()) continue;
                // Simple CSV line splitter, keeping splits inside quotes safe
                const currentLine = parseCSVLine(lines[i]);
                const obj = {};
                headers.forEach((header, idx) => {
                    let value = currentLine[idx] ? currentLine[idx].trim() : "";
                    obj[header] = value.replace(/^["']|["']$/g, ""); // Clean string bounds
                });
                documentInventory.push(obj);
            }
        }

        // Safer CSV cell splitter that handles commas inside quotes (avoiding splitting description commas!)
        function parseCSVLine(line) {
            const result = [];
            let current = "";
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"' || char === "'") {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    result.push(current);
                    current = "";
                } else {
                    current += char;
                }
            }
            result.push(current);
            return result;
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

            // Group existing files from Google Sheets
            documentInventory.forEach(doc => {
                const catStr = doc.category || "Other";
                const parts = catStr.split("/");

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
            const btn = document.getElementById('navRefreshBtn');
            if (btn) {
                btn.classList.add('loading');
                btn.disabled = true;
            }
            try {
                await fetchDatabase();
            } catch (err) {
                console.error("Database sync fresh trigger failed:", err);
            } finally {
                if (btn) {
                    btn.classList.remove('loading');
                    btn.disabled = false;
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
                    card.innerHTML = `
                        <div class="file-icon">📄</div>
                        <div class="doc-meta" style="flex: 1;">
                            <h3>${doc.title || "Unidentified Asset"}</h3>
                            <p><strong>Tracking Registry:</strong> ${doc.id || "N/A"}</p>
                            <p><strong>Description:</strong> ${doc.description || "None"}</p>
                            ${doc.category ? `<span class="tag-pill">📍 ${doc.category.replace(/\//g, " / ")}</span>` : ""}
                        </div>
                        <a href="${doc.driveLink}" target="_blank" class="view-btn">Pull Copy</a>
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
                card.onclick = () => openFolder(fold.name);
                card.innerHTML = `
                    <div class="folder-icon">📁</div>
                    <div class="folder-meta">
                        <h3>${fold.name}</h3>
                        <p>${fold.fileCount} ${fold.fileCount === 1 ? 'file' : 'files'}</p>
                    </div>
                `;
                grid.appendChild(card);
            });

            // 2. Render files
            contents.files.forEach(doc => {
                const card = document.createElement('div');
                card.className = 'doc-card';
                card.innerHTML = `
                    <div class="file-icon">📄</div>
                    <div class="doc-meta" style="flex: 1;">
                        <h3>${doc.title || "Unidentified Asset"}</h3>
                        <p><strong>Tracking Registry:</strong> ${doc.id || "N/A"}</p>
                        <p><strong>Description:</strong> ${doc.description || "None"}</p>
                        <span class="tag-pill">📂 ${currentPath.join(" / ") || "Root"}</span>
                    </div>
                    <a href="${doc.driveLink}" target="_blank" class="view-btn">Pull Copy</a>
                `;
                grid.appendChild(card);
            });
        }

        // Dynamically compile category option lists for file inputs
        function populateCategoryOptions() {
            const select = document.getElementById('fileCategory');
            if (!select) return;

            const allPaths = new Set(DEFAULT_CATEGORIES);

            // Harvest values from existing Google Sheet documents
            documentInventory.forEach(doc => {
                if (doc.category) {
                    const parts = doc.category.split("/");
                    let current = "";
                    parts.forEach(part => {
                        current = current ? (current + "/" + part) : part;
                        allPaths.add(current);
                    });
                }
            });

            // Harvest custom empty folders
            let emptyFolders = [];
            try {
                emptyFolders = JSON.parse(localStorage.getItem("vault_custom_empty_folders")) || [];
            } catch (e) {}
            emptyFolders.forEach(pathStr => allPaths.add(pathStr));

            // Sort standard paths alphabetically
            const sortedPaths = Array.from(allPaths).sort();

            select.innerHTML = "";
            sortedPaths.forEach(pathStr => {
                const option = document.createElement('option');
                option.value = pathStr;
                option.textContent = pathStr.replace(/\//g, " / ");
                select.appendChild(option);
            });

            // Auto select current active directory
            const currentPathStr = currentPath.join("/");
            if (currentPathStr) {
                if (!allPaths.has(currentPathStr)) {
                    const opt = document.createElement('option');
                    opt.value = currentPathStr;
                    opt.textContent = currentPathStr.replace(/\//g, " / ");
                    select.appendChild(opt);
                }
                select.value = currentPathStr;
            } else {
                select.value = "Other"; // Root default
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

        // 2. Form submission and Base64 conversion logic
        document.getElementById('uploadForm').addEventListener('submit', function(e) {
            e.preventDefault();
            
            const submitBtn = document.getElementById('submitBtn');
            const fileInput = document.getElementById('fileInput');
            const file = fileInput.files[0];
            
            if (!file) return;

            submitBtn.disabled = true;
            submitBtn.innerText = "CONVERTING & TRANSMITTING...";

            const reader = new FileReader();
            reader.readAsDataURL(file); // Converts physical binary into base64 url data signature
            
            reader.onload = async function() {
                const base64String = reader.result.split(',')[1]; // Strip data descriptor header metadata
                
                const payload = {
                    fileName: file.name,
                    fileType: file.type,
                    fileCategory: document.getElementById('fileCategory').value,
                    fileDescription: document.getElementById('fileDescription').value,
                    fileBase64: base64String
                };

                try {
                    const response = await fetch(BACKEND_API_URL, {
                        method: "POST",
                        body: JSON.stringify(payload)
                    });
                    const resData = await response.json();

                    if (resData.status === "SUCCESS") {
                        alert("Secure sync confirmed! Row written to sheet and file deposited in Drive.");
                        closeModal();
                        document.getElementById('uploadForm').reset();
                        fetchDatabase(); // Force interface live reload sync loop
                    } else {
                        alert("Storage rejected transmission: " + resData.message);
                    }
                } catch(error) {
                    console.error(error);
                    alert("Network transport layer execution error occurred.");
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.innerText = "EXECUTE UPLOAD";
                }
            };
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
        }

        window.openFolderModal = function() {
            document.getElementById('folderModal').classList.add('active');
            document.getElementById('folderNameInput').focus();
        }
        window.closeFolderModal = function() {
            document.getElementById('folderModal').classList.remove('active');
            document.getElementById('folderForm').reset();
        }
        
        // Universal click-away closes the dynamic add record dropdown menu
        document.addEventListener('click', function() {
            const dropdown = document.getElementById('addDropdown');
            if (dropdown) {
                dropdown.classList.remove('active');
            }
        });

        document.getElementById('searchBox').addEventListener('input', (e) => renderVault(e.target.value));

        // Start checking registry sync on system initialization load
        fetchDatabase();