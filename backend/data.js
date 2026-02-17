/**
 * Data Access Layer - Atomic JSON file operations
 */

const fs = require('fs').promises;
const path = require('path');

const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data.json');

// Default data structure
const DEFAULT_DATA = {
    siteName: 'QQ群新年頭像投票',  // 网站标题
    images: [
        {
            id: 'default_1',
            url: 'https://images.unsplash.com/photo-1549451371-64aa98a6f660?w=400&h=400&fit=crop',
            title: '新年煙花'
        },
        {
            id: 'default_2',
            url: 'https://images.unsplash.com/photo-1514415679929-1fd5193f14ce?w=400&h=400&fit=crop',
            title: '紅色燈籠'
        },
        {
            id: 'default_3',
            url: 'https://images.unsplash.com/photo-1548783917-d0fb0be3c4e8?w=400&h=400&fit=crop',
            title: '金色賀年'
        }
    ],
    votes: {
        'default_1': 0,
        'default_2': 0,
        'default_3': 0
    },
    userVotes: {},  // { visitorId: [imageId1, imageId2, ...] }
    status: 'open', // 'open' or 'closed'
    adminPasswordHash: ''
};

/**
 * Load data from JSON file
 * Creates default data if file doesn't exist
 */
async function loadData() {
    try {
        const content = await fs.readFile(DATA_FILE, 'utf-8');
        const data = JSON.parse(content);
        // Merge with defaults to handle missing fields
        return {
            ...DEFAULT_DATA,
            ...data,
            votes: { ...DEFAULT_DATA.votes, ...data.votes },
            userVotes: { ...DEFAULT_DATA.userVotes, ...data.userVotes }
        };
    } catch (error) {
        if (error.code === 'ENOENT') {
            // File doesn't exist, create with defaults
            await saveData(DEFAULT_DATA);
            return { ...DEFAULT_DATA };
        }
        throw error;
    }
}

/**
 * Save data to JSON file (atomic write)
 * Uses temp file + rename to prevent corruption
 */
async function saveData(data) {
    const tempFile = DATA_FILE + '.tmp';
    const content = JSON.stringify(data, null, 2);
    
    await fs.writeFile(tempFile, content, 'utf-8');
    await fs.rename(tempFile, DATA_FILE);
}

/**
 * Generate unique ID
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

module.exports = {
    loadData,
    saveData,
    generateId,
    DEFAULT_DATA
};
