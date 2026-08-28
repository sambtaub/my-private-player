const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/favicon.ico', (req, res) => res.status(204).end());

// Redundant Cobalt & Piped instance list
const API_NODES = [
    'https://api.cobalt.tools',
    'https://pipedapi.kavin.rocks',
    'https://api.piped.privacydev.net'
];

app.get('/stream-pipe', async (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).send('URL required');

    const match = videoUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=))([^"&?\/\s]{11})/);
    if (!match) return res.status(400).send('Invalid YouTube URL');

    const videoId = match[1];
    let directStreamUrl = null;

    // Phase 1: Try resolving raw media stream URL via Cobalt API
    try {
        const cobaltRes = await fetch('https://api.cobalt.tools/', {
            method: 'POST',
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: videoUrl, vQuality: '720' })
        });
        if (cobaltRes.ok) {
            const data = await cobaltRes.json();
            if (data.url) directStreamUrl = data.url;
        }
    } catch (e) {}

    // Phase 2: Fallback to Piped API if Cobalt fails
    if (!directStreamUrl) {
        for (const node of API_NODES.slice(1)) {
            try {
                const pipedRes = await fetch(`${node}/streams/${videoId}`);
                if (!pipedRes.ok) continue;
                const data = await pipedRes.json();
                const stream = data.videoStreams?.find(s => s.mimeType?.includes('mp4')) || data.videoStreams?.[0];
                if (stream?.url) {
                    directStreamUrl = stream.url;
                    break;
                }
            } catch (e) {}
        }
    }

    if (!directStreamUrl) {
        return res.status(502).send('Failed to locate stream source.');
    }

    // Phase 3: Proxy media binary directly through Railway (Same-Origin Pipe)
    try {
        const mediaRes = await fetch(directStreamUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });

        if (!mediaRes.ok) return res.status(502).send('Upstream video fetch failed');

        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Access-Control-Allow-Origin', '*');

        // Stream byte chunks directly to browser without buffering entire file in memory
        const reader = mediaRes.body.getReader();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
        }
        res.end();
    } catch (err) {
        if (!res.headersSent) res.status(500).send('Streaming error');
    }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
