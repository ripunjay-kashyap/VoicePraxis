"""Throwaway upload-speed probe (IMPLEMENTATION §4 Phase 0, decision F10).

Two identical endpoints: default routing (us-east) and Asia routing via Mumbai.
routing_region can only be set on a function's first deploy, so this is tested
in its own app before the real `api` function is deployed.

    modal deploy upload_probe.py --env main
    curl -F file=@clip.mov <url>      # or open the HTML page on the phone
    modal app stop vp-upload-probe --env main   # when decided
"""

import time

import modal

app = modal.App("vp-upload-probe", image=modal.Image.debian_slim().pip_install("fastapi[standard]", "python-multipart"))

PAGE = """<!doctype html><meta name=viewport content="width=device-width,initial-scale=1">
<body style="font:16px system-ui;padding:16px;background:#111;color:#eee">
<h3>Upload probe: {label}</h3><input type=file accept="video/*" id=f><pre id=o></pre>
<script>
f.onchange = () => {{
  const x = new XMLHttpRequest(), d = new FormData(), t0 = performance.now();
  d.append('file', f.files[0]);
  x.upload.onprogress = e => o.textContent = 'uploading ' + Math.round(100*e.loaded/e.total) + '%';
  x.onload = () => {{
    const s = (performance.now()-t0)/1000, r = JSON.parse(x.responseText);
    o.textContent = `{label}\\n${{(r.bytes/1e6).toFixed(1)}} MB in ${{s.toFixed(1)}} s = ${{(r.bytes*8/1e6/s).toFixed(1)}} Mbit/s\\nserver receive ${{r.receive_s}} s`;
  }};
  x.open('POST', location.href); x.send(d);
}};
</script>"""


def make_app(label: str):
    from fastapi import FastAPI, UploadFile
    from fastapi.responses import HTMLResponse

    web = FastAPI()

    @web.get("/")
    def page():
        return HTMLResponse(PAGE.format(label=label))

    @web.post("/")
    async def upload(file: UploadFile):
        t0, n = time.time(), 0
        while chunk := await file.read(1024 * 1024):
            n += len(chunk)
        return {"bytes": n, "receive_s": round(time.time() - t0, 2)}

    return web


@app.function()
@modal.concurrent(max_inputs=10)
@modal.asgi_app(label="vp-probe-default")
def default_route():
    return make_app("default routing (us-east)")


@app.function(region="ap", routing_region="ap-south")
@modal.concurrent(max_inputs=10)
@modal.asgi_app(label="vp-probe-mumbai")
def mumbai_route():
    return make_app("Mumbai routing (ap-south)")
