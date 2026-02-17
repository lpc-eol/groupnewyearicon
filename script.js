// ============================================
// QQ Group New Year Avatar Voting - Real-Time Version
// Uses Socket.IO + REST API instead of localStorage
// ============================================

// Constants
const MAX_VOTES = 3;
const API_BASE = ''; // Same origin

// Domains that need proxy due to anti-hotlinking
const PROXY_DOMAINS = ['pximg.net', 'pixiv.net', 'i.pximg.net'];

// Animation timing
const ANIMATION = {
    CARD_STAGGER: 60,
    TOAST_DURATION: 3000,
    VOTE_FEEDBACK: 200
};

// State
let images = [];
let votes = {};
let userVotes = [];
let votingStatus = 'open';
let socket = null;
let visitorId = null;

// DOM Elements
const gallery = document.getElementById('gallery');
const votedCountEl = document.getElementById('votedCount');
const imageUrlInput = document.getElementById('imageUrl');
const imageTitleInput = document.getElementById('imageTitle');
const addImageBtn = document.getElementById('addImageBtn');
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const toast = document.getElementById('toast');
const modal = document.getElementById('imageModal');
const modalImage = document.getElementById('modalImage');
const modalClose = document.getElementById('modalClose');
const votingClosedBanner = document.getElementById('votingClosedBanner');

// Mobile Elements
const fab = document.getElementById('fabAdd');
const bottomSheet = document.getElementById('addImageSheet');
const sheetBackdrop = document.getElementById('sheetBackdrop');
const sheetClose = document.getElementById('sheetClose');
const sheetImageUrl = document.getElementById('sheetImageUrl');
const sheetImageTitle = document.getElementById('sheetImageTitle');
const sheetAddBtn = document.getElementById('sheetAddBtn');
const sheetUploadArea = document.getElementById('sheetUploadArea');
const sheetFileInput = document.getElementById('sheetFileInput');

// ============================================
// Initialize
// ============================================
function init() {
    initVisitorId();
    initSocket();
    loadInitialData();
    setupEventListeners();
}

/**
 * Generate or retrieve persistent visitor ID
 */
function initVisitorId() {
    visitorId = localStorage.getItem('qq_voting_visitor_id');
    if (!visitorId) {
        visitorId = 'v_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
        localStorage.setItem('qq_voting_visitor_id', visitorId);
    }
}

/**
 * Initialize Socket.IO connection
 */
function initSocket() {
    // Check if Socket.IO is available
    if (typeof io === 'undefined') {
        console.warn('Socket.IO not available, falling back to polling');
        setInterval(loadInitialData, 5000);
        return;
    }
    
    socket = io();
    
    socket.on('connect', () => {
        console.log('Connected to server');
        updateConnectionStatus('connected');
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        updateConnectionStatus('disconnected');
    });
    
    socket.on('connect_error', () => {
        updateConnectionStatus('disconnected');
    });
    
    // Initial data sync
    socket.on('data:sync', (data) => {
        images = data.images || [];
        votes = data.votes || {};
        votingStatus = data.status || 'open';
        renderGallery();
        updateVotingStatus();
    });
    
    // Real-time vote updates
    socket.on('votes:update', (data) => {
        votes[data.imageId] = data.newCount;
        updateVoteDisplay(data.imageId, data.newCount);
    });
    
    // Full data update (image added/deleted)
    socket.on('data:update', (data) => {
        images = data.images || images;
        votes = data.votes || votes;
        renderGallery();
    });
    
    // Voting status change
    socket.on('status:update', (data) => {
        votingStatus = data.status;
        updateVotingStatus();
        if (data.status === 'closed') {
            showToast('投票已結束！', 'success');
        } else {
            showToast('投票已重新開啟！', 'success');
        }
    });
}

/**
 * Update connection status indicator
 */
