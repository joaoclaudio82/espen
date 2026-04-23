#!/usr/bin/env python3
"""
Remove fundo branco/cinza-claro conectado às bordas dos PNGs em logos/,
tornando-o transparente (preserva branco interno desconectado da borda).
"""
from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
LOGOS_DIR = ROOT / "logos"


def is_edge_background(r: int, g: int, b: int) -> bool:
    """Claro e pouco saturado = típico papel branco / cinza de fundo."""
    avg = (r + g + b) / 3.0
    sat = max(r, g, b) - min(r, g, b)
    return avg >= 236.0 and sat <= 40.0


def transparent_edge_flood(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    visited = [[False] * w for _ in range(h)]
    q: deque[tuple[int, int]] = deque()

    def try_push(x: int, y: int) -> None:
        if not (0 <= x < w and 0 <= y < h) or visited[y][x]:
            return
        r, g, b, a = px[x, y]
        if a < 10:
            visited[y][x] = True
            return
        if is_edge_background(r, g, b):
            visited[y][x] = True
            q.append((x, y))

    for x in range(w):
        try_push(x, 0)
        try_push(x, h - 1)
    for y in range(h):
        try_push(0, y)
        try_push(w - 1, y)

    while q:
        x, y = q.popleft()
        for dx, dy in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            nx, ny = x + dx, y + dy
            if not (0 <= nx < w and 0 <= ny < h) or visited[ny][nx]:
                continue
            r, g, b, a = px[nx, ny]
            if a < 10:
                visited[ny][nx] = True
                continue
            if is_edge_background(r, g, b):
                visited[ny][nx] = True
                q.append((nx, ny))

    for y in range(h):
        for x in range(w):
            if visited[y][x]:
                r, g, b, _ = px[x, y]
                px[x, y] = (r, g, b, 0)

    return im


def main() -> None:
    if not LOGOS_DIR.is_dir():
        raise SystemExit(f"Diretório não encontrado: {LOGOS_DIR}")
    for path in sorted(LOGOS_DIR.glob("*.png")):
        print(path.name, end=" … ")
        im = Image.open(path)
        out = transparent_edge_flood(im)
        out.save(path, "PNG", optimize=True)
        print("ok")


if __name__ == "__main__":
    main()
