FROM python:3.13-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app
RUN groupadd --system cryptolab && useradd --system --gid cryptolab --home-dir /app cryptolab
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY alembic.ini ./
COPY alembic ./alembic
COPY app ./app
COPY resources ./resources
COPY scripts ./scripts
COPY docker-entrypoint.sh ./
RUN chmod 755 docker-entrypoint.sh && mkdir -p /data/uploads && chown -R cryptolab:cryptolab /data /app

USER cryptolab
EXPOSE 8000
ENTRYPOINT ["./docker-entrypoint.sh"]
