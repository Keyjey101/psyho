# PsyHo — Ревью реализации

> Дата: 2026-04-21  
> Проверено по: AMENDMENTS.md + AUDIT.md  
> Фаза 5 (масштабирование) исключена из проверки.

---

## Итог: почти всё сделано отлично

Из 24 пунктов AMENDMENTS.md **21 выполнен корректно**, включая несколько незапланированных улучшений (Onboarding, MoodPage, Profile, pagination). Найдено **2 критических бага** (PWA сломан), **2 языковых бага** и **1 структурная проблема**.

---

## Сделано хорошо (не требует изменений)

| Компонент | Статус |
|---|---|
| `docker-compose.yml` — nginx удалён, `APP_PORT`, healthcheck | ✅ |
| `config.py` — `ADMIN_EMAILS`, `admin_emails_list`, валидатор `SECRET_KEY` | ✅ |
| `main.py` — slowapi подключён, admin + mood роутеры зарегистрированы | ✅ |
| `context.py` — опечатка исправлена, логирование добавлено | ✅ |
| `index.html` — полный SEO (OG, Twitter Card, JSON-LD, PWA теги) | ✅ |
| `vite.config.ts` — VitePWA плагин настроен | ✅ |
| `package.json` — `vite-plugin-pwa`, `react-helmet-async`, `rehype-sanitize` | ✅ |
| `middleware/admin.py` + `routers/admin.py` | ✅ |
| `pages/Admin.tsx` — метрики + деактивация, редирект на 403 | ✅ |
| `public/robots.txt` + `public/sitemap.xml` | ✅ |
| `hooks/usePWAInstall.ts` — iOS detection добавлен | ✅ |
| `prompts/*.txt` — инструкция «Отвечай на русском» добавлена во все файлы | ✅ |
| `orchestrator.py` — `preferred_style` полностью реализован (меняет системный промпт) | ✅ |
| `messages.py` — `preferred_style` читается из профиля и передаётся оркестратору | ✅ |
| `messages.py` — `break` при ошибке оркестратора (старый баг исправлен) | ✅ |
| `messages.py` — `context_compressed` WS-событие отправляется на фронт | ✅ |
| `messages.py` — лимит 10 000 символов на сообщение | ✅ |
| `messages.py` — курсорная пагинация (`before_id`) | ✅ |
| `models.py` — `MoodEntry` добавлен, индексы на FK-полях | ✅ |
| `Register.tsx` — Helmet noindex, редирект в `/onboarding`, 8 символов + цифра | ✅ |
| `main.tsx` — `HelmetProvider` оборачивает приложение | ✅ |
| `App.tsx` — все маршруты: admin, onboarding, profile, mood | ✅ |
| `nginx/` папка — удалена | ✅ |
| `.env.example` — `ADMIN_EMAILS`, `APP_PORT` добавлены | ✅ |

---

## Баги и недоделки

### 🔴 БАГ 1 — PWA иконки в SVG вместо PNG (ломает установку)

**Серьёзность:** Критическая — PWA не установится ни на Android, ни на iOS

**Что есть:**
```
frontend/public/icons/
├── pwa-192.svg        ← SVG
├── pwa-512.svg        ← SVG
└── apple-touch-icon.svg  ← SVG
```

**Что не совпадает с реальностью:**

`index.html:30`:
```html
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
```
→ файл `.png` не существует, Safari получает 404, иконка на домашнем экране iOS не появится.

`vite.config.ts:11`:
```ts
includeAssets: ["favicon.svg", "icons/*.png"],
```
→ паттерн `*.png` не матчит SVG-файлы, service worker их не закэширует.

`vite.config.ts:22–24`:
```ts
{ src: "/icons/pwa-192.png", sizes: "192x192", type: "image/png" },
{ src: "/icons/pwa-512.png", sizes: "512x512", type: "image/png" },
```
→ Chrome при попытке установить PWA найдёт пустые ссылки → установка невозможна.

**Почему PNG обязателен:**
- Chrome требует PNG-иконку 192px минимум для PWA install prompt
- iOS Safari не поддерживает SVG в `apple-touch-icon`
- Формат `"type": "image/png"` в манифесте не соответствует реальным SVG-файлам

**Исправление:**  
Конвертировать три SVG в PNG (или создать новые PNG с нуля):
```
public/icons/pwa-192.png       — 192×192 px
public/icons/pwa-512.png       — 512×512 px
public/icons/apple-touch-icon.png — 180×180 px
```
Можно сделать через Inkscape, Figma, GIMP или онлайн-конвертер (svg2png). После этого SVG-файлы можно удалить или оставить как исходники.

---

### 🔴 БАГ 2 — OG-изображение отсутствует

**Серьёзность:** Высокая для SEO/маркетинга

