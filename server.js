const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Resilient Piped API mirrors that extract direct media streams
const PIPED_NODES = [
    'https://pipedapi.kavin.rocks',
    'https://api.piped.privacydev.net',
    'https://pipedapi.mha.fi',
    'https://piped-api.garudalinux.org'
];

app.get('/proxy-video', async (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).send('URL required');

    const match = videoUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=))([^"&?\/\s]{11})/);
    if (!match) return res.status(400).send('Invalid YouTube URL');

    const videoId = match[1];
    let mediaUrl = null;

    // Resolve direct stream URL from Piped nodes
    for (const node of PIPED_NODES) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3500);

            const apiRes = await fetch(`${node}/streams/${videoId}`, { signal: controller.signal });
            clearTimeout(timeout);

            if (!apiRes.ok) continue;

            const data = await apiRes.json();
            
            // Prefer combined MP4 format
            const stream = data.videoStreams?.find(s => s.mimeType?.includes('mp4') && s.quality === '720p') 
                        || data.videoStreams?.find(s => s.mimeType?.includes('mp4'))
                        || data.videoStreams?.[0];

            if (stream && stream.url) {
                mediaUrl = stream.url;
                break;
            }
        } catch (e) {
            console.log(`Node failed: ${node}`);
        }
    }

    if (!mediaUrl) {
        return res.status(502).send('Unable to resolve video stream from active nodes.');
    }

    try {
        // Stream the media directly from source to client to prevent Railway 502 memory crashes
        const videoStream = await fetch(mediaUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });

        if (!videoStream.ok) {
            return res.status(502).send('Upstream video source returned error.');
        }

        // Set local Railway domain headers so browser permits playback
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Access-Control-Allow-Origin', '*');
        if (videoStream.headers.get('content-length')) {
            res.setHeader('Content-Length', videoStream.headers.get('content-length'));
        }

        // Pipe stream chunks smoothly without memory accumulation
        const reader = videoStream.body.getReader();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
        }
        res.end();

    } catch (err) {
        console.error('Piping error:', err);
        if (!res.headersSent) {
            res.status(502).send('Stream relay failed.');
        }
    }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
