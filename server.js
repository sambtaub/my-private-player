const express = require('express');
const path = require('path');
const ytdl = require('@distube/ytdl-core');
const { generate } = require('youtube-po-token-generator');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/favicon.ico', (req, res) => res.status(204).end());

// Cached PO Token & Visitor Data
let poTokenData = null;

async function refreshTokenData() {
    try {
        console.log('Generating server-side PO Token...');
        poTokenData = await generate();
        console.log('Successfully generated PO Token & Visitor Data.');
    } catch (err) {
        console.error('Failed to generate PO Token:', err.message);
    }
}

// Generate initial token on boot and refresh every 3 hours
refreshTokenData();
setInterval(refreshTokenData, 3 * 60 * 60 * 1000);

app.get('/get-stream', async (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl || !ytdl.validateURL(videoUrl)) {
        return res.json({ status: 'error', message: 'Invalid YouTube URL' });
    }

    try {
        // Build ytdl options with server-side attestation tokens
        const options = {
            playerClients: ['WEB_EMBEDDED', 'IOS', 'ANDROID']
        };

        if (poTokenData && poTokenData.poToken && poTokenData.visitorData) {
            options.poToken = poTokenData.poToken;
            options.visitorData = poTokenData.visitorData;
        }

        const info = await ytdl.getInfo(videoUrl, options);

        // 1. Prefer HLS (.m3u8) streams to bypass browser MP4 filters
        let streamUrl = info.formats.find(f => f.isHLS)?.url;

        // 2. Fallback to direct video/audio combined streams
        if (!streamUrl) {
            const format = ytdl.chooseFormat(info.formats, { 
                quality: 'highestvideo', 
                filter: 'audioandvideo' 
            });
            streamUrl = format?.url;
        }

        if (streamUrl) {
            return res.json({ status: 'success', url: streamUrl });
        } else {
            return res.json({ status: 'error', message: 'No playable stream format resolved.' });
        }
    } catch (err) {
        console.error('ytdl extraction error:', err.message);
        
        // Attempt immediate token refresh on failure
        refreshTokenData();

        return res.json({ 
            status: 'error', 
            message: 'Stream extraction failed. Re-authenticating token, try again in 5 seconds.' 
        });
    }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
