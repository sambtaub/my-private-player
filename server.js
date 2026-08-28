const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Primary Piped & Invidious instances
const API_NODES = [
    'https://pipedapi.kavin.rocks',
    'https://api.piped.privacydev.net',
    'https://inv.tux.pizza',
    'https://invidious.nerdvpn.de'
];

app.get('/resolve-video', async (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).json({ error: 'URL required' });

    // Extract 11-character Video ID
    const match = videoUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=))([^"&?\/\s]{11})/);
    if (!match) return res.status(400).json({ error: 'Invalid YouTube URL' });

    const videoId = match[1];

    // Attempt direct video stream resolution
    for (const node of API_NODES) {
        try {
            const endpoint = node.includes('piped') 
                ? `${node}/streams/${videoId}` 
                : `${node}/api/v1/videos/${videoId}`;

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000); // 3s timeout per node

            const response = await fetch(endpoint, { signal: controller.signal });
            clearTimeout(timeout);

            if (!response.ok) continue;

            const data = await response.json();
            
            // Extract combined stream format
            let streamUrl = null;
            if (node.includes('piped') && data.videoStreams) {
                const stream = data.videoStreams.find(s => s.mimeType?.includes('mp4') && s.quality === '720p') || data.videoStreams[0];
                streamUrl = stream?.url;
            } else if (data.formatStreams) {
                const stream = data.formatStreams.find(f => f.container === 'mp4') || data.formatStreams[0];
                streamUrl = stream?.url;
            }

            if (streamUrl) {
                return res.json({ mode: 'direct', url: streamUrl });
            }
        } catch (e) {
            console.log(`Node failed: ${node}`);
        }
    }

    // Fallback mode: Embed player (prevents 500 server crash)
    return res.json({ 
        mode: 'embed', 
        url: `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&modestbranding=1&rel=0` 
    });
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
