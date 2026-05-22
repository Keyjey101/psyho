# 06. Frontend & UX: Анимации и Интерфейс

## 6.1 Принципы дизайна

- **Mobile First:** все компоненты проектируются под 375px, масштабируются вверх.
- **Минимализм с характером:** чистые поверхности, крупная типографика, акцент на анимации.
- **Нет звуков:** никаких аудиоэффектов, иконок громкости, кнопок mute.
- **Эффект печати** сохраняется как основной способ появления текста.
- **TailwindCSS** — использовать существующую цветовую систему (`primary-*`, `chalk-*`,
  `warm-*`, `surface-*`).

---

## 6.2 Анимация «Думания» (`ThinkingSpinner`)

Компонент: `frontend/src/components/game/ThinkingSpinner.tsx`

### Визуальная структура

```
      ╭──────────────╮
     /  ░░░░░░░▓▓▓▓▓  \        ← дуга-эквалайзер вращается по часовой
    |   ░░░░░░░▓▓▓▓▓▓  |       ← градиент: прозрачный → primary-400 → primary-600
    |     «Фраза»       |       ← текст в центре
    |                   |
     \                 /
      ╰───────────────╯
```

### Реализация (CSS + SVG)

```tsx
// Компонент
export function ThinkingSpinner({ visible }: { visible: boolean }) {
  const [phraseIdx, setPhraseIdx] = useState(0);
  
  useEffect(() => {
    if (!visible) return;
    const timer = setInterval(() => {
      setPhraseIdx(i => (i + 1) % PHRASES.length);
    }, 2000);
    return () => clearInterval(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div className="relative w-32 h-32">
        {/* SVG-дуга с градиентным вращением */}
        <svg className="animate-spin-slow" viewBox="0 0 100 100">
          <defs>
            <linearGradient id="arc-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="transparent" />
              <stop offset="100%" stopColor="currentColor" className="text-primary-500" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="45" fill="none"
            stroke="url(#arc-grad)" strokeWidth="4"
            strokeDasharray="220 60" strokeLinecap="round" />
        </svg>
        {/* Фраза в центре */}
        <div className="absolute inset-0 flex items-center justify-center px-3 text-center">
          <span className="text-xs text-chalk-600 leading-tight transition-opacity duration-500">
            {PHRASES[phraseIdx]}
          </span>
        </div>
      </div>
    </div>
  );
}
```

### Фразы (статический массив, ≥ 12 штук, нет повторов подряд)

```typescript
const PHRASES = [
  "Раскладываем мысли по полочкам...",
  "Спрашиваем у внутреннего психолога...",
  "Ищем подходящий вопрос...",
  "Настраиваем эмпатию...",
  "Почему люди выбирают третий вариант?...",
  "Анализируем паттерн...",
  "Слушаем между строк...",
  "Подбираем слова...",
  "Думаем вместе с тобой...",
  "Проверяем гипотезу...",
  "Калибруем интуицию...",
  "Ищем ключ к разгадке...",
];
```

**Требования к анимации вращения:**
- CSS класс `animate-spin-slow`: `animation: spin 3s linear infinite`.
- Дуга занимает ~75% окружности (strokeDasharray).
- Градиент — от прозрачного к `primary-500`.

**Появление/исчезновение спиннера:**
- Появляется мгновенно при отправке ответа.
- Исчезает с `opacity 0` transition 300ms при получении ответа.

---

## 6.3 Анимация Занавеса (`CurtainOverlay`)

Компонент: `frontend/src/components/game/CurtainOverlay.tsx`

**Триггер:** Сценарий B (пользователь победил Нику).

### Последовательность

1. Фон экрана затемняется: `rgba(0,0,0,0.7)` transition 400ms.
2. SVG-занавес начинает опускаться сверху (`translateY(-100%) → translateY(0)`)
   с `transition: transform 800ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`.
3. Занавес полностью закрывает экран.
4. После 300ms задержки — появляется текст на занавесе (fade in 400ms):
   ```
   БРАВО!
   Ты победил(а) Нику
   за [N] ходов.
   ДЖЕКПОТ!
   ```
5. Под текстом появляется (fade in 600ms):
   - Строка: «Время: [MM:SS]»
   - Кнопка «Поднять занавес» (или: «Тапни, чтобы открыть»)
6. Тап по экрану / кнопка → занавес уезжает вверх (`translateY(-100%)`) 700ms.
7. После ухода занавеса → таблица лидеров.

### SVG Занавес