`index.html:19`:
```html
<meta property="og:image" content="https://yourdomain.com/og-image.jpg" />
```
Файл `frontend/public/og-image.jpg` **не создан**. При расшаривании ссылки в Telegram, VK, Twitter — превью будет без изображения.

**Исправление:**  
Создать файл `frontend/public/og-image.jpg` размером **1200×630 px**:
- Тёмный фон `#0f172a`
- Логотип / название PsyHo
- Подзаголовок «Психологическая поддержка 24/7»

---

### 🟡 БАГ 3 — Английское слово в промпте КПТ

**Файл:** `backend/app/agents/prompts/cbt.txt`, строка 25

```
- **Автоматические мысли**: какие мысли probable стоят за переживаниями
```

Слово `probable` — английское. Это нарушает языковую чистоту промпта и может смущать модель.

**Исправление:**
```
- **Автоматические мысли**: какие мысли вероятно стоят за переживаниями
```

---

### 🟡 БАГ 4 — Английское сообщение об ошибке в mood-роутере

**Файл:** `backend/app/routers/mood.py`, строка 26

```python
raise HTTPException(status_code=400, detail="Value must be between 1 and 5")
```

Все остальные ошибки в проекте на русском, это исключение.

**Исправление:**
```python
raise HTTPException(status_code=400, detail="Значение должно быть от 1 до 5")
```

---

### 🟠 НЕПОЛНОТА 5 — Заглушки `yourdomain.com` не заменены

Следующие файлы содержат placeholder, который нужно заменить на реальный домен перед деплоем:

| Файл | Строки | Что заменить |
|---|---|---|
| `frontend/index.html` | 13, 16, 17, 19 | `yourdomain.com` → реальный домен |
| `frontend/public/robots.txt` | 11 | `yourdomain.com` → реальный домен |
| `frontend/public/sitemap.xml` | 3 | `yourdomain.com` → реальный домен |

Это не баг, но перед деплоем обязательно. Рекомендуется вынести домен в переменную окружения:

В `vite.config.ts`:
```ts
define: {
  __SITE_URL__: JSON.stringify(process.env.VITE_SITE_URL || 'https://yourdomain.com'),
},
```

И заменить в `index.html` через `vite-plugin-html` — или просто сделать это вручную на этапе деплоя.

---

### ⚪ МИНОР 6 — Admin-страница без noindex

**Файл:** `frontend/src/pages/Admin.tsx`

Страницы Login и Register имеют `<Helmet><meta name="robots" content="noindex, nofollow" /></Helmet>`, а Admin — нет. Хотя страница за авторизацией, поисковые боты могут попробовать её проиндексировать.

**Исправление:** добавить в `Admin.tsx`:
```tsx
import { Helmet } from 'react-helmet-async';
// ...
<Helmet>
  <title>Админ-панель — PsyHo</title>
  <meta name="robots" content="noindex, nofollow" />
</Helmet>
```

---

### ⚪ МИНОР 7 — structlog импортируется внутри except-блока

**Файл:** `backend/app/routers/messages.py`, строки 139–140

```python
except Exception as e:
    import structlog          # ← импорт внутри функции
    structlog.get_logger().error(...)
```

Функциональной проблемы нет, но импорт должен быть на уровне модуля (как во всех остальных файлах).

**Исправление:** перенести `import structlog` в шапку файла.

---

## Незапланированные улучшения (сделаны сверх плана)

Это хорошие дополнения, которые улучшают продукт:

| Фича | Файлы |
|---|---|
| Трекер настроения (MoodEntry + MoodPage + mood router) | `models.py`, `routers/mood.py`, `pages/MoodPage.tsx` |
| Онбординг после регистрации | `pages/Onboarding.tsx` |
| Страница профиля | `pages/Profile.tsx` |
| Healthcheck в docker-compose | `docker-compose.yml:23-28` |
| Cursor-based пагинация (`before_id`) | `routers/messages.py:45-50` |
| `context_compressed` WS-событие | `routers/messages.py:166-167` |

---

## Приоритет исправлений

```
1. [КРИТИЧНО] Создать PNG иконки (pwa-192.png, pwa-512.png, apple-touch-icon.png)
              и обновить ссылку в index.html: apple-touch-icon.svg → .png

2. [ВЫСОКИЙ]  Создать public/og-image.jpg (1200×630)

3. [СРЕДНИЙ]  Исправить "probable" → "вероятно" в prompts/cbt.txt:25

4. [СРЕДНИЙ]  Исправить английский detail в routers/mood.py:26

5. [ДЕПЛОЙ]   Заменить yourdomain.com на реальный домен в index.html,
              robots.txt, sitemap.xml

6. [МИНОР]    Добавить <Helmet noindex> в pages/Admin.tsx

7. [МИНОР]    Перенести `import structlog` в шапку routers/messages.py
```
