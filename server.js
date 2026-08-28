const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Endpoint to resolve embed URL clean of tracking & direct API dependencies
app.get('/get-embed', (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).json({ error: 'URL is required' });

    // Extract 11-character Video ID
    const match = videoUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=))([^"&?\/\s]{11})/);
    if (!match) return res.status(400).json({ error: 'Invalid YouTube URL' });

    const videoId = match[1];

    // Return working privacy & proxy mirrors
    return res.json({
        nocookie: `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&modestbranding=1`,
        invidious: `https://yewtu.be/embed/${videoId}?autoplay=1`,
        piped: `https://piped.video/embed/${videoId}?autoplay=1`
    });
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
