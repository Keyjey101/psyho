# PsyHo — Психологический ИИ-консультант

Мультиагентная система ИИ-терапии. Шесть терапевтических подходов (КПТ, юнгианский анализ, ACT, IFS, нарративная и соматическая терапия) работают вместе в одном чате. Оркестратор автоматически классифицирует тему сообщения, подключает 1–2 релевантных специалиста и синтезирует единый ответ.

## Архитектура

```
Интернет → Серверный nginx (SSL, certbot) → localhost:8080 → Docker контейнер frontend (nginx)
                                                             ├── /api/* ──▶ backend:8000
                                                             ├── /ws/*  ──▶ backend:8000
                                                             └── /*     ──▶ React SPA (статика)
```

**Backend** — FastAPI + SQLAlchemy async + aiosqlite + OpenAI-совместимый API (ZAI/GLM)

**Frontend** — React 19 + TypeScript + Vite + TailwindCSS + Zustand + React Query + WebSocket стриминг

**Agents** — Orchestrator + 6 специалистов (CBT, Jungian, ACT, IFS, Narrative, Somatic) + кризисный детектор

## Стек

| Слой | Технология |
|---|---|
| Backend | FastAPI 0.115, uvicorn, SQLAlchemy 2 (async), aiosqlite |
| AI | ZAI/GLM (OpenAI-совместимый API), glm-5 / glm-4-flash |
| Auth | JWT (python-jose + bcrypt), httpOnly cookies, Telegram OTP |
| Frontend | React 19, TypeScript 6, Vite 5, TailwindCSS 3.4 |
| State | Zustand (auth), React Query (data) |
| Realtime | WebSocket с токен-стримингом |
| PWA | vite-plugin-pwa (service worker, manifest, offline shell) |
| DB | SQLite (WAL-режим), Alembic миграции |
| DevOps | Docker Compose, nginx 1.25 (в контейнере frontend) |
| SEO | Open Graph, Twitter Card, JSON-LD, sitemap.xml, robots.txt |

## Функциональность

- Мультиагентная терапия с автоматическим подбором подхода
- Кризисный детектор (суицид, селфхарм) с телефонами доверия
- Стриминг ответов через WebSocket (токен за токеном)
- Сжатие контекста при >40 сообщениях
- Авто-генерация заголовков сессий
- Персонализация: форма обращения (ты/вы), пол, стиль общения — влияют на ответы
- Трекер настроения с корреляцией «выполненные упражнения → настроение»
- Психопортрет: radar chart по 6 психологическим измерениям, сильные стороны, зоны роста, динамика
- Задания из сессий: при запросе упражнения создаётся задание; при следующей сессии спрашивается о выполнении
- Онбординг: цели, стиль, форма обращения, пол
- Долгосрочная память между сессиями
- Продолжение предыдущей сессии с контекстом
- Telegram mini-app + Telegram OTP-авторизация
- Голосовой ввод (Web Speech API)
- Экспорт истории чата (TXT/JSON)
- PWA — установка на домашний экран
- Админ-панель (статистика, управление пользователями)

## Структура проекта

```
psyho/
├── backend/
│   ├── app/
│   │   ├── agents/          # Оркестратор + 6 агентов + промпты
│   │   ├── middleware/       # Auth + Admin middleware
│   │   ├── models/           # SQLAlchemy модели
│   │   ├── routers/          # API эндпоинты
│   │   ├── schemas/          # Pydantic схемы
│   │   ├── services/         # Auth, context, AI provider, memory
│   │   ├── config.py
│   │   ├── database.py
│   │   └── main.py
│   ├── alembic/              # Миграции БД
│   ├── Dockerfile
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── api/              # Axios client
│   │   ├── components/       # UI компоненты (chat, landing)
│   │   ├── hooks/            # useChat, useAuth, useSessions, usePWAInstall
│   │   ├── pages/            # Страницы (Landing, Chat, MoodPage, PersonalityPage...)
│   │   ├── store/            # Zustand auth store
│   │   ├── types/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── public/               # robots.txt, sitemap.xml, manifest, icons
│   ├── Dockerfile            # Multi-stage: build → nginx с проксированием
│   └── vite.config.ts
├── docker-compose.yml
├── .env.example
└── docs/
```

## Локальная разработка

### Требования

