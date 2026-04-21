# PsyHo — Уточнения к плану и конкретные изменения

> Дата: 2026-04-21  
> Статус: Доработки к AUDIT.md на основе уточнений требований

---

## Краткое резюме изменений

| # | Тема | Суть изменения |
|---|---|---|
| 1 | Docker/Nginx | Убрать nginx из docker-compose, пробросить один порт наружу |
| 2 | Админ-система | ADMIN_EMAILS в .env + защищённые эндпоинты `/api/admin/*` |
| 3 | SEO лендинга | Meta-теги, OG, JSON-LD, sitemap.xml, robots.txt |
| 4 | Русский язык | Проверка промптов и сервисных сообщений; одна опечатка найдена |
| 5 | PWA | vite-plugin-pwa, manifest.json, service worker, иконки |

---

## 1. Docker / Nginx — убрать nginx из compose

### Текущая ситуация
В `docker-compose.yml` присутствует nginx-сервис, который:
- Слушает порты `80:80` и `443:443`
- Внутри роутит `/api` и `/ws` → backend, `/` → frontend

### Желаемое поведение
Внешний nginx (с certbot) уже стоит на сервере и управляет SSL. Приложению нужно только торчать на одном порту.

### Что изменить в docker-compose.yml

Убрать сервис `nginx` полностью. Оба внутренних сервиса (`backend`, `frontend`) уже используют `expose` — они недоступны снаружи Docker-сети. Нужно прокинуть **только** порт frontend-контейнера (внутри него уже есть nginx, который роутит `/api` и `/ws` на backend):

```yaml
# docker-compose.yml — итоговый вид

version: '3.9'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      - ZAI_API_KEY=${ZAI_API_KEY}
      - ZAI_BASE_URL=${ZAI_BASE_URL:-https://api.zai.chat/v1}
      - ZAI_MODEL=${ZAI_MODEL:-glm-5}
      - ZAI_SMALL_MODEL=${ZAI_SMALL_MODEL:-glm-4-flash}
      - SECRET_KEY=${SECRET_KEY}
      - ADMIN_EMAILS=${ADMIN_EMAILS:-}
      - ENVIRONMENT=production
      - DATABASE_URL=sqlite+aiosqlite:////data/psyho.db
      - ALLOWED_ORIGINS=${ALLOWED_ORIGINS}
    volumes:
      - sqlite_data:/data
    restart: unless-stopped
    expose:
      - "8000"

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "${APP_PORT:-8080}:80"   # ← этот порт видит внешний мир
    depends_on:
      - backend

volumes:
  sqlite_data:
```

> **Как это работает:** frontend-контейнер содержит nginx, который уже сейчас (в `nginx/nginx.conf`) проксирует `/api/*` и `/ws/*` на `backend:8000`. Внешний nginx просто проксирует всё на `localhost:8080`.

### Конфиг внешнего nginx (пример для certbot)

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    location / {
        proxy_pass         http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto https;
        # WebSocket support
        proxy_set_header   Upgrade    $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_read_timeout 86400;
    }
}

server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$host$request_uri;
}
```

### Что удалить из проекта
- `nginx/` папка с `nginx.conf` и `frontend.conf` — они относятся к docker-внутреннему nginx-у, который убирается
- Фронтенд Dockerfile содержит свой nginx-конфиг — **он остаётся**, это сервер для статики и проксирования

### APP_PORT добавить в .env.example
```bash
APP_PORT=8080
```

---

## 2. Админ-система через ADMIN_EMAILS

### Концепция
Без ролей в БД. Администраторы определяются через `.env`:
```bash
ADMIN_EMAILS=keyjey.danilov@gmail.com,admin2@example.com
```

### Изменения в backend

#### 2.1 config.py — добавить поле
```python
ADMIN_EMAILS: str = ""

@property
def admin_emails_list(self) -> list[str]:
    return [e.strip().lower() for e in self.ADMIN_EMAILS.split(",") if e.strip()]
```

#### 2.2 middleware/admin.py — новый файл
```python
from fastapi import Depends, HTTPException, status
from app.middleware.auth import get_current_user
from app.config import get_settings

async def get_admin_user(
    current_user=Depends(get_current_user),
    settings=Depends(get_settings),
):
    if current_user.email.lower() not in settings.admin_emails_list:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ запрещён",
        )
    return current_user
```

#### 2.3 routers/admin.py — новый файл
```python
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from app.middleware.admin import get_admin_user
from app.database import get_db
from app.models.models import User, ChatSession, Message

