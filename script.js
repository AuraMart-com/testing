// Initialize Lucide Icons
lucide.createIcons();

// Supabase Configuration
const SUPABASE_URL = 'https://arqkzpnqfceqzrymzrnf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFycWt6cG5xZmNlcXpyeW16cm5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2OTI1MzgsImV4cCI6MjA4ODI2ODUzOH0.XIBiWsg1oUcvlxmPXacA5pRWmDL6CgWku3r6CbDuk8Y';
let supabaseClient = null;

try {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log("Supabase initialized successfully");
} catch (e) {
    console.error("Supabase initialization failed", e);
}

// State
let resources = [];
let folders = [];
let currentFolderId = null;
let activeInputMode = 'url'; // 'url' or 'file'
let contextMenuItem = null; // Stores the item currently targeted by context menu

// DOM Elements
const newsFeed = document.getElementById('news-feed');
const resourceGallery = document.getElementById('resource-gallery');
const chatWidget = document.getElementById('chat-widget');
const openChatBtn = document.getElementById('open-chat');
const closeChatBtn = document.getElementById('close-chat');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat');
const chatMessages = document.getElementById('chat-messages');

const quickAddToggle = document.getElementById('quick-add-toggle');
const quickAddMenu = document.getElementById('quick-add-menu');
const addModal = document.getElementById('add-modal');
const folderModal = document.getElementById('folder-modal');
const moveModal = document.getElementById('move-modal');
const newsModal = document.getElementById('news-modal');
const addResourceForm = document.getElementById('add-resource-form');
const addFolderForm = document.getElementById('add-folder-form');

const resTypeSelect = document.getElementById('res-type');
const customTypeContainer = document.getElementById('custom-type-container');
const toggleUrlBtn = document.getElementById('toggle-url');
const toggleFileBtn = document.getElementById('toggle-file');
const urlInputContainer = document.getElementById('url-input-container');
const fileInputContainer = document.getElementById('file-input-container');
const resFileInput = document.getElementById('res-file');
const fileNameDisplay = document.getElementById('file-name-display');
const toastContainer = document.getElementById('toast-container');
const breadcrumbsContainer = document.getElementById('breadcrumbs');
const contextMenu = document.getElementById('context-menu');

