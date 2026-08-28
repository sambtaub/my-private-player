const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Primary public API mirrors
const INVIDIOUS_INSTANCES = [
    'https://inv.tux.pizza',
    'https://invidious.nerdvpn.de',
    'https://vid.puffyan.us',
    'https://invidious.drgns.space'
];

app.get('/get-stream-url', async (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).json({ error: 'URL is required' });

    // Extract 11-character YouTube Video ID
    const match = videoUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=))([^"&?\/\s]{11})/);
    if (!match) return res.status(400).json({ error: 'Invalid YouTube URL' });

    const videoId = match[1];

    // Try instances sequentially until a working link is retrieved
    for (const instance of INVIDIOUS_INSTANCES) {
        try {
            const apiRes = await fetch(`${instance}/api/v1/videos/${videoId}`, {
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            if (!apiRes.ok) continue;

            const data = await apiRes.json();
            
            // Find standard MP4 format containing combined video + audio
            const format = data.formatStreams?.find(f => f.container === 'mp4' || f.encoding === 'h264') || data.formatStreams?.[0];
            
            if (format && format.url) {
                return res.json({ streamUrl: format.url });
            }
        } catch (e) {
            console.log(`Failed fetching from ${instance}, trying next...`);
        }
    }

    return res.status(500).json({ error: 'Could not extract stream URL. Try another video link.' });
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
