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
        return res.json({ status: 'error', message: 'Invalid or missing YouTube URL.' });
    }

    try {
        // Query mobile and TV InnerTube clients to bypass desktop web bot enforcement
        const info = await ytdl.getInfo(videoUrl, {
            playerClients: ['IOS', 'ANDROID', 'TV', 'WEB_EMBEDDED']
        });

        // 1. Prefer HLS (.m3u8) manifests (bypasses direct MP4 playback restrictions)
        let streamUrl = info.formats.find(f => f.isHLS)?.url;

        // 2. Fallback to combined video & audio streams
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
            return res.json({ status: 'error', message: 'No playable stream format could be extracted.' });
        }
    } catch (err) {
        console.error('ytdl-core extraction error:', err.message);

        // Fail safely with JSON rather than crashing the Express process
        return res.json({
            status: 'error',
            message: 'Server IP block detected by YouTube. Try another video link.'
        });
    }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
