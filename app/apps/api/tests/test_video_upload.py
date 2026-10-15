"""Реальная подготовка видео и отказ до записи неподходящих файлов."""

import io
import json
import subprocess

import pytest
from fastapi import HTTPException, UploadFile
from PIL import Image

from app.services import storage, video


@pytest.fixture
def short_video(tmp_path):
    source = tmp_path / "source.mp4"
    subprocess.run(
        [
            "ffmpeg",
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            "color=c=red:s=64x48:r=5:d=0.6",
            "-metadata",
            "comment=private-gps",
            "-c:v",
            "libx264",
            "-threads",
            "1",
            "-pix_fmt",
            "yuv420p",
            str(source),
        ],
        check=True,
        capture_output=True,
        timeout=20,
    )
    return source.read_bytes()


async def test_admin_video_upload_and_seek(client, admin_headers, short_video):
    response = await client.post(
        "/api/v1/admin/uploads/video",
        headers=admin_headers,
        files={"file": ("unsafe-name.mov", short_video, "application/octet-stream")},
    )
    assert response.status_code == 201, response.text
    keys = response.json()
    full = await client.get("/media/" + keys["storage_key"])
    assert full.status_code == 200
    assert full.headers["content-type"] == "video/mp4"
    part = await client.get("/media/" + keys["storage_key"], headers={"Range": "bytes=0-31"})
    assert part.status_code == 206
    assert part.content == full.content[:32]
    assert "unsafe-name" not in keys["storage_key"]
    assert Image.open(io.BytesIO(await storage.read_object(keys["poster_key"]))).format == "WEBP"
    probe = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_streams",
            "-show_format",
            "-of",
            "json",
            str(storage.object_path(keys["storage_key"])),
        ],
        check=True,
        capture_output=True,
        timeout=20,
    )
    data = json.loads(probe.stdout)
    assert [s["codec_type"] for s in data["streams"]] == ["video"]
    assert data["streams"][0]["codec_name"] == "h264"
    assert b"private-gps" not in probe.stdout


async def test_video_upload_requires_admin(client, short_video):
    response = await client.post(
        "/api/v1/admin/uploads/video", files={"file": ("x.mp4", short_video, "video/mp4")}
    )
    assert response.status_code == 401


async def test_fake_video_is_not_saved(client, admin_headers):
    response = await client.post(
        "/api/v1/admin/uploads/video",
        headers=admin_headers,
        files={"file": ("x.mp4", b"<html>not video</html>", "video/mp4")},
    )
    assert response.status_code == 400
    assert not storage.object_path("hero").exists()


async def test_video_size_checked_before_processing(monkeypatch):
    monkeypatch.setattr(video, "MAX_VIDEO_BYTES", 4)
    with pytest.raises(HTTPException) as caught:
        await video.upload_video(UploadFile(io.BytesIO(b"12345")))
    assert caught.value.status_code == 413


@pytest.mark.parametrize("duration", ["NaN", "Infinity", "181", "0"])
def test_invalid_duration_rejected(duration):
    with pytest.raises(HTTPException):
        video._validate_probe(
            json.dumps(
                {
                    "format": {"duration": duration},
                    "streams": [{"codec_type": "video", "width": 64, "height": 48}],
                }
            ).encode()
        )
