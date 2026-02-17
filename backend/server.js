/**
 * Real-Time Voting Backend Server
 * Express + Socket.IO + JWT Authentication
 */

require('dotenv').config();

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const { loadData, saveData, generateId } = require('./data');

// Image proxy - handle anti-hotlinking sites like Pixiv
const https = require('https');
const http = require('http');

// Configuration
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const MAX_VOTES_PER_USER = 3;
const NANOBOT_WEBHOOK_URL = process.env.NANOBOT_WEBHOOK_URL || null;
const NANOBOT_ENABLED = process.env.NANOBOT_ENABLED === 'true';

// In-memory vote logs (for real-time admin view)
const voteLogs = [];
const MAX_LOGS = 1000;

// Initialize Express app
const app = express();
const httpServer = createServer(app);

// Initialize Socket.IO
const io = new Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static files from parent directory
const publicPath = path.resolve(__dirname, '..');
app.use(express.static(publicPath));

// Serve index.html for root path
app.get('/', (req, res) => {
    res.sendFile(path.resolve(__dirname, '..', 'index.html'));
});

// In-memory data cache
let data = null;

// Initialize data and admin password
async function initialize() {
    data = await loadData();
    
    // Set admin password hash if not set
    if (!data.adminPasswordHash) {
        data.adminPasswordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
        await saveData(data);
        console.log('Admin password initialized');
    }
    
    console.log(`Loaded ${data.images.length} images, ${Object.keys(data.userVotes).length} voters`);
}

// ============================================
// REST API Endpoints
// ============================================

/**
 * GET /api/data - Get all voting data for frontend
 */
app.get('/api/data', (req, res) => {
    res.json({
        siteName: data.siteName,
        images: data.images,
        votes: data.votes,
        status: data.status
    });
});

/**
 * GET /api/config - Get site configuration
 */
app.get('/api/config', (req, res) => {
    res.json({
        siteName: data.siteName || 'QQ群新年頭像投票'
    });
});

/**
 * POST /api/admin/config - Update site configuration (admin only)
 */
