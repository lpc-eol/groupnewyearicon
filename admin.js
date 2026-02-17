// ============================================
// Admin Panel JavaScript
// ============================================

const API_BASE = '';

// DOM Elements
const loginCard = document.getElementById('loginCard');
const adminPanel = document.getElementById('adminPanel');
const loginForm = document.getElementById('loginForm');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const statusBadge = document.getElementById('statusBadge');
const statusText = document.getElementById('statusText');
const totalImages = document.getElementById('totalImages');
const totalVotes = document.getElementById('totalVotes');
const totalVoters = document.getElementById('totalVoters');
const rankingList = document.getElementById('rankingList');
const voteLogs = document.getElementById('voteLogs');
const loadMoreLogs = document.getElementById('loadMoreLogs');
const cutoffBtn = document.getElementById('cutoffBtn');
const reopenBtn = document.getElementById('reopenBtn');
const lastUpdated = document.getElementById('lastUpdated');
const toast = document.getElementById('toast');
const siteNameInput = document.getElementById('siteNameInput');
const saveSiteNameBtn = document.getElementById('saveSiteNameBtn');

// State
let token = null;
let currentStatus = 'open';
let socket = null;
let logsOffset = 0;
let hasMoreLogs = false;

// ============================================
// Initialize
// ============================================
function init() {
    // Check for existing session
    token = sessionStorage.getItem('admin_token');
    if (token) {
        showAdminPanel();
        loadStats();
    }
    
    setupEventListeners();
    initSocket();
}

/**
 * Initialize Socket.IO for real-time updates
 */
function initSocket() {
    if (typeof io === 'undefined') return;
    
    socket = io();
    
    socket.on('status:update', (data) => {
        currentStatus = data.status;
        updateStatusDisplay();
        loadStats();
    });
    
    socket.on('votes:update', () => {
        loadStats();
    });
    
    socket.on('vote:log', (log) => {
        prependLogEntry(log);
    });
    
    socket.on('data:update', () => {
        loadStats();
    });
}

// ============================================
// Event Listeners
// ============================================
function setupEventListeners() {
    // Login form
    loginForm.addEventListener('submit', handleLogin);
    loginBtn.addEventListener('click', handleLogin);
    
    // Logout
    logoutBtn.addEventListener('click', handleLogout);
    
    // Cutoff/Reopen
    cutoffBtn.addEventListener('click', handleCutoff);
    reopenBtn.addEventListener('click', handleReopen);
    
    // Site name settings
    if (saveSiteNameBtn) {
        saveSiteNameBtn.addEventListener('click', handleSaveSiteName);
    }
}

