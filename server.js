const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Active Cobalt API endpoints for video stream resolution
const COBALT_INSTANCES = [
    'https://api.cobalt.tools',
    'https://cobalt-api.kwiats.com',
    'https://cobalt.canine.tools'
];

app.get('/fetch-stream', async (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).json({ error: 'URL required' });

    for (const instance of COBALT_INSTANCES) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 4000);

            const response = await fetch(`${instance}/`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    url: videoUrl,
                    vQuality: '720'
                }),
                signal: controller.signal
            });

            clearTimeout(timeout);

            if (!response.ok) continue;

            const data = await response.json();

            // Handle direct video stream URL
            if (data.status === 'stream' || data.status === 'redirect') {
                return res.json({ status: 'success', streamUrl: data.url });
            } else if (data.status === 'picker' && data.picker && data.picker.length > 0) {
                return res.json({ status: 'success', streamUrl: data.picker[0].url });
            }
        } catch (e) {
            console.log(`Cobalt node failed: ${instance}`);
        }
    }

    // Fallback response if all API nodes fail
    const match = videoUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=))([^"&?\/\s]{11})/);
    if (match) {
        return res.json({ 
            status: 'fallback', 
            embedUrl: `https://www.youtube-nocookie.com/embed/${match[1]}?autoplay=1` 
        });
    }

    return res.status(502).json({ error: 'Unable to bypass restrictions' });
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