router = APIRouter(prefix="/api/admin", tags=["admin"])

@router.get("/stats")
async def get_stats(admin=Depends(get_admin_user), db=Depends(get_db)):
    users_count  = await db.scalar(select(func.count()).select_from(User))
    sessions_count = await db.scalar(select(func.count()).select_from(ChatSession))
    messages_count = await db.scalar(select(func.count()).select_from(Message))
    return {
        "users": users_count,
        "sessions": sessions_count,
        "messages": messages_count,
    }

@router.get("/users")
async def list_users(
    skip: int = 0,
    limit: int = 50,
    admin=Depends(get_admin_user),
    db=Depends(get_db),
):
    result = await db.execute(
        select(User).order_by(User.created_at.desc()).offset(skip).limit(limit)
    )
    users = result.scalars().all()
    return [
        {
            "id": u.id,
            "email": u.email,
            "name": u.name,
            "created_at": u.created_at,
            "is_active": u.is_active,
        }
        for u in users
    ]

@router.patch("/users/{user_id}/deactivate")
async def deactivate_user(
    user_id: str,
    admin=Depends(get_admin_user),
    db=Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "Пользователь не найден")
    user.is_active = False
    await db.commit()
    return {"ok": True}
```

#### 2.4 main.py — зарегистрировать роутер
```python
from app.routers import admin
app.include_router(admin.router)
```

### Фронтенд — страница /admin
Простая страница (только для авторизованного пользователя с email из списка), показывающая:
- Счётчики: пользователи / сессии / сообщения
- Таблица пользователей с кнопкой деактивации
- Определяется через `GET /api/admin/stats` — если 403, редирект на главную

---

## 3. SEO лендинга

### 3.1 index.html — полный набор мета-тегов

```html
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <!-- Primary Meta -->
    <title>PsyHo — Психологический ИИ-консультант | Онлайн-поддержка 24/7</title>
    <meta name="description"
          content="Поговори с ИИ-психологом анонимно и без осуждения. КПТ, юнгианский анализ, ACT, IFS и другие подходы. Бесплатно, круглосуточно, на русском." />
    <meta name="keywords"
          content="психологическая помощь онлайн, ИИ психолог, КПТ онлайн, анонимный психолог, психологическая поддержка, когнитивно-поведенческая терапия, психолог бесплатно" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="https://yourdomain.com/" />

    <!-- Open Graph -->
    <meta property="og:type"        content="website" />
    <meta property="og:url"         content="https://yourdomain.com/" />
    <meta property="og:title"       content="PsyHo — Психологический ИИ-консультант" />
    <meta property="og:description" content="Поговори с ИИ-психологом анонимно и без осуждения. КПТ, юнгианский анализ, ACT и другие подходы. 24/7." />
    <meta property="og:image"       content="https://yourdomain.com/og-image.jpg" />
    <meta property="og:locale"      content="ru_RU" />
    <meta property="og:site_name"   content="PsyHo" />

    <!-- Twitter Card -->
    <meta name="twitter:card"        content="summary_large_image" />
    <meta name="twitter:title"       content="PsyHo — Психологический ИИ-консультант" />
    <meta name="twitter:description" content="ИИ-психолог: анонимно, без осуждения, 24/7" />
    <meta name="twitter:image"       content="https://yourdomain.com/og-image.jpg" />

    <!-- PWA -->
    <link rel="manifest" href="/manifest.webmanifest" />
    <meta name="theme-color" content="#818cf8" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />

    <!-- JSON-LD Structured Data -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "name": "PsyHo",
      "description": "Психологический ИИ-консультант: анонимная поддержка 24/7",
      "url": "https://yourdomain.com",
      "applicationCategory": "HealthApplication",
      "operatingSystem": "Web",
      "inLanguage": "ru",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "RUB"
      },
      "provider": {
        "@type": "Organization",
        "name": "PsyHo"
      }
    }
    </script>

    <!-- Preconnect -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="preconnect" href="https://api.zai.chat" />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet" />

    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

> **Важно:** заменить `yourdomain.com` на реальный домен. Лучше вынести через `vite-plugin-html` + `env` переменную `VITE_SITE_URL`.

### 3.2 public/robots.txt
```
User-agent: *
Allow: /
Disallow: /chat
Disallow: /login
Disallow: /register
Disallow: /admin
Disallow: /api/

Sitemap: https://yourdomain.com/sitemap.xml
```

