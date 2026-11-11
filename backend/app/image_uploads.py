"""Shared validation for uploaded image files."""
from io import BytesIO

from fastapi import HTTPException, status
from PIL import Image

ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ("JPEG", ".jpg"),
    "image/png": ("PNG", ".png"),
    "image/webp": ("WEBP", ".webp"),
}
MAX_IMAGE_BYTES = 5 * 1024 * 1024


def validate_image_upload(upload, max_bytes=MAX_IMAGE_BYTES):
    """Return validated image bytes and extension; reject spoofed or oversized files."""
    image_type = upload.content_type
    if image_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Allowed image types: JPG, PNG, WEBP.",
        )

    try:
        upload.file.seek(0)
        data = upload.file.read(max_bytes + 1)
        upload.file.seek(0)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not read uploaded image.",
        )

    if len(data) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Maximum image size is 5 MB.",
        )

    expected_format, extension = ALLOWED_IMAGE_TYPES[image_type]
    try:
        with Image.open(BytesIO(data)) as image:
            actual_format = image.format
            image.verify()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Uploaded file is not a valid image.",
        )

    if actual_format != expected_format:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Image content does not match its declared file type.",
        )

    return data, extension
