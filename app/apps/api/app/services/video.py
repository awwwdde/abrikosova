"""Подготовка загружаемого через админку фона: MP4 без звука и WEBP-постер."""

import asyncio
import json
import math
import tempfile
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.services import storage

MAX_VIDEO_BYTES = 100 * 1024 * 1024
MAX_DURATION = 180
PROCESS_TIMEOUT = 120


async def _run(*args: str) -> bytes:
    try:
        process = await asyncio.create_subprocess_exec(
            *args, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
        )
    except FileNotFoundError:
        raise HTTPException(503, "Подготовка видео недоступна на сервере") from None
    try:
        output, _ = await asyncio.wait_for(process.communicate(), PROCESS_TIMEOUT)
    except (TimeoutError, asyncio.CancelledError) as exc:
        process.kill()
        await process.communicate()
        if isinstance(exc, asyncio.CancelledError):
            raise
        raise HTTPException(400, "Не удалось подготовить видео за две минуты") from None
    if process.returncode:
        raise HTTPException(400, "Не удалось прочитать видео. Загрузите MP4, MOV или WebM")
    return output


def _validate_probe(raw: bytes) -> None:
    try:
        probe = json.loads(raw)
        stream = next(s for s in probe["streams"] if s.get("codec_type") == "video")
        width, height = int(stream["width"]), int(stream["height"])
        duration = float(probe["format"]["duration"])
    except (ValueError, KeyError, TypeError, StopIteration):
        raise HTTPException(400, "Файл не содержит подходящего видео") from None
    if not math.isfinite(duration) or not 0 < duration <= MAX_DURATION:
        raise HTTPException(400, "Видео должно быть не длиннее трёх минут")
    if min(width, height) < 2 or max(width, height) > 3840 or width * height > 8_294_400:
        raise HTTPException(400, "Разрешение видео должно быть не больше 4K")


async def upload_video(file: UploadFile) -> dict[str, str]:
    # Размер ограничен при потоковом чтении, до запуска декодера. Расширение
    # и Content-Type клиента не участвуют в определении настоящего формата.
    with tempfile.TemporaryDirectory(prefix="abrikosova-video-") as directory:
        source = Path(directory) / "input"
        size = 0
        with source.open("wb") as out:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_VIDEO_BYTES:
                    raise HTTPException(413, "Видео больше 100 МБ")
                out.write(chunk)
        if not size:
            raise HTTPException(400, "Пустой файл")
        probe = await _run(
            "ffprobe",
            "-v",
            "error",
            "-protocol_whitelist",
            "file",
            "-format_whitelist",
            "mov,matroska,webm",
            "-show_entries",
            "format=duration:stream=codec_type,width,height",
            "-of",
            "json",
            str(source),
        )
        _validate_probe(probe)
        video, poster = Path(directory) / "video.mp4", Path(directory) / "poster.webp"
        await _run(
            "ffmpeg",
            "-v",
            "error",
            "-nostdin",
            "-y",
            "-protocol_whitelist",
            "file",
            "-format_whitelist",
            "mov,matroska,webm",
            "-i",
            str(source),
            "-map",
            "0:v:0",
            "-an",
            "-sn",
            "-dn",
            "-map_metadata",
            "-1",
            "-map_chapters",
            "-1",
            "-vf",
            "scale=w='min(1920,iw)':h='min(1080,ih)':"
            "force_original_aspect_ratio=decrease:force_divisible_by=2",
            "-r",
            "30",
            "-c:v",
            "libx264",
            "-threads",
            "2",
            "-preset",
            "veryfast",
            "-crf",
            "24",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            str(video),
        )
        await _run(
            "ffmpeg",
            "-v",
            "error",
            "-nostdin",
            "-y",
            "-i",
            str(video),
            "-frames:v",
            "1",
            "-c:v",
            "libwebp",
            "-quality",
            "82",
            str(poster),
        )
        key = f"hero/{uuid.uuid4().hex}.mp4"
        poster_key = f"hero/{uuid.uuid4().hex}.webp"
        try:
            await storage.write_file(key, str(video))
            await storage.write_file(poster_key, str(poster))
        except OSError:
            await storage.delete_image(key)
            await storage.delete_image(poster_key)
            raise HTTPException(502, "Не удалось сохранить видео") from None
        return {"storage_key": key, "poster_key": poster_key}