function updateConnectionStatus(status) {
    let indicator = document.querySelector('.connection-status');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'connection-status';
        indicator.innerHTML = '<span class="connection-dot"></span><span class="connection-text"></span>';
        document.body.appendChild(indicator);
    }
    
    indicator.className = `connection-status ${status}`;
    const textEl = indicator.querySelector('.connection-text');
    
    switch (status) {
        case 'connected':
            textEl.textContent = '已連線';
            break;
        case 'disconnected':
            textEl.textContent = '已斷線';
            break;
        case 'connecting':
            textEl.textContent = '連線中...';
            break;
    }
}

// ============================================
// API Functions
// ============================================

let siteName = '投票系統';

/**
 * Load initial data from server
 */
async function loadInitialData() {
    try {
        // Fetch main data
        const dataRes = await fetch(`${API_BASE}/api/data`);
        if (!dataRes.ok) throw new Error('Failed to fetch data');
        const data = await dataRes.json();
        
        images = data.images || [];
        votes = data.votes || {};
        votingStatus = data.status || 'open';
        siteName = data.siteName || '投票系統';
        
        // Update site title
        updateSiteTitle(siteName);
        
        // Fetch user's votes
        const userRes = await fetch(`${API_BASE}/api/user/${visitorId}`);
        if (userRes.ok) {
            const userData = await userRes.json();
            userVotes = userData.userVotes || [];
        }
        
        renderGallery();
        updateVoteStatus();
        updateVotingStatus();
        
    } catch (error) {
        console.error('Error loading data:', error);
        showToast('載入數據失敗，請重新整理頁面', 'error');
    }
}

/**
 * Update site title and heading
 */
function updateSiteTitle(name) {
    siteName = name;
    document.title = name;
    const titleEl = document.getElementById('siteTitle');
    if (titleEl) titleEl.textContent = name;
    // Update meta description
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.content = `${name} - 選出你最喜歡的頭像`;
}

/**
 * Toggle vote for an image via API
 */
async function toggleVote(imageId) {
    if (votingStatus === 'closed') {
        showToast('投票已結束', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/vote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageId, visitorId })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            showToast(result.error || '投票失敗', 'error');
            // Shake animation for feedback
            const card = document.querySelector(`.image-card[data-id="${imageId}"]`);
            if (card) {
                card.style.animation = 'none';
                card.offsetHeight;
                card.style.animation = 'shake 0.4s ease';
            }
            return;
        }
        
        // Update local state
        userVotes = result.userVotes;
        votes[imageId] = result.newCount;
        
        // Update UI
        updateVoteStatus(true);
        renderGallery();
        
        showToast(result.action === 'added' ? '投票成功！' : '已取消投票', 'success');
        
    } catch (error) {
        console.error('Vote error:', error);
        showToast('投票失敗，請稍後再試', 'error');
    }
}

/**
 * Add image via API
 */
