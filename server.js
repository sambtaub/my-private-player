const express = require('express');
const path = require('path');
const youtubedl = require('yt-dlp-exec');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/favicon.ico', (req, res) => res.status(204).end());

app.get('/get-stream', async (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).json({ error: 'URL required' });

    try {
        // Run local yt-dlp binary to extract raw stream manifest & formats directly
        const output = await youtubedl(videoUrl, {
            dumpSingleJson: true,
            noCheckCertificates: true,
            noWarnings: true,
            preferFreeFormats: true,
            youtubeSkipDashManifest: false
        });

        // 1. Prefer HLS (.m3u8) format to bypass MP4 browser blocks
        let hlsUrl = output.manifest_url;
        
        // 2. Fallback to direct video stream if HLS manifest isn't explicit
        if (!hlsUrl && output.formats) {
            const format = output.formats.find(f => f.manifest_url || (f.ext === 'mp4' && f.acodec !== 'none' && f.vcodec !== 'none')) 
                        || output.formats[0];
            hlsUrl = format.manifest_url || format.url;
        }

        if (hlsUrl) {
            return res.json({ status: 'success', url: hlsUrl });
        } else {
            return res.json({ status: 'error', message: 'No playable stream format found.' });
        }
    } catch (err) {
        console.error('yt-dlp extraction error:', err.message);
        
        // Fail-safe response to prevent 502 server crashes
        return res.json({ 
            status: 'error', 
            message: 'Failed to extract video stream. YouTube may be throttling this video ID.' 
        });
    }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
