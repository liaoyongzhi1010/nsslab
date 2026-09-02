from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.storage import StateRepository, import_legacy_sqlite


parser = argparse.ArgumentParser(description="将旧版 CryptoLab SQLite 状态导入当前 PostgreSQL 数据库")
parser.add_argument("source", type=Path, help="旧版 cryptolab.db 路径")
args = parser.parse_args()
count = import_legacy_sqlite(args.source.resolve(), StateRepository())
print(f"已导入 {count} 个实验项目；源数据库未被修改。")
