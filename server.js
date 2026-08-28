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
        // Extract stream info directly using JavaScript
        const info = await ytdl.getInfo(videoUrl, {
            requestOptions: {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            }
        });

        // 1. Check for HLS manifest URL (bypasses MP4 blocks)
        let streamUrl = info.formats.find(f => f.isHLS)?.url;

        // 2. Fallback to direct video/audio combined format
        if (!streamUrl) {
            const format = ytdl.chooseFormat(info.formats, { quality: 'highestvideo', filter: 'audioandvideo' });
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
            message: 'Extraction failed. YouTube may be throttling this video ID.' 
        });
    }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
