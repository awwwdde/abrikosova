"""Публичные медиа и изоляция закрытых каталогов локального хранилища."""

import io

import pytest
from PIL import Image

from app.services import storage


async def test_public_photo_and_range(client):
    image = io.BytesIO()
    Image.new("RGB", (48, 48), "red").save(image, format="JPEG")
    key = await storage.store_image(image.getvalue(), "pages")
    response = await client.get("/media/" + key)
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/webp"
    assert "immutable" in response.headers["cache-control"]
    assert response.headers["x-content-type-options"] == "nosniff"
    assert Image.open(io.BytesIO(response.content)).format == "WEBP"
    partial = await client.get("/media/" + key, headers={"Range": "bytes=0-7"})
    assert partial.status_code == 206
    assert partial.content == response.content[:8]
    assert partial.headers["content-range"].startswith("bytes 0-7/")
    head = await client.head("/media/" + key)
    assert head.status_code == 200
    assert head.content == b""


@pytest.mark.parametrize("prefix", ["references", "backups", "references-public", "unknown"])
async def test_private_files_are_not_public(client, prefix):
    key = prefix + "/secret.webp"
    await storage.write_object(key, b"private")
    assert await storage.read_object(key) == b"private"
    response = await client.get("/media/" + key)
    assert response.status_code == 404
    assert b"private" not in response.content


@pytest.mark.parametrize(
    "key",
    [
        "../secret",
        "/etc/passwd",
        "products/../backups/x.webp",
        "pages//x",
        "pages/./x",
        "pages\\x",
        "pages/%2e%2e/x",
        "pages/" + "x" * 500,
    ],
)
async def test_invalid_storage_keys_are_rejected(key):
    with pytest.raises(ValueError):
        await storage.write_object(key, b"unsafe")


async def test_symlink_cannot_expose_private_file(client):
    await storage.write_object("references/private.webp", b"private")
    public = storage.object_path("pages/link.webp")
    public.parent.mkdir(exist_ok=True)
    public.symlink_to(storage.object_path("references/private.webp"))
    response = await client.get("/media/pages/link.webp")
    assert response.status_code == 404
    assert await storage.read_object("references/private.webp") == b"private"


async def test_failed_write_keeps_old_file_and_removes_temporary():
    key = "backups/existing.dump"
    await storage.write_object(key, b"original")

    class Interrupted:
        def read(self, size):
            raise OSError("interrupted")

    with pytest.raises(OSError):
        await storage.write_stream(key, Interrupted())
    assert await storage.read_object(key) == b"original"
    assert list(storage.object_path(key).parent.glob(".upload-*")) == []


async def test_large_backup_uses_file_copy_and_stays_private(client, tmp_path):
    source, target = tmp_path / "source.dump", tmp_path / "restored.dump"
    source.write_bytes(b"database" * 100_000)
    await storage.write_file("backups/test.dump", str(source))
    await storage.copy_to_file("backups/test.dump", str(target))
    assert target.read_bytes() == source.read_bytes()
    assert await storage.object_size("backups/test.dump") == source.stat().st_size
    assert (await client.get("/media/backups/test.dump")).status_code == 404
    await storage.delete_image("backups/test.dump")
    assert await storage.object_size("backups/test.dump") is None


async def test_only_known_media_types_are_served(client):
    await storage.write_object("pages/payload.html", b"<script>alert(1)</script>")
    assert (await client.get("/media/pages/payload.html")).status_code == 404
    assert (await client.get("/media/pages/missing.webp")).status_code == 404