```tsx
// Занавес — тёмно-бордовый с золотыми кистями по бокам
// Файл: src/assets/curtain.svg
// Размер: viewBox="0 0 375 812" (mobile first, масштабируется)
// Элементы: задник (цвет #5C0A14), складки (полутоны #7A1020), 
//           кисти слева и справа (rect + ellipse золотой)
```

**Требования к SVG:**
- Вес файла ≤ 8kb (оптимизировать через svgo).
- Нет растровых изображений внутри SVG.
- Кисти (tassel): 5–7 вертикальных нитей с эллипсом внизу, цвет `#D4AF37`.
- Складки занавеса: 3–4 вертикальных сегмента разной светлоты.

**CSS-классы:**
```css
.curtain-enter { transform: translateY(-100%); }
.curtain-active { transform: translateY(0); transition: transform 800ms cubic-bezier(0.25,0.46,0.45,0.94); }
.curtain-exit  { transform: translateY(-100%); transition: transform 700ms ease-in; }
```

**Текст на занавесе:**
- Шрифт: sans-serif, bold.
- «БРАВО!» / «ДЖЕКПОТ!»: 36px, цвет `#D4AF37` (золотой).
- Средний текст: 20px, цвет `#FFF5E0`.
- Тень текста: `0 2px 8px rgba(0,0,0,0.8)`.

**Мобильная оптимизация:**
- Занавес — position fixed, z-index 9000, width 100vw, height 100vh.
- Не нарушает scroll основной страницы (overflow: hidden на body при активном занавесе).
- 60fps на iPhone 12: только transform и opacity, никаких layout-изменений.

---

## 6.4 Конфетти (`ConfettiLayer`)

Компонент: `frontend/src/components/game/ConfettiLayer.tsx`

```tsx
import confetti from 'canvas-confetti';

export function ConfettiLayer({ trigger }: { trigger: boolean }) {
  useEffect(() => {
    if (!trigger) return;
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#8B5CF6', '#F59E0B', '#FFFFFF'],
    });
  }, [trigger]);
  return null;
}
```

- Запускается однократно при `trigger=true`.
- Длительность: встроенная (~5 сек).
- Библиотека `canvas-confetti` версии `^1.9`.

---

## 6.5 Компонент вариантов ответа (`AnswerOptions`)

```tsx
interface Props {
  choices: string[];          // ровно 3
  onChoice: (idx: number) => void;
  disabled: boolean;          // true пока идёт запрос
  selectedIdx: number | null; // подсветка выбранного
}
```

**Визуальные состояния:**

| Состояние | Стиль |
|-----------|-------|
| Default | `bg-surface-100 border border-surface-300 rounded-xl py-3 px-4` |
| Hover | `bg-surface-200 cursor-pointer` |
| Selected | `bg-primary-100 border-primary-500 border-2` |
| Disabled | `opacity-50 pointer-events-none` |

- Все три кнопки — вертикальный стек, full width.
- Минимальная высота кнопки: 52px.
- Текст: 16px, left-aligned, не переносить на одну строку (max-height с overflow ellipsis).

---

## 6.6 Прогресс хода (`GameProgress`)

```tsx
// Тонкая линия (h-1) под шапкой
// Заполнение: (move_count / max_moves) * 100%
// Transition: width 300ms ease
// Цвет: primary-500 → warm-400 на последних 3 ходах (если move_count >= 10)
```

---

## 6.7 Эффект печати (Typewriter)

Хук `useTypewriter(text: string, speed = 30)`:
```tsx
function useTypewriter(text: string, speed = 30) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  
  useEffect(() => {
    setDisplayed('');
    setDone(false);
    let i = 0;
    const timer = setInterval(() => {
      setDisplayed(text.slice(0, i + 1));
      i++;
      if (i >= text.length) { clearInterval(timer); setDone(true); }
    }, 1000 / speed);
    return () => clearInterval(timer);
  }, [text, speed]);
  
  return { displayed, done };
}
```

- Скорость: 30 символов/сек (константа, не настраивается пользователем).
- Варианты ответа рендерятся только когда `done === true`.
- Нет видимого курсора (либо `|` мигает `opacity: 0/1` с частотой 0.5s, цвет `primary-400`).

---

## 6.8 Адаптивность и доступность

- Все интерактивные элементы: `min-touch-target: 44×44px`.
- `aria-label` на кнопках вариантов ответа: «Вариант [A/B/C]: [текст]».
- `ThinkingSpinner`: `role="status" aria-live="polite" aria-label="Ника думает"`.
- `CurtainOverlay`: `role="dialog" aria-modal="true"`.
- Занавес блокирует фокус (focus trap) пока открыт.
- Все анимации отключаются при `prefers-reduced-motion: reduce`.