### 3.3 public/sitemap.xml
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://yourdomain.com/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
    <lastmod>2026-04-21</lastmod>
  </url>
</urlset>
```

### 3.4 OG-изображение
Нужно создать `public/og-image.jpg` размером **1200×630 px**:
- Тёмный фон (цвет темы `#0f172a`)
- Логотип / название PsyHo
- Слоган: «Психологическая поддержка 24/7»

### 3.5 React Helmet для динамических мета-тегов
Страницы `/login` и `/register` должны иметь `noindex`:
```bash
npm install react-helmet-async
```
```tsx
// Login.tsx
import { Helmet } from 'react-helmet-async';
// ...
<Helmet>
  <title>Вход — PsyHo</title>
  <meta name="robots" content="noindex, nofollow" />
</Helmet>
```

### 3.6 Производительность (Core Web Vitals)
- Изображения на лендинге через `loading="lazy"` и `width`/`height` атрибуты
- Шрифт Inter уже подключён через `preconnect` + `rel="stylesheet"` — ок
- Framer Motion уже используется — убедиться, что анимации не блокируют LCP
- Вынести иконки специалистов в SVG (не PNG), чтобы не было reflow

---

## 4. Проверка русского языка

### Результат проверки: промпты ✅ полностью на русском

| Файл | Язык | Статус |
|---|---|---|
| `prompts/orchestrator.txt` | Русский | ✅ |
| `prompts/cbt.txt` | Русский | ✅ |
| `prompts/jungian.txt` | Русский | ✅ |
| `prompts/act.txt` | Русский | ✅ |
| `prompts/ifs.txt` | Русский | ✅ |
| `prompts/narrative.txt` | Русский | ✅ |
| `prompts/somatic.txt` | Русский | ✅ |
| `services/context.py` — title generation | Русский | ✅ |
| `services/context.py` — compression | Русский | ✅ (но есть опечатка) |

### Найденная опечатка — исправить

**Файл:** `backend/app/services/context.py`, строка 87

```python
# Текущий (неверно):
"content": f"...ключевые темы, эмоции,_insайты и прогресс..."

# Исправить на:
"content": f"...ключевые темы, эмоции, инсайты и прогресс..."
```

### Что добавить в промпты

В конец каждого промпта агентов добавить явную инструкцию:
```
## Язык ответа

Всегда отвечай на русском языке, независимо от языка пользователя.
```

В orchestrator.txt это особенно важно, так как если пользователь напишет на английском — оркестратор должен отвечать по-русски (или спросить, на каком языке продолжить).

---

## 5. PWA (Progressive Web App)

### Возможно ли? Да, полностью.

React + Vite + `vite-plugin-pwa` даёт готовое PWA за ~30 минут работы. Приложение станет:
- Устанавливаемым на домашний экран (Android/iOS/Desktop)
- Работающим офлайн (кэш лендинга и UI-shell)
- С нотификациями о старте (install prompt)

### 5.1 Установить зависимость
```bash
npm install -D vite-plugin-pwa
```

