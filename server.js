const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/favicon.ico', (req, res) => res.status(204).end());

// Primary working HLS extraction relay nodes
const INVIDIOUS_NODES = [
    'https://inv.tux.pizza',
    'https://invidious.nerdvpn.de',
    'https://invidious.drgns.space',
    'https://vid.puffyan.us'
];

app.get('/get-hls-manifest', async (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).json({ error: 'URL required' });

    const match = videoUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=))([^"&?\/\s]{11})/);
    if (!match) return res.status(400).json({ error: 'Invalid YouTube URL' });

    const videoId = match[1];

    for (const node of INVIDIOUS_NODES) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);

            const apiRes = await fetch(`${node}/api/v1/videos/${videoId}`, { signal: controller.signal });
            clearTimeout(timeout);

            if (!apiRes.ok) continue;

            const data = await apiRes.json();
            
            // Extract HLS manifest URL or fallback direct stream URL
            if (data.hlsUrl) {
                return res.json({ status: 'hls', url: data.hlsUrl });
            } else if (data.formatStreams && data.formatStreams.length > 0) {
                // If HLS isn't present, return the direct stream payload
                const stream = data.formatStreams.find(f => f.container === 'mp4') || data.formatStreams[0];
                return res.json({ status: 'direct', url: stream.url });
            }
        } catch (e) {
            console.log(`Failed node: ${node}`);
        }
    }

    // Fail-safe response to prevent 502 server crash
    return res.status(200).json({ status: 'error', message: 'Nodes unreachable' });
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
