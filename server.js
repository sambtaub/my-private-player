const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Mirror endpoints to fetch clean media sources
const MIRRORS = [
    'https://inv.tux.pizza',
    'https://invidious.nerdvpn.de',
    'https://vid.puffyan.us'
];

app.get('/proxy-stream', async (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).send('URL required');

    const match = videoUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=))([^"&?\/\s]{11})/);
    if (!match) return res.status(400).send('Invalid YouTube URL');

    const videoId = match[1];

    for (const mirror of MIRRORS) {
        try {
            const apiRes = await fetch(`${mirror}/api/v1/videos/${videoId}`);
            if (!apiRes.ok) continue;

            const data = await apiRes.json();
            const format = data.formatStreams?.find(f => f.container === 'mp4') || data.formatStreams?.[0];

            if (format && format.url) {
                // Fetch raw media stream
                const mediaResponse = await fetch(format.url);
                if (!mediaResponse.ok) continue;

                // Set headers to trick the browser into treating this as local Railway media
                res.setHeader('Content-Type', 'video/mp4');
                res.setHeader('Access-Control-Allow-Origin', '*');

                // Pipe data chunks directly
                const reader = mediaResponse.body.getReader();
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    res.write(value);
                }
                return res.end();
            }
        } catch (e) {
            console.log(`Mirror failed: ${mirror}`);
        }
    }

    return res.status(500).send('Unable to bypass player restrictions.');
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
