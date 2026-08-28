const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/favicon.ico', (req, res) => res.status(204).end());

// Redundant public API instances
const API_NODES = [
    { type: 'cobalt', url: 'https://api.cobalt.tools' },
    { type: 'cobalt', url: 'https://cobalt-api.kwiats.com' },
    { type: 'piped', url: 'https://pipedapi.kavin.rocks' },
    { type: 'piped', url: 'https://api.piped.privacydev.net' }
];

app.get('/get-hls-manifest', async (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).json({ error: 'URL required' });

    const match = videoUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=))([^"&?\/\s]{11})/);
    if (!match) return res.status(400).json({ error: 'Invalid YouTube URL' });

    const videoId = match[1];

    for (const node of API_NODES) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 4000);

            let mediaUrl = null;

            if (node.type === 'cobalt') {
                const apiRes = await fetch(`${node.url}/`, {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        url: videoUrl,
                        vQuality: '720',
                        isAudioOnly: false
                    }),
                    signal: controller.signal
                });
                clearTimeout(timeout);

                if (apiRes.ok) {
                    const data = await apiRes.json();
                    if (data.url) mediaUrl = data.url;
                    else if (data.picker && data.picker.length > 0) mediaUrl = data.picker[0].url;
                }
            } else if (node.type === 'piped') {
                const apiRes = await fetch(`${node.url}/streams/${videoId}`, { signal: controller.signal });
                clearTimeout(timeout);

                if (apiRes.ok) {
                    const data = await apiRes.json();
                    if (data.hls) {
                        mediaUrl = data.hls;
                    } else if (data.videoStreams && data.videoStreams.length > 0) {
                        const stream = data.videoStreams.find(s => s.mimeType?.includes('mp4')) || data.videoStreams[0];
                        mediaUrl = stream?.url;
                    }
                }
            }

            if (mediaUrl) {
                return res.json({ status: 'success', url: mediaUrl });
            }
        } catch (e) {
            console.log(`Failed node: ${node.url}`);
        }
    }

    // Always return HTTP 200 with an error state to prevent 502 crashes
    return res.json({ status: 'error', message: 'All backend resolution nodes failed.' });
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