### 5.2 vite.config.ts — добавить плагин

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icons/*.png"],
      manifest: {
        name: "PsyHo — Психологический ИИ-консультант",
        short_name: "PsyHo",
        description: "ИИ-психолог: анонимно, без осуждения, 24/7",
        theme_color: "#818cf8",
        background_color: "#0f172a",
        display: "standalone",
        start_url: "/",
        lang: "ru",
        icons: [
          { src: "/icons/pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
        categories: ["health", "lifestyle"],
        screenshots: [
          {
            src: "/og-image.jpg",
            sizes: "1200x630",
            type: "image/jpeg",
            label: "PsyHo — главный экран",
          },
        ],
      },
      workbox: {
        // Кэшировать статику лендинга
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        // API и WS — только через сеть (не кэшировать)
        runtimeCaching: [
          {
            urlPattern: /^\/api\//,
            handler: "NetworkOnly",
          },
          {
            urlPattern: /^\/ws\//,
            handler: "NetworkOnly",
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    proxy: {
      "/api": { target: "http://localhost:8000", changeOrigin: true },
      "/ws":  { target: "ws://localhost:8000", ws: true },
    },
  },
});
```

### 5.3 Иконки — что создать

```
public/icons/
├── pwa-192.png     — 192×192 px, PNG
├── pwa-512.png     — 512×512 px, PNG (maskable)
└── apple-touch-icon.png  — 180×180 px, PNG (для iOS Safari)
```

Дизайн: фиолетовый круг (`#818cf8`) + белая буква Ψ (пси). Можно сгенерировать через [RealFaviconGenerator](https://realfavicongenerator.net) из SVG.

### 5.4 main.tsx — ничего менять не нужно
`vite-plugin-pwa` автоматически регистрирует service worker при сборке.

### 5.5 Опциональный install prompt

```tsx
// src/hooks/usePWAInstall.ts
import { useState, useEffect } from 'react';

export function usePWAInstall() {
  const [prompt, setPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = async () => {
    if (!prompt) return;
    prompt.prompt();
    await prompt.userChoice;
    setPrompt(null);
  };

  return { canInstall: !!prompt, install };
}
```

Использовать в `Hero.tsx` или `Sidebar.tsx` — показать кнопку «Установить приложение» если `canInstall`.

### 5.6 iOS Safari — особенности
iOS не поддерживает `beforeinstallprompt`. Добавить в мета-теги (уже включено в секцию 3.1):
```html
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="PsyHo" />
```
И показать iOS-пользователям подсказку: «Нажмите Share → На экран «Домой»».

---

## 6. Обновлённый .env.example

```bash
# AI Provider (ZAI/GLM)
ZAI_API_KEY=your-zai-api-key
ZAI_BASE_URL=https://api.zai.chat/v1
ZAI_MODEL=glm-5
ZAI_SMALL_MODEL=glm-4-flash

# Security
SECRET_KEY=generate-with-openssl-rand-hex-32
ALLOWED_ORIGINS=https://yourdomain.com

# Admin (comma-separated emails)
ADMIN_EMAILS=your@email.com

# App
APP_PORT=8080          # порт, который слушает внешний nginx
ENVIRONMENT=production
```

---

## 7. Итоговый список файлов к изменению / созданию

### Изменить
| Файл | Что изменить |
|---|---|
| `docker-compose.yml` | Убрать nginx-сервис, добавить `ports` к frontend, добавить `ADMIN_EMAILS` |
| `backend/app/config.py` | Добавить `ADMIN_EMAILS` поле и `admin_emails_list` свойство |
| `backend/app/main.py` | Зарегистрировать admin роутер |
| `backend/app/services/context.py` | Исправить опечатку `_insайты` → `инсайты` |
| `frontend/index.html` | Полный набор SEO мета-тегов + PWA ссылки |
| `frontend/vite.config.ts` | Добавить VitePWA плагин |
| `frontend/package.json` | Добавить `vite-plugin-pwa`, `react-helmet-async` |
| Все `prompts/*.txt` | Добавить инструкцию «Отвечай только на русском» |

### Создать
| Файл | Содержимое |
|---|---|
| `backend/app/middleware/admin.py` | `get_admin_user` зависимость |
| `backend/app/routers/admin.py` | `/api/admin/*` эндпоинты |
| `frontend/src/pages/Admin.tsx` | Страница метрик для администратора |
| `frontend/src/hooks/usePWAInstall.ts` | Install prompt hook |
| `frontend/public/robots.txt` | Разрешения для роботов |
| `frontend/public/sitemap.xml` | Карта сайта |
| `frontend/public/icons/pwa-192.png` | PWA иконка 192px |
| `frontend/public/icons/pwa-512.png` | PWA иконка 512px |
| `frontend/public/icons/apple-touch-icon.png` | iOS иконка 180px |
| `frontend/public/og-image.jpg` | OG-изображение 1200×630 |
| `.env.example` (корень) | Обновить с `ADMIN_EMAILS` и `APP_PORT` |

### Удалить
| Файл | Причина |
|---|---|
| `nginx/nginx.conf` | Nginx убирается из docker-compose |
| `nginx/frontend.conf` | То же |
| Папка `nginx/` | Больше не нужна |

---

## 8. Приоритет выполнения

```
1. [Критично] docker-compose.yml — убрать nginx, пробросить порт
2. [Критично] Исправить опечатку в context.py
3. [Высокий]  Добавить ADMIN_EMAILS в config + middleware + router
4. [Высокий]  SEO мета-теги в index.html + robots.txt + sitemap.xml
5. [Средний]  PWA: vite-plugin-pwa + иконки + manifest
6. [Средний]  Добавить "Отвечай на русском" в промпты агентов
7. [Низкий]   Admin страница на фронте
8. [Низкий]   react-helmet-async для noindex на auth-страницах
9. [Низкий]   PWA install prompt в UI
```
