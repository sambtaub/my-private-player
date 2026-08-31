import os
import requests
from flask import Flask, request, Response, render_template_string, jsonify
import yt_dlp

app = Flask(__name__)

HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Private Stream Proxy</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f0f0f; color: #fff; text-align: center; margin: 0; padding: 40px 20px; }
    h2 { margin-bottom: 24px; font-weight: 600; }
    .controls { display: flex; justify-content: center; gap: 8px; margin-bottom: 20px; }
    input { width: 100%; max-width: 500px; padding: 12px 16px; border-radius: 8px; border: 1px solid #333; background: #1a1a1a; color: #fff; font-size: 15px; outline: none; }
    button { padding: 12px 24px; background: #2563eb; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 15px; font-weight: 600; }
    button:hover { background: #1d4ed8; }
    #status { min-height: 24px; margin: 12px 0 20px; color: #a1a1aa; font-size: 14px; }
    #player-wrapper { width: 100%; max-width: 850px; aspect-ratio: 16/9; margin: 0 auto; background: #000; border-radius: 12px; overflow: hidden; box-shadow: 0 12px 40px rgba(0,0,0,0.7); }
    video { width: 100%; height: 100%; display: block; background: #000; }
  </style>
</head>
<body>

  <h2>Private Stream Proxy</h2>

  <div class="controls">
    <input type="text" id="url" placeholder="Paste YouTube link (https://...)" onkeydown="if(event.key==='Enter') playVideo()">
    <button onclick="playVideo()">Play Stream</button>
  </div>

  <div id="status">Ready</div>

  <div id="player-wrapper">
    <video id="player" controls autoplay></video>
  </div>

  <script>
    function playVideo() {
      const urlInput = document.getElementById('url').value.trim();
      const status = document.getElementById('status');
      const video = document.getElementById('player');

      if (!urlInput || !urlInput.startsWith('http')) {
        status.innerText = 'Please paste a full YouTube URL starting with https://';
        return;
      }

      status.innerText = 'Extracting media on server...';
      video.src = `/stream?url=${encodeURIComponent(urlInput)}`;
      
      video.onloadeddata = () => {
        status.innerText = 'Streaming active (Zero client YT connection).';
      };
      
      video.onerror = () => {
        status.innerText = 'Error loading video stream from proxy.';
      };
    }
  </script>

</body>
</html>
"""

@app.route('/')
def index():
    return render_template_string(HTML_TEMPLATE)

@app.route('/favicon.ico')
def favicon():
    return '', 204

@app.route('/stream')
def stream():
    video_url = request.args.get('url')
    if not video_url or not video_url.startswith('http'):
        return jsonify({"error": "Valid http/https URL required"}), 400

    ydl_opts = {
        'format': 'best[ext=mp4]/best',
        'quiet': True,
        'no_warnings': True,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=False)
            target_url = info.get('url')
            
            if not target_url and 'formats' in info:
                for f in info['formats']:
                    if f.get('vcodec') != 'none' and f.get('acodec') != 'none':
                        target_url = f.get('url')
                        break

    except Exception as e:
        print(f"yt-dlp extraction error: {e}")
        return jsonify({"error": "Failed to resolve video stream link"}), 500

    if not target_url:
        return jsonify({"error": "No playable stream URL found"}), 404

    headers = {}
    range_header = request.headers.get('Range')
    if range_header:
        headers['Range'] = range_header

    upstream_response = requests.get(target_url, headers=headers, stream=True)

    def generate():
        for chunk in upstream_response.iter_content(chunk_size=64 * 1024):
            if chunk:
                yield chunk

    response_headers = {}
    for header_name in ['Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges']:
        if header_name in upstream_response.headers:
            response_headers[header_name] = upstream_response.headers[header_name]

    return Response(
        generate(),
        status=upstream_response.status_code,
        headers=response_headers,
        content_type=upstream_response.headers.get('Content-Type', 'video/mp4')
    )

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8000))
    app.run(host='0.0.0.0', port=port)
