const express = require('express');
const path = require('path');
const ytdl = require('@distube/ytdl-core');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/favicon.ico', (req, res) => res.status(204).end());

app.get('/get-stream', async (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl || !ytdl.validateURL(videoUrl)) {
        return res.json({ status: 'error', message: 'Invalid YouTube URL' });
    }

    try {
        // Fetch metadata using mobile/TV clients to bypass datacenter IP bot detection
        const info = await ytdl.getInfo(videoUrl, {
            playerClients: ['ANDROID', 'IOS', 'TV', 'WEB_EMBEDDED']
        });

        // 1. Prefer HLS (.m3u8) format (bypasses browser MP4 filters)
        let streamUrl = info.formats.find(f => f.isHLS)?.url;

        // 2. Fallback to combined audio/video streams
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
        return res.json({ 
            status: 'error', 
            message: 'YouTube anti-bot challenge active on server IP. Retry in a few moments.' 
        });
    }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
