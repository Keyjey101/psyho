FROM python:3.12-slim AS base

WORKDIR /app

COPY pyproject.toml .
COPY app app
COPY alembic alembic
COPY alembic.ini alembic.ini
COPY start.sh start.sh

RUN pip install --no-cache-dir . && chmod +x start.sh

EXPOSE 8000

CMD ["./start.sh"]
