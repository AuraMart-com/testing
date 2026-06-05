        // ==========================================
        // CRITICAL: WIRE UP YOUR LINKS HERE
        // ==========================================
        const BACKEND_API_URL = "https://script.google.com/macros/s/AKfycbz2l6cQkl3tTDk75GthnMQwKTxRNMYsHxz_AE8mlR-Iq_rJ5i3sBx-8gZHMvfpQyNfD/exec";
        const SHEETS_CSV_URL  = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQsEc_TZ1SB0jVoBqyRPyEeQBDx6IyKRJ71iPx0ReMWnhVoNJqEmSUhVJufc7MqKHICZPkYZIsne8iv/pub?output=csv";

        let documentInventory = [];

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
                const currentLine = lines[i].split(",");
                const obj = {};
                headers.forEach((header, idx) => {
                    let value = currentLine[idx] ? currentLine[idx].trim() : "";
                    obj[header] = value.replace(/^["']|["']$/g, ""); // Clean string bounds
                });
                documentInventory.push(obj);
            }
        }

        // Render matching vault records
        function renderVault(filterTerm = "") {
            const grid = document.getElementById('vaultGrid');
            grid.innerHTML = "";
            const term = filterTerm.toLowerCase().trim();

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
                    <div class="doc-meta">
                        <h3>${doc.title || "Unidentified Asset"}</h3>
                        <p><strong>Tracking Registry:</strong> ${doc.id || "N/A"}</p>
                        <p><strong>Description:</strong> ${doc.description || "None"}</p>
                        <span class="tag-pill">${doc.category || "General"}</span>
                    </div>
                    <a href="${doc.driveLink}" target="_blank" class="view-btn">Pull Copy</a>
                `;
                grid.appendChild(card);
            });
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

        // Modal triggers
        window.openModal = function() { document.getElementById('uploadModal').classList.add('active'); }
        window.closeModal = function() { document.getElementById('uploadModal').classList.remove('active'); }
        
        document.getElementById('searchBox').addEventListener('input', (e) => renderVault(e.target.value));

        // Start checking registry sync on system initialization load
        fetchDatabase();