app.post('/api/admin/config', async (req, res) => {
    try {
        // Verify JWT token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        const token = authHeader.split(' ')[1];
        try {
            jwt.verify(token, JWT_SECRET);
        } catch {
            return res.status(401).json({ error: 'Invalid token' });
        }
        
        const { siteName } = req.body;
        
        if (siteName && typeof siteName === 'string') {
            data.siteName = siteName.trim().substring(0, 50); // 限制长度
            await saveData(data);
            
            // Broadcast config update
            io.emit('config:update', { siteName: data.siteName });
            
            res.json({
                success: true,
                siteName: data.siteName
            });
        } else {
            res.status(400).json({ error: 'Invalid siteName' });
        }
        
    } catch (error) {
        console.error('Config update error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/stats - Get voting statistics (for nanobot)
 */
app.get('/api/stats', (req, res) => {
    // Sort images by votes
    const sortedImages = [...data.images]
        .map(img => ({
            id: img.id,
            title: img.title,
            votes: data.votes[img.id] || 0
        }))
        .sort((a, b) => b.votes - a.votes);
    
    const totalVotes = Object.values(data.votes).reduce((sum, v) => sum + v, 0);
    
    res.json({
        totalVotes,
        totalImages: data.images.length,
        totalVoters: Object.keys(data.userVotes).length,
        topImages: sortedImages.slice(0, 10),
        status: data.status,
        timestamp: new Date().toISOString()
    });
});

/**
 * GET /api/user/:userId - Get user's votes
 */
app.get('/api/user/:visitorId', (req, res) => {
    const { visitorId } = req.params;
    const userVotes = data.userVotes[visitorId] || [];
    res.json({ userVotes });
});

/**
 * POST /api/vote - Toggle vote for an image
 */
app.post('/api/vote', async (req, res) => {
    try {
        const { imageId, visitorId } = req.body;
        
        if (!imageId || !visitorId) {
            return res.status(400).json({ error: 'Missing imageId or visitorId' });
        }
        
        // Check if voting is open
        if (data.status === 'closed') {
            return res.status(403).json({ error: '投票已結束' });
        }
        
        // Check if image exists
        const image = data.images.find(img => img.id === imageId);
        if (!image) {
            return res.status(404).json({ error: 'Image not found' });
        }
        
        // Initialize user votes if needed
        if (!data.userVotes[visitorId]) {
            data.userVotes[visitorId] = [];
        }
        
        const userVotes = data.userVotes[visitorId];
        const hasVoted = userVotes.includes(imageId);
        
        let action;
        if (hasVoted) {
            // Remove vote
            data.userVotes[visitorId] = userVotes.filter(id => id !== imageId);
            data.votes[imageId] = Math.max(0, (data.votes[imageId] || 0) - 1);
            action = 'removed';
        } else {
            // Check vote limit
            if (userVotes.length >= MAX_VOTES_PER_USER) {
                return res.status(400).json({ 
                    error: `最多只能投 ${MAX_VOTES_PER_USER} 票`,
                    maxVotes: MAX_VOTES_PER_USER
                });
            }
            // Add vote
            data.userVotes[visitorId].push(imageId);
            data.votes[imageId] = (data.votes[imageId] || 0) + 1;
            action = 'added';
        }
        
        // Save and broadcast
        await saveData(data);
        
        // Calculate ranking
        const sortedVotes = Object.entries(data.votes).sort((a, b) => b[1] - a[1]);
        const rank = sortedVotes.findIndex(([id]) => id === imageId) + 1;
        
        // Log vote event
        const logEntry = {
            timestamp: new Date().toISOString(),
            userId: visitorId,
            imageId,
            imageTitle: image.title,
            action,
            newCount: data.votes[imageId],
            rank,
            userTotalVotes: data.userVotes[visitorId].length
        };
        voteLogs.unshift(logEntry);
        if (voteLogs.length > MAX_LOGS) voteLogs.pop();
        
        // Broadcast vote update to all clients
        io.emit('votes:update', {
            imageId,
            newCount: data.votes[imageId],
            totalVoters: Object.keys(data.userVotes).length
        });
        
        // Broadcast to admin logs
        io.emit('vote:log', logEntry);
        
        // Send webhook to nanobot (if enabled)
        if (NANOBOT_ENABLED && action === 'added') {
            sendNanobotNotification(logEntry).catch(err => {
                console.error('Nanobot notification failed:', err.message);
            });
        }
        
        res.json({
            success: true,
            action,
            newCount: data.votes[imageId],
            userVotes: data.userVotes[visitorId]
        });
        
    } catch (error) {
        console.error('Vote error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/images - Add new image
 */
app.post('/api/images', async (req, res) => {
    try {
        const { url, title } = req.body;
        
        if (!url) {
            return res.status(400).json({ error: 'Missing url' });
        }
        
        // Check if voting is open
        if (data.status === 'closed') {
            return res.status(403).json({ error: '投票已結束，無法添加圖片' });
        }
        
        // Check for duplicate URL
        if (data.images.some(img => img.url === url)) {
            return res.status(400).json({ error: '此圖片已存在' });
        }
        
        const newImage = {
            id: generateId(),
            url: url.trim(),
            title: (title || '新頭像').trim().substring(0, 50)
        };
        
        data.images.push(newImage);
        data.votes[newImage.id] = 0;
        
        await saveData(data);
        
        // Broadcast new image to all clients
        io.emit('data:update', {
            type: 'image:added',
            image: newImage,
            images: data.images,
            votes: data.votes
        });
        
        res.json({
            success: true,
            image: newImage
        });
        
    } catch (error) {
        console.error('Add image error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/images/:id - Delete image
 */
app.delete('/api/images/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if voting is open
        if (data.status === 'closed') {
            return res.status(403).json({ error: '投票已結束，無法刪除圖片' });
        }
        
        const imageIndex = data.images.findIndex(img => img.id === id);
        if (imageIndex === -1) {
            return res.status(404).json({ error: 'Image not found' });
        }
        
        // Remove image
        data.images.splice(imageIndex, 1);
        
        // Remove votes for this image
        delete data.votes[id];
        
        // Remove from user votes
        for (const visitorId in data.userVotes) {
            data.userVotes[visitorId] = data.userVotes[visitorId].filter(imgId => imgId !== id);
        }
        
        await saveData(data);
        
        // Broadcast deletion to all clients
        io.emit('data:update', {
            type: 'image:deleted',
            imageId: id,
            images: data.images,
            votes: data.votes
        });
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('Delete image error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/admin/login - Admin login
 */
app.post('/api/admin/login', async (req, res) => {
    try {
        const { password } = req.body;
        
        if (!password) {
            return res.status(400).json({ error: 'Missing password' });
        }
        
        const isValid = await bcrypt.compare(password, data.adminPasswordHash);
        if (!isValid) {
            return res.status(401).json({ error: '密碼錯誤' });
        }
        
        const token = jwt.sign({ admin: true }, JWT_SECRET, { expiresIn: '24h' });
        
        res.json({
            success: true,
            token,
            status: data.status
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/admin/cutoff - End voting
 */
app.post('/api/admin/cutoff', async (req, res) => {
    try {
        // Verify JWT token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        const token = authHeader.split(' ')[1];
        try {
            jwt.verify(token, JWT_SECRET);
        } catch {
            return res.status(401).json({ error: 'Invalid token' });
        }
        
        // Update status
        data.status = 'closed';
        await saveData(data);
        
        // Broadcast status change to all clients
        io.emit('status:update', { status: 'closed' });
        
        res.json({
            success: true,
            status: 'closed'
        });
        
    } catch (error) {
        console.error('Cutoff error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/admin/reopen - Reopen voting (optional)
 */
app.post('/api/admin/reopen', async (req, res) => {
    try {
        // Verify JWT token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        const token = authHeader.split(' ')[1];
        try {
            jwt.verify(token, JWT_SECRET);
        } catch {
            return res.status(401).json({ error: 'Invalid token' });
        }
        
        // Update status
        data.status = 'open';
        await saveData(data);
        
        // Broadcast status change to all clients
        io.emit('status:update', { status: 'open' });
        
        res.json({
            success: true,
            status: 'open'
        });
        
    } catch (error) {
        console.error('Reopen error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/admin/logs - Get vote logs (admin only)
 */
app.get('/api/admin/logs', async (req, res) => {
    try {
        // Verify JWT token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        const token = authHeader.split(' ')[1];
        try {
            jwt.verify(token, JWT_SECRET);
        } catch {
            return res.status(401).json({ error: 'Invalid token' });
        }
        
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        
        // Get image title mapping
        const imageMap = {};
        data.images.forEach(img => {
            imageMap[img.id] = img.title;
        });
        
        // Enrich logs with image titles
        const enrichedLogs = voteLogs.slice(offset, offset + limit).map(log => ({
            ...log,
            imageTitle: imageMap[log.imageId] || log.imageTitle || '已删除图片'
        }));
        
        res.json({
            logs: enrichedLogs,
            total: voteLogs.length,
            hasMore: offset + limit < voteLogs.length
        });
        
    } catch (error) {
        console.error('Get logs error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/admin/webhook/test - Test nanobot webhook
 */
app.post('/api/admin/webhook/test', async (req, res) => {
    try {
        // Verify JWT token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        const token = authHeader.split(' ')[1];
        try {
            jwt.verify(token, JWT_SECRET);
        } catch {
            return res.status(401).json({ error: 'Invalid token' });
        }
        
        if (!NANOBOT_WEBHOOK_URL) {
            return res.status(400).json({ error: 'Webhook URL not configured' });
        }
        
        const testPayload = {
            type: 'test',
            timestamp: new Date().toISOString(),
            message: 'Webhook test from voting server'
        };
        
        const result = await sendNanobotNotification(testPayload, true);
        res.json({ success: true, webhookResponse: result });
        
    } catch (error) {
        console.error('Webhook test error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Helper: Send notification to nanobot
 */
async function sendNanobotNotification(logEntry, isTest = false) {
    if (!NANOBOT_WEBHOOK_URL) {
        throw new Error('NANOBOT_WEBHOOK_URL not configured');
    }
    
    return new Promise((resolve, reject) => {
        const url = new URL(NANOBOT_WEBHOOK_URL);
        const postData = JSON.stringify({
            type: isTest ? 'test' : 'vote',
            data: logEntry,
            timestamp: new Date().toISOString()
        });
        
        const options = {
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname + url.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        
        const protocol = url.protocol === 'https:' ? https : http;
        const request = protocol.request(options, (response) => {
            let data = '';
            response.on('data', chunk => data += chunk);
            response.on('end', () => {
                if (response.statusCode >= 200 && response.statusCode < 300) {
                    resolve({ status: response.statusCode, body: data });
                } else {
                    reject(new Error(`HTTP ${response.statusCode}: ${data}`));
                }
            });
        });
        
        request.on('error', reject);
        request.write(postData);
        request.end();
    });
}

/**
 * GET / - Serve index.html for root path
 */
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

/**
 * GET /api/proxy - Image proxy to bypass anti-hotlinking
 * Handles sites like Pixiv (pximg.net) that check Referer
 */
app.get('/api/proxy', (req, res) => {
    const { url } = req.query;
    
    if (!url) {
        return res.status(400).json({ error: 'Missing url parameter' });
    }
    
    try {
        const parsedUrl = new URL(url);
        const protocol = parsedUrl.protocol === 'https:' ? https : http;
        
        // Determine correct Referer based on domain
        let referer = parsedUrl.origin;
        if (parsedUrl.hostname.includes('pximg.net')) {
            referer = 'https://www.pixiv.net/';
        }
        
        const options = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': referer,
                'Accept': 'image/*,*/*'
            }
        };
        
        const proxyReq = protocol.request(options, (proxyRes) => {
            // Handle redirects - proxy them instead of letting browser redirect
            if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
                // Convert redirect location to proxy URL to maintain referer
                const redirectUrl = new URL(proxyRes.headers.location, url).toString();
                return res.redirect(`/api/proxy?url=${encodeURIComponent(redirectUrl)}`);
            }
            
            // Handle errors (like 403, 404)
            if (proxyRes.statusCode >= 400) {
                console.error(`Proxy error: ${proxyRes.statusCode} for ${url}`);
                return res.status(proxyRes.statusCode).json({ 
                    error: `Failed to fetch image: ${proxyRes.statusCode}` 
                });
            }
            
            // Set cache headers
            res.set({
                'Content-Type': proxyRes.headers['content-type'] || 'image/jpeg',
                'Cache-Control': 'public, max-age=86400',
                'Access-Control-Allow-Origin': '*'
            });
            
            if (proxyRes.headers['content-length']) {
                res.set('Content-Length', proxyRes.headers['content-length']);
            }
            
            proxyRes.pipe(res);
        });
        
        proxyReq.on('error', (error) => {
            console.error('Proxy error:', error.message);
            res.status(500).json({ error: 'Failed to fetch image' });
        });
        
        proxyReq.setTimeout(10000, () => {
            proxyReq.destroy();
            res.status(504).json({ error: 'Proxy timeout' });
        });
        
        proxyReq.end();
        
    } catch (error) {
        console.error('Proxy URL error:', error.message);
        res.status(400).json({ error: 'Invalid URL' });
    }
});

/**
 * Health check endpoint for Render
 */
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// Socket.IO Event Handlers
// ============================================

io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);
    
    // Send current data to newly connected client
    socket.emit('data:sync', {
        images: data.images,
        votes: data.votes,
        status: data.status
    });
    
    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
    });
});

// ============================================
// Start Server
// ============================================

initialize().then(() => {
    httpServer.listen(PORT, () => {
        console.log(`\n🎊 QQ群新年頭像投票後端服務已啟動`);
        console.log(`📡 HTTP: http://localhost:${PORT}`);
        console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
        console.log(`🔐 Admin: http://localhost:${PORT}/admin.html`);
        console.log(`📊 API Stats: http://localhost:${PORT}/api/stats\n`);
    });
}).catch(error => {
    console.error('Failed to initialize:', error);
    process.exit(1);
});
