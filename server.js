const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Primary public API instances for raw stream fetching
const ENDPOINTS = [
    'https://pipedapi.kavin.rocks/streams/',
    'https://api.piped.privacydev.net/streams/',
    'https://inv.tux.pizza/api/v1/videos/'
];

app.get('/fetch-stream', async (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).send('URL required');

    const match = videoUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=))([^"&?\/\s]{11})/);
    if (!match) return res.status(400).send('Invalid URL');

    const videoId = match[1];

    for (const base of ENDPOINTS) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 4000);

            const apiRes = await fetch(`${base}${videoId}`, { signal: controller.signal });
            clearTimeout(timeout);

            if (!apiRes.ok) continue;

            const data = await apiRes.json();
            let rawUrl = null;

            if (data.videoStreams) {
                // Find compatible combined MP4 stream
                const stream = data.videoStreams.find(s => s.mimeType?.includes('mp4') && s.quality === '720p') || data.videoStreams[0];
                rawUrl = stream?.url;
            } else if (data.formatStreams) {
                const stream = data.formatStreams.find(f => f.container === 'mp4') || data.formatStreams[0];
                rawUrl = stream?.url;
            }

            if (rawUrl) {
                // Fetch the actual media binary and relay it
                const mediaRes = await fetch(rawUrl);
                if (!mediaRes.ok) continue;

                res.setHeader('Content-Type', 'video/mp4');
                res.setHeader('Access-Control-Allow-Origin', '*');

                const reader = mediaRes.body.getReader();
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    res.write(value);
                }
                return res.end();
            }
        } catch (e) {
            console.log(`Endpoint failed: ${base}`);
        }
    }

    return res.status(502).send('Unable to bypass media restrictions.');
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
