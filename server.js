const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Ignore favicon 404 logs
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Expanded tier of active API instances
const API_NODES = [
    { type: 'piped', url: 'https://pipedapi.kavin.rocks' },
    { type: 'piped', url: 'https://pipedapi.adminforge.de' },
    { type: 'piped', url: 'https://api.piped.privacydev.net' },
    { type: 'invidious', url: 'https://inv.tux.pizza' },
    { type: 'invidious', url: 'https://invidious.nerdvpn.de' }
];

app.get('/proxy-video', async (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).json({ status: 'error', message: 'URL required' });

    // Extract 11-char Video ID
    const match = videoUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=))([^"&?\/\s]{11})/);
    if (!match) return res.status(400).json({ status: 'error', message: 'Invalid YouTube URL' });

    const videoId = match[1];

    // Attempt 1: Fetch direct stream URL from active nodes
    for (const node of API_NODES) {
        try {
            const endpoint = node.type === 'piped' 
                ? `${node.url}/streams/${videoId}` 
                : `${node.url}/api/v1/videos/${videoId}`;

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 2500);

            const apiRes = await fetch(endpoint, { signal: controller.signal });
            clearTimeout(timeout);

            if (!apiRes.ok) continue;

            const data = await apiRes.json();
            let streamUrl = null;

            if (node.type === 'piped' && data.videoStreams) {
                const stream = data.videoStreams.find(s => s.mimeType?.includes('mp4') && s.quality === '720p') 
                            || data.videoStreams.find(s => s.mimeType?.includes('mp4'))
                            || data.videoStreams[0];
                streamUrl = stream?.url;
            } else if (node.type === 'invidious' && data.formatStreams) {
                const stream = data.formatStreams.find(f => f.container === 'mp4') || data.formatStreams[0];
                streamUrl = stream?.url;
            }

            if (streamUrl) {
                return res.json({ status: 'direct', streamUrl: streamUrl });
            }
        } catch (e) {
            console.log(`Node failed: ${node.url}`);
        }
    }

    // Attempt 2: Fall back to non-blocking Embed configuration (prevents 502 crash)
    return res.json({
        status: 'embed',
        embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&modestbranding=1&rel=0`
    });
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