async function addImage(url, title) {
    url = url?.trim();
    title = title?.trim();
    
    if (!url) {
        showToast('請輸入圖片網址', 'error');
        imageUrlInput.focus();
        return;
    }
    
    // Basic URL validation
    try {
        new URL(url);
    } catch {
        showToast('請輸入有效的網址', 'error');
        imageUrlInput.focus();
        return;
    }
    
    if (votingStatus === 'closed') {
        showToast('投票已結束，無法添加圖片', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/images`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, title })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            showToast(result.error || '添加失敗', 'error');
            return;
        }
        
        // Clear inputs
        imageUrlInput.value = '';
        imageTitleInput.value = '';
        imageUrlInput.focus();
        
        showToast('圖片添加成功！', 'success');
        
        // Scroll to new image (will be added via socket event)
        setTimeout(() => {
            const newCard = document.querySelector(`.image-card[data-id="${result.image.id}"]`);
            if (newCard) {
                newCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 300);
        
    } catch (error) {
        console.error('Add image error:', error);
        showToast('添加失敗，請稍後再試', 'error');
    }
}

/**
 * Delete image via API
 */
async function deleteImage(imageId) {
    const image = images.find(img => img.id === imageId);
    const title = image?.title || '此圖片';
    
    if (!confirm(`確定要刪除「${title}」嗎？`)) {
        return;
    }
    
    if (votingStatus === 'closed') {
        showToast('投票已結束，無法刪除圖片', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/images/${imageId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            showToast(result.error || '刪除失敗', 'error');
            return;
        }
        
        // Remove from local userVotes if voted
        userVotes = userVotes.filter(id => id !== imageId);
        updateVoteStatus(true);
        
        showToast('圖片已刪除', 'success');
        
    } catch (error) {
        console.error('Delete error:', error);
        showToast('刪除失敗，請稍後再試', 'error');
    }
}

/**
 * Handle file upload
 */
async function handleFileUpload(file) {
    if (!file.type.startsWith('image/')) {
        showToast('請上傳圖片檔案', 'error');
        return;
    }
    
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
        showToast('圖片大小不能超過 5MB', 'error');
        return;
    }
    
    if (votingStatus === 'closed') {
        showToast('投票已結束，無法添加圖片', 'error');
        return;
    }
    
    uploadArea.classList.add('dragover');
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        const title = file.name.replace(/\.[^/.]+$/, '').substring(0, 50) || '上傳的頭像';
        
        try {
            const response = await fetch(`${API_BASE}/api/images`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: e.target.result, title })
            });
            
            const result = await response.json();
            
            uploadArea.classList.remove('dragover');
            
            if (!response.ok) {
                showToast(result.error || '上傳失敗', 'error');
                return;
            }
            
            showToast('圖片上傳成功！', 'success');
            
        } catch (error) {
            uploadArea.classList.remove('dragover');
            console.error('Upload error:', error);
            showToast('上傳失敗，請稍後再試', 'error');
        }
    };
    
    reader.onerror = function() {
        uploadArea.classList.remove('dragover');
        showToast('圖片讀取失敗', 'error');
    };
    
    reader.readAsDataURL(file);
}

// ============================================
// Render Functions
// ============================================

function renderGallery() {
    if (images.length === 0) {
        gallery.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🖼️</div>
                <p>還沒有候選頭像，請添加圖片開始投票！</p>
            </div>
        `;
        return;
    }
    
    // Check if user has voted (to show/hide results)
    const hasVoted = userVotes.length > 0;
    
    // Sort by vote count (highest first) if user has voted, otherwise random
    let sortedImages;
    if (hasVoted) {
        sortedImages = [...images].sort((a, b) => {
            return (votes[b.id] || 0) - (votes[a.id] || 0);
        });
    } else {
        // Random order for non-voters
        sortedImages = [...images].sort(() => Math.random() - 0.5);
    }
    
    gallery.innerHTML = sortedImages.map((img, index) => 
        createImageCard(img, index, hasVoted)
    ).join('');
    
    // Show/hide results notice
    updateResultsVisibility(hasVoted);
}

function updateResultsVisibility(hasVoted) {
    // Remove existing notice
    const existingNotice = document.querySelector('.results-notice');
    if (existingNotice) existingNotice.remove();
    
    if (!hasVoted) {
        const notice = document.createElement('div');
        notice.className = 'results-notice';
        notice.innerHTML = `
            <div class="notice-content">
                <span class="notice-icon">🔒</span>
                <p>投完票后即可查看实时排行榜和票数！</p>
            </div>
        `;
        gallery.insertAdjacentElement('beforebegin', notice);
    }
}

function createImageCard(img, index = 0, showResults = true) {
    const isVoted = userVotes.includes(img.id);
    const voteCount = votes[img.id] || 0;
    const maxVotes = Math.max(...Object.values(votes), 1);
    const progressWidth = maxVotes > 0 ? (voteCount / maxVotes) * 100 : 0;
    const canVote = (userVotes.length < MAX_VOTES || isVoted) && votingStatus === 'open';
    const animationDelay = index * ANIMATION.CARD_STAGGER;
    const hasVoted = userVotes.length > 0;
    
    const fallbackSvg = encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
            <rect fill="#f7f6f3" width="100" height="100"/>
            <text x="50" y="45" text-anchor="middle" fill="#9b9a97" font-size="10" font-family="system-ui">圖片</text>
            <text x="50" y="60" text-anchor="middle" fill="#9b9a97" font-size="10" font-family="system-ui">載入失敗</text>
        </svg>
    `);
    
    return `
        <article class="image-card ${isVoted ? 'voted' : ''}" 
                 data-id="${img.id}" 
                 role="listitem"
                 style="animation-delay: ${animationDelay}ms">
            <button class="btn-delete" 
                    onclick="deleteImage('${img.id}')" 
                    title="刪除此圖片"
                    aria-label="刪除 ${sanitizeInput(img.title) || '此圖片'}"
                    ${votingStatus === 'closed' ? 'disabled' : ''}>
                🗑️
            </button>
            <div class="image-wrapper" 
                 onclick="openModal('${escapeJsString(getProxiedUrl(img.url))}')"
                 role="button"
                 tabindex="0"
                 aria-label="點擊放大查看 ${sanitizeInput(img.title) || '圖片'}">
                <img src="${getProxiedUrl(img.url)}" 
                     alt="${sanitizeInput(img.title) || '候選頭像'}" 
                     loading="lazy"
                     onerror="this.src='data:image/svg+xml,${fallbackSvg}'">
            </div>
            <div class="card-content">
                <h3 class="card-title">${sanitizeInput(img.title) || '未命名頭像'}</h3>
                <div class="card-footer">
                    ${showResults ? `
                    <div class="vote-count" aria-label="${voteCount} 票">
                        <span aria-hidden="true">🗳️</span>
                        <span class="vote-count-number">${voteCount}</span>
                        <span>票</span>
                    </div>
                    ` : `
                    <div class="vote-count-hidden">🔒 投票后可见</div>
                    `}
                    <button class="btn btn-vote ${isVoted ? 'voted' : ''}" 
                            onclick="toggleVote('${img.id}')"
                            ${!canVote ? 'disabled' : ''}
                            aria-pressed="${isVoted}"
                            aria-label="${isVoted ? '取消投票' : '投票給'} ${sanitizeInput(img.title) || '此頭像'}">
                        ${isVoted ? '已投票' : '投票'}
                    </button>
                </div>
                ${showResults ? `
                <div class="vote-progress" role="progressbar" 
                     aria-valuenow="${voteCount}" 
                     aria-valuemin="0" 
                     aria-valuemax="${maxVotes}">
                    <div class="vote-progress-bar" style="width: ${progressWidth}%"></div>
                </div>
                ` : ''}
            </div>
        </article>
    `;
}

/**
 * Update vote display for a single image (without full re-render)
 */
function updateVoteDisplay(imageId, newCount) {
    const card = document.querySelector(`.image-card[data-id="${imageId}"]`);
    if (!card) return;
    
    const countEl = card.querySelector('.vote-count-number');
    if (countEl) {
        countEl.textContent = newCount;
        countEl.style.transform = 'scale(1.2)';
        setTimeout(() => {
            countEl.style.transform = 'scale(1)';
        }, ANIMATION.VOTE_FEEDBACK);
    }
    
    // Update progress bar
    const maxVotes = Math.max(...Object.values(votes), 1);
    const progressBar = card.querySelector('.vote-progress-bar');
    if (progressBar) {
        progressBar.style.width = `${(newCount / maxVotes) * 100}%`;
    }
}

function updateVoteStatus(animate = false) {
    const countEl = votedCountEl;
    
    if (animate) {
        countEl.style.transform = 'scale(1.2)';
        setTimeout(() => {
            countEl.textContent = userVotes.length;
            countEl.style.transform = 'scale(1)';
        }, ANIMATION.VOTE_FEEDBACK);
    } else {
        countEl.textContent = userVotes.length;
    }
}

/**
 * Update UI based on voting status
 */
function updateVotingStatus() {
    if (votingStatus === 'closed') {
        votingClosedBanner.hidden = false;
        document.body.classList.add('voting-closed');
    } else {
        votingClosedBanner.hidden = true;
        document.body.classList.remove('voting-closed');
    }
}

// ============================================
// Utility Functions
// ============================================

function sanitizeInput(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Escape string for use in JavaScript inside HTML attribute
 * Handles quotes and backslashes that could break the onclick handler
 */
function escapeJsString(str) {
    if (!str) return '';
    return str
        .replace(/\\/g, '\\\\')  // Escape backslashes first
        .replace(/'/g, "\\'")      // Escape single quotes
        .replace(/"/g, '&quot;');  // Escape double quotes for HTML
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Check if URL needs proxy (anti-hotlinking sites like Pixiv)
 */
function needsProxy(url) {
    if (!url) return false;
    try {
        const hostname = new URL(url).hostname;
        return PROXY_DOMAINS.some(domain => hostname.includes(domain));
    } catch {
        return false;
    }
}

/**
 * Get proxied URL for anti-hotlinking sites
 */
function getProxiedUrl(url) {
    if (!url || url.startsWith('data:')) return url;
    if (needsProxy(url)) {
        return `${API_BASE}/api/proxy?url=${encodeURIComponent(url)}`;
    }
    return url;
}

// ============================================
// Modal Functions
// ============================================

function openModal(imageUrl) {
    modalImage.src = imageUrl;
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
    modalClose.focus();
}

function closeModal() {
    modal.classList.remove('show');
    document.body.style.overflow = '';
}

// ============================================
// Toast Notification
// ============================================

function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    if (toast.timeoutId) {
        clearTimeout(toast.timeoutId);
    }
    
    toast.timeoutId = setTimeout(() => {
        toast.classList.remove('show');
    }, ANIMATION.TOAST_DURATION);
}

// ============================================
// Bottom Sheet (Mobile)
// ============================================

let sheetTouchStartY = 0;
let sheetCurrentY = 0;
let isSheetDragging = false;

function openBottomSheet() {
    if (votingStatus === 'closed') {
        showToast('投票已結束，無法添加圖片', 'error');
        return;
    }
    
    bottomSheet.hidden = false;
    document.body.style.overflow = 'hidden';
    
    // Trigger animation
    requestAnimationFrame(() => {
        bottomSheet.classList.add('open');
        sheetImageUrl?.focus();
    });
}

function closeBottomSheet() {
    bottomSheet.classList.remove('open');
    document.body.style.overflow = '';
    
    // Wait for animation to complete
    setTimeout(() => {
        bottomSheet.hidden = true;
        // Clear inputs
        if (sheetImageUrl) sheetImageUrl.value = '';
        if (sheetImageTitle) sheetImageTitle.value = '';
    }, 300);
}

function handleSheetAddImage() {
    const url = sheetImageUrl?.value;
    const title = sheetImageTitle?.value;
    
    if (!url?.trim()) {
        showToast('請輸入圖片網址', 'error');
        sheetImageUrl?.focus();
        return;
    }
    
    addImage(url, title);
    closeBottomSheet();
}

function handleSheetFileUpload(file) {
    handleFileUpload(file);
    closeBottomSheet();
}

// Touch gestures for bottom sheet swipe-to-close
function initSheetTouchHandlers() {
    if (!bottomSheet) return;
    
    const sheetContent = bottomSheet.querySelector('.bottom-sheet-content');
    if (!sheetContent) return;
    
    sheetContent.addEventListener('touchstart', (e) => {
        // Only allow drag from handle area (top 40px)
        const rect = sheetContent.getBoundingClientRect();
        const touchY = e.touches[0].clientY - rect.top;
        
        if (touchY < 40) {
            sheetTouchStartY = e.touches[0].clientY;
            isSheetDragging = true;
            sheetContent.style.transition = 'none';
        }
    }, { passive: true });
    
    sheetContent.addEventListener('touchmove', (e) => {
        if (!isSheetDragging) return;
        
        sheetCurrentY = e.touches[0].clientY - sheetTouchStartY;
        
        // Only allow downward drag
        if (sheetCurrentY > 0) {
            sheetContent.style.transform = `translateY(${sheetCurrentY}px)`;
        }
    }, { passive: true });
    
    sheetContent.addEventListener('touchend', () => {
        if (!isSheetDragging) return;
        
        isSheetDragging = false;
        sheetContent.style.transition = '';
        sheetContent.style.transform = '';
        
        // Close if dragged more than 100px
        if (sheetCurrentY > 100) {
            closeBottomSheet();
        }
        
        sheetCurrentY = 0;
    });
}

// ============================================
// Event Listeners
// ============================================

function setupEventListeners() {
    // Add image button
    addImageBtn.addEventListener('click', () => {
        addImage(imageUrlInput.value, imageTitleInput.value);
    });
    
    // Enter key on inputs
    const handleEnterKey = debounce((e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addImage(imageUrlInput.value, imageTitleInput.value);
        }
    }, 100);
    
    imageUrlInput.addEventListener('keypress', handleEnterKey);
    imageTitleInput.addEventListener('keypress', handleEnterKey);
    
    // File upload click
    uploadArea.addEventListener('click', () => {
        if (votingStatus === 'open') {
            fileInput.click();
        }
    });
    
    // Keyboard support for upload area
    uploadArea.addEventListener('keypress', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && votingStatus === 'open') {
            e.preventDefault();
            fileInput.click();
        }
    });
    
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileUpload(e.target.files[0]);
            fileInput.value = '';
        }
    });
    
    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (votingStatus === 'open') {
            uploadArea.classList.add('dragover');
        }
    });
    
    uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        
        if (e.dataTransfer.files.length > 0 && votingStatus === 'open') {
            handleFileUpload(e.dataTransfer.files[0]);
        }
    });
    
    // Modal close button
    modalClose.addEventListener('click', closeModal);
    
    // Click outside modal to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    // Escape key to close modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('show')) {
            closeModal();
        }
    });
    
    // Image wrapper keyboard support
    document.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && e.target.classList.contains('image-wrapper')) {
            const img = e.target.querySelector('img');
            if (img) {
                openModal(img.src);
            }
        }
    });
    
    // Mobile FAB and Bottom Sheet
    if (fab) {
        fab.addEventListener('click', openBottomSheet);
    }
    
    if (sheetBackdrop) {
        sheetBackdrop.addEventListener('click', closeBottomSheet);
    }
    
    if (sheetClose) {
        sheetClose.addEventListener('click', closeBottomSheet);
    }
    
    if (sheetAddBtn) {
        sheetAddBtn.addEventListener('click', handleSheetAddImage);
    }
    
    // Sheet input enter key
    if (sheetImageUrl) {
        sheetImageUrl.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSheetAddImage();
            }
        });
    }
    
    if (sheetImageTitle) {
        sheetImageTitle.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSheetAddImage();
            }
        });
    }
    
    // Sheet file upload
    if (sheetUploadArea) {
        sheetUploadArea.addEventListener('click', () => {
            if (votingStatus === 'open' && sheetFileInput) {
                sheetFileInput.click();
            }
        });
    }
    
    if (sheetFileInput) {
        sheetFileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleSheetFileUpload(e.target.files[0]);
                sheetFileInput.value = '';
            }
        });
    }
    
    // Initialize touch handlers for bottom sheet
    initSheetTouchHandlers();
    
    // Escape key also closes bottom sheet
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && bottomSheet && !bottomSheet.hidden) {
            closeBottomSheet();
        }
    });
}

// ============================================
// CSS Animation for shake effect
// ============================================
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        20% { transform: translateX(-6px); }
        40% { transform: translateX(6px); }
        60% { transform: translateX(-4px); }
        80% { transform: translateX(4px); }
    }
`;
document.head.appendChild(shakeStyle);

// ============================================
// Make functions available globally
// ============================================
window.toggleVote = toggleVote;
window.deleteImage = deleteImage;
window.openModal = openModal;

// ============================================
// Initialize on DOM ready
// ============================================
document.addEventListener('DOMContentLoaded', init);
