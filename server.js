const express = require('express');
const ytdl = require('@distube/ytdl-core');
const app = express();

app.use(express.json());
app.use(express.static('public'));

app.get('/stream', async (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).send('URL is required');

    try {
        if (!ytdl.validateURL(videoUrl)) {
            return res.status(400).send('Invalid YouTube URL');
        }

        res.setHeader('Content-Type', 'video/mp4');

        // Streams raw video bytes directly to browser response
        ytdl(videoUrl, {
            filter: 'audioandvideo',
            quality: 'highestvideo'
        }).pipe(res);

    } catch (err) {
        console.error('Stream Error:', err);
        if (!res.headersSent) {
            res.status(500).send('Failed to stream video');
        }
    }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