// ============================================
// Authentication
// ============================================
async function handleLogin(e) {
    e.preventDefault();
    
    const password = passwordInput.value;
    if (!password) {
        loginError.textContent = '請輸入密碼';
        return;
    }
    
    loginBtn.disabled = true;
    loginBtn.textContent = '登入中...';
    loginError.textContent = '';
    
    try {
        const response = await fetch(`${API_BASE}/api/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            loginError.textContent = result.error || '登入失敗';
            loginBtn.disabled = false;
            loginBtn.textContent = '登入';
            return;
        }
        
        // Store token and show panel
        token = result.token;
        currentStatus = result.status;
        sessionStorage.setItem('admin_token', token);
        
        showAdminPanel();
        loadStats();
        
    } catch (error) {
        console.error('Login error:', error);
        loginError.textContent = '網路錯誤，請稍後再試';
        loginBtn.disabled = false;
        loginBtn.textContent = '登入';
    }
}

function handleLogout() {
    token = null;
    sessionStorage.removeItem('admin_token');
    
    // Reset login form
    passwordInput.value = '';
    loginBtn.disabled = false;
    loginBtn.textContent = '登入';
    loginError.textContent = '';
    
    // Show login card
    adminPanel.hidden = true;
    loginCard.style.display = '';
}

function showAdminPanel() {
    loginCard.style.display = 'none';
    adminPanel.hidden = false;
    loadLogs(true);
    loadSiteConfig();
}

// ============================================
// Data Loading
// ============================================
async function loadStats() {
    try {
        const response = await fetch(`${API_BASE}/api/stats`);
        if (!response.ok) throw new Error('Failed to fetch stats');
        
        const stats = await response.json();
        
        // Update stats
        totalImages.textContent = stats.totalImages;
        totalVotes.textContent = stats.totalVotes;
        totalVoters.textContent = stats.totalVoters;
        
        // Update status
        currentStatus = stats.status;
        updateStatusDisplay();
        
        // Update rankings
        renderRankings(stats.topImages);
        
        // Update timestamp
        lastUpdated.textContent = `最後更新: ${new Date().toLocaleString('zh-TW')}`;
        
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function loadSiteConfig() {
    try {
        const response = await fetch(`${API_BASE}/api/config`);
        if (response.ok) {
            const config = await response.json();
            if (siteNameInput) {
                siteNameInput.value = config.siteName || '';
            }
        }
    } catch (error) {
        console.error('Error loading config:', error);
    }
}

async function handleSaveSiteName() {
    const siteName = siteNameInput.value.trim();
    if (!siteName) {
        showToast('請輸入網站名稱', 'error');
        return;
    }
    
    saveSiteNameBtn.disabled = true;
    saveSiteNameBtn.textContent = '保存中...';
    
    try {
        const response = await fetch(`${API_BASE}/api/admin/config`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ siteName })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            if (response.status === 401) {
                showToast('登入已過期，請重新登入', 'error');
                handleLogout();
                return;
            }
            showToast(result.error || '保存失敗', 'error');
            return;
        }
        
        showToast('網站名稱已更新！', 'success');
        
    } catch (error) {
        console.error('Save config error:', error);
        showToast('保存失敗，請稍後再試', 'error');
    } finally {
        saveSiteNameBtn.disabled = false;
        saveSiteNameBtn.textContent = '保存名稱';
    }
}

function updateStatusDisplay() {
    if (currentStatus === 'closed') {
        statusBadge.className = 'status-badge closed';
        statusText.textContent = '已結束';
        cutoffBtn.hidden = true;
        reopenBtn.hidden = false;
    } else {
        statusBadge.className = 'status-badge open';
        statusText.textContent = '進行中';
        cutoffBtn.hidden = false;
        reopenBtn.hidden = true;
    }
}

function renderRankings(topImages) {
    if (!topImages || topImages.length === 0) {
        rankingList.innerHTML = '<div class="ranking-empty">暫無數據</div>';
        return;
    }
    
    const medals = ['🥇', '🥈', '🥉'];
    
    rankingList.innerHTML = topImages.slice(0, 10).map((img, index) => `
        <div class="ranking-item">
            <span class="ranking-position">${medals[index] || (index + 1)}</span>
            <div class="ranking-info">
                <div class="ranking-title">${escapeHtml(img.title)}</div>
                <div class="ranking-votes">${img.votes} 票</div>
            </div>
        </div>
    `).join('');
}

// ============================================
// Vote Logs
// ============================================
async function loadLogs(reset = false) {
    if (reset) {
        logsOffset = 0;
        hasMoreLogs = false;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/admin/logs?limit=20&offset=${logsOffset}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                showToast('登入已過期，請重新登入', 'error');
                handleLogout();
                return;
            }
            throw new Error('Failed to load logs');
        }
        
        const result = await response.json();
        
        if (reset) {
            voteLogs.innerHTML = '';
        }
        
        if (result.logs.length === 0 && reset) {
            voteLogs.innerHTML = '<div class="log-empty">暫無投票記錄</div>';
        } else {
            // Remove empty state if exists
            const emptyState = voteLogs.querySelector('.log-empty');
            if (emptyState) emptyState.remove();
            
            result.logs.forEach(log => appendLogEntry(log));
        }
        
        hasMoreLogs = result.hasMore;
        loadMoreLogs.hidden = !hasMoreLogs;
        
    } catch (error) {
        console.error('Error loading logs:', error);
    }
}

function appendLogEntry(log) {
    const entry = createLogEntry(log);
    voteLogs.appendChild(entry);
    
    // Keep only last 50 visible entries
    while (voteLogs.children.length > 50) {
        voteLogs.removeChild(voteLogs.lastChild);
    }
}

function prependLogEntry(log) {
    // Remove empty state if exists
    const emptyState = voteLogs.querySelector('.log-empty');
    if (emptyState) emptyState.remove();
    
    const entry = createLogEntry(log);
    entry.classList.add('new');
    voteLogs.insertBefore(entry, voteLogs.firstChild);
    
    // Keep only last 50 visible entries
    while (voteLogs.children.length > 50) {
        voteLogs.removeChild(voteLogs.lastChild);
    }
    
    // Auto-scroll to top if user is near top
    const container = document.getElementById('logsContainer');
    if (container && container.scrollTop < 50) {
        container.scrollTop = 0;
    }
}

function createLogEntry(log) {
    const div = document.createElement('div');
    div.className = 'log-entry';
    
    const time = new Date(log.timestamp).toLocaleTimeString('zh-TW', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    const icon = log.action === 'added' ? '🗳️' : '❌';
    const actionText = log.action === 'added' ? '投票给' : '取消投票';
    
    div.innerHTML = `
        <span class="log-time">${time}</span>
        <span class="log-icon">${icon}</span>
        <div class="log-content">
            <span class="log-user">${escapeHtml(log.userId)}</span>
            ${actionText} <span class="log-image">「${escapeHtml(log.imageTitle || '未知图片')}」</span>
            <span class="log-meta">(${log.newCount}票 · 第${log.rank}名)</span>
        </div>
    `;
    
    return div;
}

if (loadMoreLogs) {
    loadMoreLogs.addEventListener('click', () => {
        logsOffset += 20;
        loadLogs(false);
    });
}

// ============================================
// Admin Actions
// ============================================
async function handleCutoff() {
    if (!confirm('確定要結束投票嗎？結束後所有用戶將無法繼續投票。')) {
        return;
    }
    
    cutoffBtn.disabled = true;
    cutoffBtn.innerHTML = '<span class="btn-icon">⏳</span> 處理中...';
    
    try {
        const response = await fetch(`${API_BASE}/api/admin/cutoff`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            if (response.status === 401) {
                showToast('登入已過期，請重新登入', 'error');
                handleLogout();
                return;
            }
            showToast(result.error || '操作失敗', 'error');
            return;
        }
        
        currentStatus = 'closed';
        updateStatusDisplay();
        showToast('投票已結束！', 'success');
        
    } catch (error) {
        console.error('Cutoff error:', error);
        showToast('操作失敗，請稍後再試', 'error');
    } finally {
        cutoffBtn.disabled = false;
        cutoffBtn.innerHTML = '<span class="btn-icon">🛑</span> 結束投票';
    }
}

async function handleReopen() {
    if (!confirm('確定要重新開啟投票嗎？')) {
        return;
    }
    
    reopenBtn.disabled = true;
    reopenBtn.innerHTML = '<span class="btn-icon">⏳</span> 處理中...';
    
    try {
        const response = await fetch(`${API_BASE}/api/admin/reopen`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            if (response.status === 401) {
                showToast('登入已過期，請重新登入', 'error');
                handleLogout();
                return;
            }
            showToast(result.error || '操作失敗', 'error');
            return;
        }
        
        currentStatus = 'open';
        updateStatusDisplay();
        showToast('投票已重新開啟！', 'success');
        
    } catch (error) {
        console.error('Reopen error:', error);
        showToast('操作失敗，請稍後再試', 'error');
    } finally {
        reopenBtn.disabled = false;
        reopenBtn.innerHTML = '<span class="btn-icon">▶️</span> 重新開啟投票';
    }
}

// ============================================
// Utility Functions
// ============================================
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    if (toast.timeoutId) {
        clearTimeout(toast.timeoutId);
    }
    
    toast.timeoutId = setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ============================================
// Initialize on DOM ready
// ============================================
document.addEventListener('DOMContentLoaded', init);