- Python 3.12+
- Node.js 22+
- API-ключ ZAI (получить на [zai.chat](https://zai.chat))

### Запуск backend

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate       # Windows
# source .venv/bin/activate  # Linux/macOS
pip install -e .
```

Создать `backend/.env`:

```bash
ZAI_API_KEY=your-actual-key
SECRET_KEY=any-secret-for-dev
ENVIRONMENT=development
SESSION_MAX_EXCHANGES=20     # лимит обменов в одной сессии
```

```bash
uvicorn app.main:app --reload --port 8000
```

### Запуск frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend доступен на `http://localhost:5173`, проксирует `/api` и `/ws` на `localhost:8000`.

---

## Деплой на продакшен

### Общая схема

```
Интернет → Серверный nginx (443 SSL, certbot)
               │
               ▼
         localhost:8080    ← APP_PORT в .env
               │
               ▼
         Docker: frontend контейнер (nginx :80)
               ├── /           → React SPA (статика)
               ├── /api/*      → proxy_pass http://backend:8000
               ├── /ws/*       → proxy_pass http://backend:8000 (WebSocket upgrade)
               └── /health     → proxy_pass http://backend:8000
```

**Какой порт пробрасывать:** `APP_PORT=8080`. Внешний nginx проксирует всё на `http://127.0.0.1:8080`. Внутри Docker контейнер `frontend` слушает 80 и роутит запросы — статику отдаёт сам, а `/api` и `/ws` проксирует на контейнер `backend` (порт 8000, `expose`, не виден снаружи Docker).

### 1. Подготовка сервера

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
sudo apt install nginx certbot python3-certbot-nginx -y
```

### 2. Клонирование и конфигурация

```bash
git clone <repo-url> /opt/psyho
cd /opt/psyho
cp .env.example .env
nano .env
```

Отредактировать `.env`:

```bash
# AI Provider
ZAI_API_KEY=sk-xxxxxxxxxxxxxxxx

# Security — ОБЯЗАТЕЛЬНО сгенерировать
SECRET_KEY=$(openssl rand -hex 32)

# Домен (без слеша в конце)
ALLOWED_ORIGINS=https://yourdomain.com

# Telegram бот (для mini-app и OTP)
VITE_TG_BOT_USERNAME=@your_bot

# Админы (через запятую)
ADMIN_EMAILS=admin@example.com

# Порт, на котором приложение будет доступно на localhost
APP_PORT=8080

# Лимит обменов в одной сессии
SESSION_MAX_EXCHANGES=20

ENVIRONMENT=production
DATABASE_URL=sqlite+aiosqlite:////data/psyho.db
```

### 3. Сборка и запуск Docker

```bash
docker compose up -d --build
```

Проверить:

```bash
docker compose ps                        # оба сервиса up
curl http://localhost:8080/health         # {"status":"ok","version":"0.1.0"}
```

### 4. Настройка внешнего nginx

```bash
sudo nano /etc/nginx/sites-available/psyho
```

Вставить:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass         http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        "upgrade";
        proxy_read_timeout 86400;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/psyho /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### 5. SSL (Let's Encrypt)

```bash
sudo certbot --nginx -d yourdomain.com
```

Certbot автоматически добавит `listen 443 ssl`, сертификаты и редирект HTTP→HTTPS. Перезапускать Docker не нужно.

### 6. Заменить yourdomain.com

В трёх файлах заменить плейсхолдер на реальный домен:

```
frontend/index.html         — og:url, canonical, og:image, twitter:image, JSON-LD
frontend/public/robots.txt  — строка Sitemap
frontend/public/sitemap.xml — тег <loc>
```

Пересобрать:

```bash
docker compose up -d --build frontend
```

---

## Управление

```bash
docker compose logs -f                    # Логи
docker compose logs -f backend            # Только backend
docker compose restart                    # Перезапуск
docker compose up -d --build              # Обновление после git pull

# Бэкап БД
docker compose exec backend cp /data/psyho.db /data/psyho.db.bak
```

## API-эндпоинты

| Метод | Путь | Описание |
|---|---|---|
| POST | `/api/auth/register` | Регистрация |
| POST | `/api/auth/login` | Вход |
| POST | `/api/auth/refresh` | Обновление токена |
| POST | `/api/auth/logout` | Выход |
| POST | `/api/auth/telegram/start` | Telegram OTP — начало |
| POST | `/api/auth/telegram/verify` | Telegram OTP — верификация |
| GET | `/api/user/me` | Профиль пользователя |
| PATCH | `/api/user/me` | Обновить профиль (address_form, gender, style…) |
| GET | `/api/user/me/personality` | Психопортрет (snapshots) |
| GET | `/api/sessions` | Список сессий |
| POST | `/api/sessions` | Создать сессию |
| GET | `/api/sessions/{id}` | Сессия с сообщениями и exchange_count |
| DELETE | `/api/sessions/{id}` | Удалить сессию |
| POST | `/api/sessions/{id}/continue` | Создать продолжение сессии |
| GET | `/api/sessions/{id}/insights` | Инсайты по сессии |
| POST | `/api/sessions/{id}/action` | Action panel (insight / exercise) |
| WS | `/api/sessions/{id}/chat` | WebSocket чат |
| GET | `/api/tasks/pending` | Невыполненные задания |
| GET | `/api/tasks/history` | История всех заданий |
| PATCH | `/api/tasks/{id}/complete` | Отметить задание выполненным |
| POST | `/api/tasks` | Создать задание вручную |
| POST | `/api/mood` | Запись настроения |
| GET | `/api/mood` | История настроений |
| GET | `/api/admin/stats` | Статистика (админ) |
| GET | `/api/admin/users` | Пользователи (админ) |
| PATCH | `/api/admin/users/{id}/deactivate` | Деактивировать пользователя |
| GET | `/health` | Health check |

## Лицензия

Приватный проект.
