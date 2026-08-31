"""Авторизация админ-панели (02-api-contract.md, раздел Auth). Реализация — Этап 3."""

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.routers._stub import not_implemented

STAGE = "Этап 3"

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
async def login() -> JSONResponse:
    """JWT access в теле ответа + refresh в httpOnly cookie с SameSite."""
    return not_implemented(STAGE)


@router.post("/refresh")
async def refresh() -> JSONResponse:
    return not_implemented(STAGE)


@router.post("/logout")
async def logout() -> JSONResponse:
    return not_implemented(STAGE)


@router.get("/me")
async def me() -> JSONResponse:
    return not_implemented(STAGE)
