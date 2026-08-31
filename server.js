const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/favicon.ico', (req, res) => res.status(204).end());

// Redundant list of open API mirrors
const INSTANCES = [
    { type: 'piped', url: 'https://pipedapi.kavin.rocks' },
    { type: 'piped', url: 'https://api.piped.privacydev.net' },
    { type: 'invidious', url: 'https://invidious.nerdvpn.de' },
    { type: 'invidious', url: 'https://inv.riverside.rocks' }
];

app.get('/get-stream', async (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.json({ status: 'error', message: 'URL required.' });

    const match = videoUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=))([^"&?\/\s]{11})/);
    if (!match) return res.json({ status: 'error', message: 'Invalid YouTube URL.' });

    const videoId = match[1];

    for (const node of INSTANCES) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3500);

            let mediaUrl = null;

            if (node.type === 'piped') {
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
            } else if (node.type === 'invidious') {
                const apiRes = await fetch(`${node.url}/api/v1/videos/${videoId}`, { signal: controller.signal });
                clearTimeout(timeout);
                if (apiRes.ok) {
                    const data = await apiRes.json();
                    if (data.formatStreams && data.formatStreams.length > 0) {
                        mediaUrl = data.formatStreams[data.formatStreams.length - 1].url;
                    }
                }
            }

            if (mediaUrl) {
                return res.json({ status: 'success', url: mediaUrl });
            }
        } catch (e) {
            console.log(`Node failed: ${node.url}`);
        }
    }

    return res.json({ 
        status: 'error', 
        message: 'All API proxy nodes failed. Try again in a few moments.' 
    });
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
