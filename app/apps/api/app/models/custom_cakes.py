"""Торты на заказ и начинки (01-data-model.md, разделы 5-6)."""

from decimal import Decimal

from sqlalchemy import Boolean, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class CustomCake(Base):
    __tablename__ = "custom_cakes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    price_from: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    image_key: Mapped[str] = mapped_column(String(500), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class Filling(Base):
    __tablename__ = "fillings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    image_key: Mapped[str] = mapped_column(String(500), nullable=False)
    price_per_kg: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
