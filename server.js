const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static('public'));

app.get('/stream', (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).send('URL is required');

    const command = `npx yt-dlp-exec "${videoUrl}" -o - -f "best[ext=mp4]/best"`;

    res.setHeader('Content-Type', 'video/mp4');

    const process = exec(command);

    process.stdout.pipe(res);

    process.stderr.on('data', (data) => {
        console.error(`yt-dlp error: ${data}`);
    });

    req.on('close', () => {
        process.kill();
    });
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