// Functions
function showToast(message, icon = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
        <i data-lucide="${icon}" class="w-4 h-4"></i>
        <span>${message}</span>
    `;
    toastContainer.appendChild(toast);
    lucide.createIcons();

    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast("Copied to clipboard!", "check-circle");
    } catch (err) {
        console.error('Failed to copy: ', err);
    }
}

// Modal Handlers
function openModal() {
    addModal.classList.add('active');
    quickAddMenu.classList.remove('active');
}

function closeModal() {
    addModal.classList.remove('active');
    addResourceForm.reset();
    customTypeContainer.classList.add('hidden');
    setInputMode('url');
    fileNameDisplay.classList.add('hidden');
}

function openFolderModal() {
    folderModal.classList.add('active');
    quickAddMenu.classList.remove('active');
}

function closeFolderModal() {
    folderModal.classList.remove('active');
    addFolderForm.reset();
}

function openMoveModal(item) {
    contextMenuItem = item;
    moveModal.classList.add('active');
    renderFolderListForMove();
}

function closeMoveModal() {
    moveModal.classList.remove('active');
    contextMenuItem = null;
}

function openOfflineModal(path) {
    const modal = document.getElementById('offline-modal');
    const input = document.getElementById('offline-path-input');
    input.value = path;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeOfflineModal() {
    const modal = document.getElementById('offline-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function openNewsModal() {
    newsModal.classList.add('active');
    renderNews();
}

function closeNewsModal() {
    newsModal.classList.remove('active');
}

function copyOfflinePath() {
    const input = document.getElementById('offline-path-input');
    copyToClipboard(input.value);
}

// Data Fetching
async function fetchResources() {
    if (!supabaseClient) {
        resources = [];
        folders = [];
        renderResources();
        return;
    }

    try {
        // Fetch Folders
        let folderQuery = supabaseClient.from('folders').select('*');
        if (currentFolderId) {
            folderQuery = folderQuery.eq('parent_id', currentFolderId);
        } else {
            folderQuery = folderQuery.is('parent_id', null);
        }
        const { data: fData, error: fErr } = await folderQuery.order('name', { ascending: true });

        // Fetch Resources
        let resourceQuery = supabaseClient.from('resources').select('*');
        if (currentFolderId) {
            resourceQuery = resourceQuery.eq('folder_id', currentFolderId);
        } else {
            resourceQuery = resourceQuery.is('folder_id', null);
        }
        const { data: rData, error: rErr } = await resourceQuery.order('created_at', { ascending: false });

        if (fErr && fErr.code !== 'PGRST116' && fErr.code !== '42P01') throw fErr; // 42P01 is table not found
        if (rErr) throw rErr;
        
        folders = fData || [];
        resources = rData || [];
        renderResources();
        renderBreadcrumbs();
    } catch (err) {
        console.error("Error fetching data:", err);
        showToast("Failed to fetch data", "alert-circle");
    }
}

// Rendering
function getResourceIcon(type) {
    switch (type) {
        case 'Book': return 'book';
        case 'Video': return 'play-circle';
        case 'Website': return 'globe';
        case 'PDF': return 'file-text';
        default: return 'box';
    }
}

function renderResources() {
    resourceGallery.innerHTML = '';

    if (folders.length === 0 && resources.length === 0) {
        resourceGallery.innerHTML = '<p class="col-span-full text-center text-slate-500 py-10">This folder is empty.</p>';
        return;
    }

    // Render Folders
    folders.forEach((folder, index) => {
        const folderEl = document.createElement('div');
        folderEl.className = 'resource-card group relative bg-[#1e293b] rounded-2xl border border-slate-800 p-4 hover:border-indigo-500 transition-all cursor-pointer animate-fade-in';
        folderEl.style.animationDelay = `${index * 0.05}s`;
        folderEl.innerHTML = `
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 bg-indigo-900/30 rounded-xl flex items-center justify-center text-indigo-400">
                    <i data-lucide="folder" class="w-6 h-6 fill-current"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <h3 class="font-bold text-slate-200 truncate">${folder.name}</h3>
                    <p class="text-[10px] text-slate-500 truncate">${folder.description || 'Folder'}</p>
                </div>
                <button class="more-btn p-2 text-slate-500 hover:text-white rounded-lg hover:bg-slate-800 transition-colors relative z-10">
                    <i data-lucide="more-vertical" class="w-4 h-4"></i>
                </button>
            </div>
        `;
        
        folderEl.addEventListener('click', (e) => {
            if (e.target.closest('.more-btn')) {
                e.stopPropagation();
                showContextMenu(e, folder, 'folder');
            } else {
                navigateToFolder(folder.id);
            }
        });
        
        resourceGallery.appendChild(folderEl);
    });

    // Render Resources
    resources.forEach((res, index) => {
        const resEl = document.createElement('div');
        resEl.className = 'resource-card group relative bg-[#1e293b] rounded-2xl border border-slate-800 p-4 hover:border-indigo-500 transition-all cursor-pointer animate-fade-in';
        resEl.style.animationDelay = `${(folders.length + index) * 0.05}s`;
        
        const icon = getResourceIcon(res.type);
        const displayUrl = res.link_url || '#';
        const isOffline = res.is_offline;
        
        resEl.innerHTML = `
            <div class="flex items-start gap-4">
                <div class="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-indigo-400 transition-colors">
                    <i data-lucide="${icon}" class="w-6 h-6"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-2">
                        <h3 class="font-bold text-slate-200 truncate">${res.title}</h3>
                        <button class="more-btn p-1 text-slate-500 hover:text-white rounded transition-colors relative z-10">
                            <i data-lucide="more-vertical" class="w-4 h-4"></i>
                        </button>
                    </div>
                    <p class="text-xs text-slate-500 truncate mb-2">${res.author || 'Unknown'}</p>
                    <div class="flex items-center gap-2">
                        <span class="text-[10px] font-bold text-indigo-400 flex items-center gap-1">
                            <i data-lucide="${isOffline ? 'hard-drive' : 'external-link'}" class="w-3 h-3"></i>
                            ${isOffline ? 'View Path' : 'Open'}
                        </span>
                        <span class="text-[10px] text-slate-600">•</span>
                        <span class="text-[10px] text-slate-500">${res.type}</span>
                    </div>
                </div>
            </div>
        `;

        resEl.addEventListener('click', (e) => {
            if (e.target.closest('.more-btn')) {
                e.stopPropagation();
                showContextMenu(e, res, 'resource');
            } else {
                if (isOffline) {
                    openOfflineModal(res.link_url);
                } else {
                    window.open(displayUrl, '_blank');
                }
            }
        });

        resourceGallery.appendChild(resEl);
    });

    lucide.createIcons();
}

async function renderBreadcrumbs() {
    breadcrumbsContainer.innerHTML = `
        <button onclick="navigateToFolder(null)" class="hover:text-indigo-400 flex items-center gap-1">
            <i data-lucide="home" class="w-3 h-3"></i>
            Root
        </button>
    `;

    if (currentFolderId) {
        try {
            // In a real app, you'd fetch the full path. Here we just show the current folder name for simplicity
            const { data: folder } = await supabaseClient.from('folders').select('name').eq('id', currentFolderId).single();
            if (folder) {
                breadcrumbsContainer.innerHTML += `
                    <i data-lucide="chevron-right" class="w-3 h-3"></i>
                    <span class="text-slate-300 font-medium">${folder.name}</span>
                `;
            }
        } catch (err) {
            console.error(err);
        }
    }
    lucide.createIcons();
}

function navigateToFolder(id) {
    currentFolderId = id;
    fetchResources();
}

// Context Menu Logic
function showContextMenu(e, item, type) {
    contextMenuItem = { ...item, itemType: type };
    contextMenu.style.display = 'block';
    contextMenu.style.left = `${e.clientX}px`;
    contextMenu.style.top = `${e.clientY}px`;
    
    // Adjust position if it goes off screen
    const menuRect = contextMenu.getBoundingClientRect();
    if (menuRect.right > window.innerWidth) {
        contextMenu.style.left = `${e.clientX - menuRect.width}px`;
    }
    if (menuRect.bottom > window.innerHeight) {
        contextMenu.style.top = `${e.clientY - menuRect.height}px`;
    }
}

function hideContextMenu() {
    contextMenu.style.display = 'none';
}

// Actions
async function deleteItem() {
    if (!contextMenuItem) return;
    const { id, itemType, name, title } = contextMenuItem;
    const label = name || title;

    if (!confirm(`Are you sure you want to delete "${label}"?`)) return;

    try {
        const table = itemType === 'folder' ? 'folders' : 'resources';
        console.log(`Deleting ${itemType} with ID: ${id} from table: ${table}`);
        
        const { error } = await supabaseClient.from(table).delete().eq('id', id);
        if (error) {
            console.error("Supabase delete error:", error);
            throw error;
        }
        
        showToast(`Deleted ${itemType}`, "trash-2");
        fetchResources();
    } catch (err) {
        console.error("Delete operation failed:", err);
        showToast(`Delete failed: ${err.message || 'Unknown error'}`, "alert-circle");
    } finally {
        hideContextMenu();
    }
}

async function renderFolderListForMove() {
    const listContainer = document.getElementById('folder-list-move');
    listContainer.innerHTML = '<p class="text-xs text-slate-500 text-center py-4">Loading folders...</p>';
    
    try {
        const { data: allFolders, error } = await supabaseClient.from('folders').select('*').order('name', { ascending: true });
        if (error) throw error;

        listContainer.innerHTML = `
            <button onclick="selectFolderForMove(null)" class="w-full text-left px-4 py-3 rounded-xl border border-slate-800 hover:border-indigo-500 transition-all flex items-center gap-3 bg-slate-900/50">
                <i data-lucide="home" class="w-4 h-4 text-slate-500"></i>
                <span class="text-sm text-slate-300">Root Directory</span>
            </button>
        `;

        const buildTree = (parentId, depth = 0) => {
            const children = (allFolders || []).filter(f => f.parent_id === parentId);
            children.forEach(f => {
                // Don't allow moving a folder into itself
                if (contextMenuItem.itemType === 'folder' && f.id === contextMenuItem.id) return;
                
                const btn = document.createElement('button');
                btn.onclick = () => selectFolderForMove(f.id);
                btn.className = 'w-full text-left px-4 py-3 rounded-xl border border-slate-800 hover:border-indigo-500 transition-all flex items-center gap-3 bg-slate-900/50';
                btn.style.marginLeft = `${depth * 1.5}rem`;
                btn.innerHTML = `
                    <i data-lucide="folder" class="w-4 h-4 text-indigo-400"></i>
                    <span class="text-sm text-slate-300">${f.name}</span>
                `;
                listContainer.appendChild(btn);
                
                buildTree(f.id, depth + 1);
            });
        };

        buildTree(null);
        lucide.createIcons();
    } catch (err) {
        console.error("Error rendering folder tree:", err);
        listContainer.innerHTML = '<p class="text-xs text-red-400 text-center py-4">Failed to load folders.</p>';
    }
}

let selectedFolderIdForMove = null;
window.selectFolderForMove = (id) => {
    selectedFolderIdForMove = id;
    // Highlight selection
    document.querySelectorAll('#folder-list-move button').forEach(btn => {
        btn.classList.remove('border-indigo-500', 'bg-indigo-500/10');
    });
    event.currentTarget.classList.add('border-indigo-500', 'bg-indigo-500/10');
};

async function confirmMove() {
    if (!contextMenuItem) return;
    
    try {
        const table = contextMenuItem.itemType === 'folder' ? 'folders' : 'resources';
        const column = contextMenuItem.itemType === 'folder' ? 'parent_id' : 'folder_id';
        
        const { error } = await supabaseClient.from(table).update({ [column]: selectedFolderIdForMove }).eq('id', contextMenuItem.id);
        if (error) throw error;
        
        showToast("Moved successfully", "folder-input");
        closeMoveModal();
        fetchResources();
    } catch (err) {
        console.error(err);
        showToast("Move failed", "alert-circle");
    }
}

// Form Submissions
async function handleResourceSubmit(e) {
    e.preventDefault();
    const title = document.getElementById('res-title').value;
    let type = document.getElementById('res-type').value;
    if (type === 'Other') type = document.getElementById('res-custom-type').value || 'Other';
    const author = document.getElementById('res-author').value;
    const tags = document.getElementById('res-tags').value.split(',').map(t => t.trim()).filter(t => t);
    const isOffline = document.getElementById('res-offline').checked;
    const url = document.getElementById('res-url').value;
    const file = resFileInput.files[0];

    const submitBtn = addResourceForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Saving...';
    lucide.createIcons();

    let finalUrl = url;
    if (activeInputMode === 'file' && file && supabaseClient) {
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const { data, error } = await supabaseClient.storage.from('resources').upload(`uploads/${fileName}`, file);
            if (error) throw error;
            const { data: { publicUrl } } = supabaseClient.storage.from('resources').getPublicUrl(`uploads/${fileName}`);
            finalUrl = publicUrl;
        } catch (err) {
            console.error(err);
            showToast("Upload failed", "alert-circle");
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
            return;
        }
    }

    try {
        const { error } = await supabaseClient.from('resources').insert([{
            title, type, author, tags, link_url: finalUrl, is_offline: isOffline, folder_id: currentFolderId
        }]);
        if (error) throw error;
        showToast("Resource added!", "check");
        closeModal();
        fetchResources();
    } catch (err) {
        console.error(err);
        showToast("Save failed", "alert-circle");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
        lucide.createIcons();
    }
}

async function handleFolderSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('folder-name').value;
    const description = document.getElementById('folder-desc').value;

    try {
        const { error } = await supabaseClient.from('folders').insert([{
            name, description, parent_id: currentFolderId
        }]);
        if (error) throw error;
        showToast("Folder created!", "folder-plus");
        closeFolderModal();
        fetchResources();
    } catch (err) {
        console.error(err);
        showToast("Failed to create folder", "alert-circle");
    }
}

// Chat Logic
function addMessage(text, isUser = false) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `flex gap-2 ${isUser ? 'flex-row-reverse' : ''} animate-fade-in`;
    msgDiv.innerHTML = `
        <div class="w-8 h-8 rounded-lg ${isUser ? 'bg-slate-800' : 'bg-indigo-900/50'} flex items-center justify-center shrink-0">
            <i data-lucide="${isUser ? 'user' : 'bot'}" class="w-4 h-4 ${isUser ? 'text-slate-400' : 'text-indigo-400'}"></i>
        </div>
        <div class="${isUser ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-[#1e293b] text-slate-300 rounded-tl-none border border-slate-800'} p-3 rounded-2xl text-sm shadow-sm max-w-[80%]">
            ${text}
        </div>
    `;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    lucide.createIcons();
}

function handleChat() {
    const text = chatInput.value.trim();
    if (!text) return;
    addMessage(text, true);
    chatInput.value = '';
    setTimeout(() => {
        addMessage("I'm here to help! I can analyze your resources or help you organize your folders.");
    }, 1000);
}

// Event Listeners
quickAddToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    quickAddMenu.classList.toggle('active');
});

document.addEventListener('click', () => {
    quickAddMenu.classList.remove('active');
    hideContextMenu();
});

resTypeSelect.addEventListener('change', (e) => {
    customTypeContainer.classList.toggle('hidden', e.target.value !== 'Other');
});

toggleUrlBtn.addEventListener('click', () => setInputMode('url'));
toggleFileBtn.addEventListener('click', () => setInputMode('file'));

function setInputMode(mode) {
    activeInputMode = mode;
    toggleUrlBtn.className = mode === 'url' ? 'flex-1 py-2 text-xs font-bold rounded-lg bg-slate-800 shadow-sm text-indigo-400 transition-all' : 'flex-1 py-2 text-xs font-bold rounded-lg text-slate-500 hover:text-slate-400 transition-all';
    toggleFileBtn.className = mode === 'file' ? 'flex-1 py-2 text-xs font-bold rounded-lg bg-slate-800 shadow-sm text-indigo-400 transition-all' : 'flex-1 py-2 text-xs font-bold rounded-lg text-slate-500 hover:text-slate-400 transition-all';
    urlInputContainer.classList.toggle('hidden', mode !== 'url');
    fileInputContainer.classList.toggle('hidden', mode !== 'file');
}

resFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        fileNameDisplay.textContent = `Selected: ${e.target.files[0].name}`;
        fileNameDisplay.classList.remove('hidden');
    }
});

addResourceForm.addEventListener('submit', handleResourceSubmit);
addFolderForm.addEventListener('submit', handleFolderSubmit);
document.getElementById('confirm-move-btn').addEventListener('click', confirmMove);

document.getElementById('ctx-delete').addEventListener('click', deleteItem);
document.getElementById('ctx-move').addEventListener('click', () => {
    hideContextMenu();
    openMoveModal(contextMenuItem);
});
document.getElementById('ctx-edit').addEventListener('click', async () => {
    if (!contextMenuItem) return;
    const { id, itemType, name, title } = contextMenuItem;
    const oldName = name || title;
    const newName = prompt(`Rename "${oldName}" to:`, oldName);
    
    if (newName && newName !== oldName) {
        try {
            const table = itemType === 'folder' ? 'folders' : 'resources';
            const column = itemType === 'folder' ? 'name' : 'title';
            const { error } = await supabaseClient.from(table).update({ [column]: newName }).eq('id', id);
            if (error) throw error;
            showToast("Renamed successfully", "edit-3");
            fetchResources();
        } catch (err) {
            console.error(err);
            showToast("Rename failed", "alert-circle");
        }
    }
    hideContextMenu();
});

document.getElementById('open-news-btn').addEventListener('click', openNewsModal);
closeChatBtn.addEventListener('click', () => {
    chatWidget.classList.add('translate-y-full', 'opacity-0', 'pointer-events-none');
    openChatBtn.classList.remove('scale-0', 'opacity-0');
});

openChatBtn.addEventListener('click', () => {
    chatWidget.classList.remove('translate-y-full', 'opacity-0', 'pointer-events-none');
    openChatBtn.classList.add('scale-0', 'opacity-0');
});

sendChatBtn.addEventListener('click', handleChat);
chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleChat(); });

// News Rendering
function renderNews() {
    const NEWS_DATA = [
        { title: "New Breakthrough in Quantum Computing", source: "Science Daily", time: "2h ago", category: "Tech" },
        { title: "Top 10 Study Techniques for 2024", source: "EduWeekly", time: "5h ago", category: "Education" },
        { title: "The Future of Remote Learning", source: "Global News", time: "8h ago", category: "Society" }
    ];
    newsFeed.innerHTML = NEWS_DATA.map((news, index) => `
        <div class="news-item p-4 bg-[#1e293b] rounded-xl border border-slate-800 shadow-sm transition-all cursor-pointer animate-fade-in" style="animation-delay: ${index * 0.1}s">
            <div class="flex justify-between items-start mb-2">
                <span class="text-[10px] font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">${news.category}</span>
                <span class="text-[10px] text-slate-500">${news.time}</span>
            </div>
            <h3 class="text-sm font-semibold text-slate-200 leading-snug mb-1">${news.title}</h3>
            <p class="text-[11px] text-slate-500">${news.source}</p>
        </div>
    `).join('');
}

// Initialize
renderNews();
fetchResources();

// Expose navigation to window for breadcrumbs
window.navigateToFolder = navigateToFolder;
window.openModal = openModal;
window.openFolderModal = openFolderModal;
window.closeFolderModal = closeFolderModal;
window.closeMoveModal = closeMoveModal;
window.closeNewsModal = closeNewsModal;
window.selectFolderForMove = selectFolderForMove;
