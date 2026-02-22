# Programmers BattleGround — Проект модернизации

## Общее описание проекта

**Programmers BattleGround** (бывший PUBG — Programmer Unknown's BattleGround) — визуальная арена, где алгоритмы (боты) управляют существами и сражаются в реальном времени. Каждый тик движка вызывает функцию `thinkAboutIt()` у каждого бота, передаёт состояние мира, бот возвращает действие. Физику обеспечивает Matter.js.

**Оригинальный репозиторий:** https://github.com/AppCraft-LLC/pubg.git
**Лицензия:** MIT
**Год создания:** 2018
**Текущее состояние:** Vanilla JS, без сборки, без модульности, работает через открытие index.html в браузере.

### Цели модернизации

1. **Публичный проект AppCraft** — страница на appcraft.pro/projects/battleground/ с описанием + живая арена
2. **Образовательный open-source** — школьники, студенты, разработчики могут учиться писать AI-ботов
3. **Внутренний инструмент** — команда AppCraft может писать и соревноваться ботами
4. **Современный стек** — TypeScript, Vite, модульная архитектура

---

## Оригинальная архитектура (текущее состояние)

### Структура файлов

```
pubg/
├── battleground.js          # ~1587 строк — основной движок (физика, рендер, игровой цикл)
├── config.js                # 112 строк — конфигурация правил игры
├── index.html               # Точка входа + UI лидерборда
├── README.md                # Документация проекта
├── LICENSE.md               # MIT лицензия
├── release.notes            # История версий (v1.1 – v1.6)
├── brains/                  # 15 ботов-алгоритмов
│   ├── br_edmund.js         # Шаблон-пример (bear, телекинез)
│   ├── br_bulletbull.js     # Оборонительный спиннер (bull, неуязвимость)
│   ├── br_dexter.js         # Мститель (splitpus)
│   ├── br_enigma.js         # Инфобот с API (miner, резиновые пули)
│   ├── br_reptile.js        # Уклонист (runchip, ядовитые пули)
│   ├── br_rathorn.js        # Hit & run (rhino, магнит)
│   ├── br_mindblast.js      # IQ-охотник (splitpus)
│   ├── br_pacifist.js       # Пацифист (moose, невидимость)
│   ├── br_hodor.js          # Бот
│   ├── br_derzkyi.js        # Бот
│   ├── br_helltrain.js      # Бот
│   ├── br_niloultet.js      # Бот
│   ├── br_prosucc.js        # Бот
│   ├── br_utilizator.js     # Бот
│   └── br_yssysin.js        # Бот
├── extra/
│   ├── matter.js            # Физический движок Matter.js (встроен)
│   └── style.css            # Стили UI
└── img/                     # Игровые ассеты
    ├── creatures/           # 72 спрайта (8 видов × 3 уровня × 3 состояния здоровья)
    ├── effects/             # 4 эффекта ауры (blue, green, red, yellow)
    ├── ground/              # Текстура земли
    └── obstacles/           # 100+ спрайтов препятствий
```

### Игровой движок (battleground.js)

Основной цикл каждый тик:
1. Обновление энергии/статуса существ
2. Вызов `thinkAboutIt()` каждого мозга
3. Выполнение возвращённых действий (move, shoot, eat, spell и т.д.)
4. Детекция столкновений (существо-пуля, препятствие-пуля, существо-звезда)
5. Рендер графики и обновление лидерборда

### Физика (Matter.js)

- 2D физика без гравитации (gravity = 0)
- Круглые тела существ (radius 30px)
- Прямоугольные/круглые препятствия
- Пули как высокоскоростные снаряды (force 15.5)
- Коллизии: creature=2, bullet=3, obstacle=4, star=5
- Стены арены из невидимых тел

### Хранение данных

- IQ хранится в `localStorage` браузера
- Нет серверного хранения, нет общего лидерборда
- При очистке localStorage все данные теряются

---

## API ботов (Brain Interface) — СОХРАНИТЬ ПРИ МОДЕРНИЗАЦИИ

### Структура бота

```typescript
interface Brain {
  name: string;        // Макс. 10 символов
  kind: Kind;          // Тип существа (0-7)
  author: string;      // Макс. 10 символов
  description: string; // Описание стратегии

  thinkAboutIt(
    self: Creature,
    enemies: Creature[],
    bullets: Bullet[],
    objects: GameObject[],
    events: GameEvent[]
  ): Action;
}
```

### Входные данные

**self — состояние своего существа:**
```typescript
interface Creature {
  id: number;
  kills: number;
  deaths: number;
  iq: number;
  name: string;
  author: string;
  lives: number;         // Текущее здоровье
  bullets: number;       // Количество патронов
  energy: number;        // Энергия для действий
  level: number;         // Уровень (0-2)
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  angle: number;         // Направление (радианы)
  speed: number;
  angularVelocity: number;
  poisoned: boolean;
  spelling: boolean;
  message: string;
}
```

**enemies — массив врагов** (та же структура, что и self)

**bullets — пули на карте:**
```typescript
interface Bullet {
  id: number;
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  speed: number;
  dangerous: boolean;    // true если speed >= 5 (наносит урон)
}
```

**objects — препятствия и звёзды:**
```typescript
interface GameObject {
  id: number;
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  speed: number;
  bounds: { min: { x: number; y: number }; max: { x: number; y: number } };
  condition: number;     // Здоровье объекта
  type: ObjectType;      // obstacle=0, dynamite=1, star=2
  shape: number;         // Подтип
}
```

**events — игровые события текущего тика:**
```typescript
interface GameEvent {
  type: EventType;       // wound=0, murder=1, death=2, upgrade=3, birth=4, spell=5
  payload: Creature[];   // Участники события
}
```

### Выходные данные (действие)

```typescript
interface Action {
  do: ActionType;
  params?: {
    angle?: number;       // Направление (радианы)
    clockwise?: boolean;  // Для rotate
    target?: any;         // Для spell
    message?: string;     // Сообщение (макс. 40 символов, 2 строки)
  };
}
```

### Доступные действия

| Действие | Параметры | Стоимость энергии | Эффект |
|----------|-----------|-------------------|--------|
| `none` (0) | `message?` | 0 | Ничего не делать |
| `move` (1) | `angle` | 1.0 | Движение в направлении |
| `rotate` (2) | `clockwise` | 0 | Вращение на месте |
| `turn` (3) | `angle` | 0 | Повернуться к направлению |
| `shoot` (4) | `message?` | 10 | Стрелять в направлении взгляда |
| `jump` (5) | `angle` | 30 | Прыжок в направлении |
| `eat` (6) | `message?` | 60 | Съесть пулю (+40 HP) |
| `spell` (7) | `target?, angle?` | 100 | Спецспособность вида |

### Вспомогательные функции

```typescript
distanceBetween(obj1, obj2): number        // Расстояние в пикселях
distanceBetweenPoints(pt1, pt2): number    // Расстояние между точками
angleBetween(obj1, obj2): number           // Угол в радианах
angleBetweenPoints(pt1, pt2): number       // Угол между точками
normalizeAngle(angle): number              // Нормализация угла 0-2π
differenceBetweenAngles(a1, a2): number    // Кратчайшая разница углов
randomInt(min, max): number                // Случайное целое
randomAngle(): number                      // Случайный угол 0-2π
rayBetween(obj1, obj2): boolean            // Проверка видимости (true = видят друг друга)
```

### Глобальные константы

```typescript
// Типы существ
enum Kind { rhino=0, bear=1, moose=2, bull=3, runchip=4, miner=5, sprayer=6, splitpus=7 }

// Спецспособности по типу:
// rhino: магнит (притягивает пули)
// bear: телекинез (двигает объекты/существ)
// moose: невидимость
// bull: неуязвимость
// runchip: ядовитые пули
// miner: резиновые пули (отскакивают)
// sprayer: вампир (высасывает здоровье) ИЛИ заморозка
// splitpus: без способности

// Арена
ground = { width: 1024, height: 768 }

// Ресурсы по уровням
creatureMaxLives = [100, 150, 250]
creatureMaxEnergy = [100, 150, 250]
creatureMaxBullets = [3, 4, 5]

// Стоимости
moveEnergyCost = 1.0
shotEnergyCost = 10
jumpEnergyCost = 30
eatBulletEnergyCost = 60
energyRefillPerTick = 0.8
```

### Правила IQ

- Начальный IQ: 10
- Убил врага с IQ ≤ своего (разница ≤10): +1 IQ
- Убил врага с IQ > своего (разница >10): +⅓ разницы
- Был убит: -1 IQ (или -⅕ разницы если убийца слабее на >10)
- Самоубийство: -3 IQ

### Прогрессия уровней

- Уровень 0 → 1: 2 убийства
- Уровень 1 → 2: 4 убийства
- Каждый уровень увеличивает HP, энергию и ёмкость пуль

---

## Описание существующих ботов (15 штук)

### 1. Edmund (br_edmund.js) — Bear, Телекинез
**Стратегия:** Сбалансированный обучающий пример. Уклоняется от пуль прыжком, собирает безопасные пули, охотится на ближайшего врага когда вооружён, лечится при здоровье <25%.

### 2. BULLetBULL (br_bulletbull.js) — Bull, Неуязвимость
**Стратегия:** Собирает пули до максимума (использует неуязвимость), идёт в центр карты, крутится как турель и стреляет в любого врага в зоне поражения.

### 3. MoreGun / Dexter (br_dexter.js) — Splitpus
**Стратегия:** Мститель. Целится в существо с максимальным числом убийств. Имеет внутреннюю нарративную историю, отображаемую как сообщения.

### 4. Enigma (br_enigma.js) — Miner, Резиновые пули
**Стратегия:** Инфобот. Делает HTTP-запросы к внешним API (Bitcoin, погода), отображает данные как сообщения. Базовый комбат: охотится на слабых врагов.

### 5. Reptile (br_reptile.js) — Runchip, Ядовитые пули
**Стратегия:** Хитрый уклонист со сложным стейт-машиной. Переключает «тихий режим» каждые 60 секунд, отслеживает пули, проверяет линию видимости.

### 6. RatHorn (br_rathorn.js) — Rhino, Магнит
**Стратегия:** Hit & run. Находит слабейшего врага, стреляет и убегает на 15 тиков. Использует углы арены как безопасные зоны.

### 7. Mindblast (br_mindblast.js) — Splitpus
**Стратегия:** IQ-охотник. Целится во врага с максимальным IQ. Режим «тройного выстрела» при полном боезапасе.

### 8. Pacifist (br_pacifist.js) — Moose, Невидимость
**Стратегия:** Никогда не стреляет. Только собирает и ест пули для лечения. Становится невидимым при пустом боезапасе.

### 9-15. Hodor, Derzkyi, Helltrain, Niloultet, Prosucc, Utilizator, Yssysin
Дополнительные боты с различными стратегиями.

---

## Конфигурация игры (config.js)

```javascript
// Боты
cfg_sources = ["br_edmund.js", "br_bulletbull.js", ...]  // Список файлов
shuffleBrains = true                                       // Перемешать порядок

// Прогрессия
creatureMaxLives = [100.0, 150.0, 250.0]
creatureMaxEnergy = [100.0, 150.0, 250.0]
creatureMaxBullets = [3, 4, 5]
killsToLevelUp = [2, 4]

// Арена
maxAliveCreatures = 4          // Одновременно на поле (3-8)
obstaclesDensity = 100         // 1 объект на N килопикселей

// Боевые параметры
bulletDamage = 10
livesPerEatenBullet = 40
moveEnergyCost = 1.0
shotEnergyCost = 10
jumpEnergyCost = 30
eatBulletEnergyCost = 60
energyRefillPerTick = 0.8

// Генерация
bulletsGeneratorFrequencyPerCreature = 5
dynamitesProbability = 0.15
starsProbability = 0.3

// Спеллы
invisibleDuration = 80 тиков
invulnerableDuration = 80 тиков
magnetDuration = 5 тиков
poisonerDuration = 80 тиков
// ... и другие
```

---

## ПЛАН МОДЕРНИЗАЦИИ

### Название проекта: Programmers BattleGround

### Фаза 1: Переход на современный стек

**Задача:** Перевести весь проект с Vanilla JS на TypeScript + Vite, сохранив полную обратную совместимость API ботов и все игровые правила без изменений.

#### 1.1. Инициализация проекта
- `npm init` с правильным package.json
- Установить Vite как сборщик (мгновенный dev-сервер, HMR)
- Установить TypeScript
- Установить Matter.js как npm-зависимость (вместо встроенного файла)
- Настроить tsconfig.json

#### 1.2. Типизация API
- Создать `src/types/` с полными интерфейсами:
  - `Brain`, `Creature`, `Bullet`, `GameObject`, `GameEvent`, `Action`
  - Все enum: `Kind`, `ActionType`, `EventType`, `ObjectType`, `StarShape`, `Shell`
- Эти типы — основа проекта, они должны быть стабильными

#### 1.3. Рефакторинг движка
- Разбить `battleground.js` (~1587 строк) на модули:
  - `src/engine/Engine.ts` — основной игровой цикл
  - `src/engine/Physics.ts` — обёртка над Matter.js
  - `src/engine/Combat.ts` — логика боя, урона, убийств
  - `src/engine/Spawner.ts` — генерация пуль, препятствий, звёзд
  - `src/engine/IQSystem.ts` — расчёт IQ
  - `src/engine/CreatureManager.ts` — управление существами
- Движок должен работать **без рендера** (для headless-режима)

#### 1.4. Рефакторинг рендера
- `src/renderer/Renderer.ts` — визуализация на Canvas
- `src/renderer/Leaderboard.ts` — отрисовка таблицы лидеров
- `src/renderer/UI.ts` — кнопки управления
- Рендер отделён от движка (паттерн: движок генерирует состояние, рендер его отображает)

#### 1.5. Перевод ботов на TypeScript
- Перенести все 15 ботов в `src/brains/`
- Каждый бот — отдельный .ts файл, экспортирует объект Brain
- Сохранить всю оригинальную логику каждого бота
- Убрать глобальные переменные — использовать import/export
- Вспомогательные функции (distanceBetween и др.) → `src/utils/geometry.ts`

#### 1.6. Конфигурация
- `src/config.ts` — типизированный конфиг
- Возможность передавать конфиг при создании Engine

#### 1.7. Точки входа
- `src/main.ts` — браузерный режим (с рендером)
- `src/headless.ts` — серверный режим (без рендера, Node.js)

#### 1.8. Ассеты
- Все спрайты из `img/` → `public/img/` (Vite копирует в билд)
- CSS → нормальный импорт через Vite

### Фаза 2: Headless-режим и серверный лидерборд

**Задача:** Движок может работать в Node.js без браузера. Результаты (IQ) сохраняются в файл/API.

#### 2.1. Headless Engine
- Matter.js работает в Node.js (поддерживает headless)
- `src/headless.ts` запускает игру без Canvas, без рендера
- Прогоняет N тиков (например, 1 час реального времени)
- Записывает итоговый IQ-рейтинг в JSON-файл

#### 2.2. Серверный лидерборд
- Результаты headless-прогонов сохраняются в `data/leaderboard.json`
- Формат:
  ```json
  {
    "lastUpdated": "2026-02-23T03:00:00Z",
    "standings": [
      { "name": "Reptile", "author": "...", "iq": 42, "kills": 156, "deaths": 89 },
      ...
    ]
  }
  ```
- Этот файл доступен публично как статика

#### 2.3. Docker-контейнер для ночных прогонов
- `Dockerfile` — Node.js образ, запускает headless.ts
- `docker-compose.yml` — конфигурация запуска
- Cron или systemd timer: каждую ночь (например, 02:00-03:00) запускает контейнер
- Контейнер: прогоняет игру 1 час → записывает leaderboard.json → завершается
- leaderboard.json монтируется как volume и доступен веб-серверу

### Фаза 3: Публичная страница (браузерная демо)

**Задача:** Пользователь открывает страницу, видит лидерборд из серверных прогонов и живую демонстрацию боя в браузере.

#### 3.1. Браузерный режим
- При открытии страницы:
  1. Загружается `leaderboard.json` (серверные результаты)
  2. Отображается таблица лидеров с актуальным IQ
  3. Запускается локальная симуляция с рандомным набором ботов (например, 4-6 из 15)
  4. Локальные результаты НЕ отправляются на сервер — это чисто демонстрация
- Лидерборд имеет два раздела:
  - **Общий рейтинг** (из leaderboard.json) — серверные данные
  - **Текущий бой** — локальная демо-статистика

#### 3.2. UI
- Современный дизайн, тёмная тема
- Canvas с игрой — основная часть экрана
- Лидерборд справа или снизу (адаптивный)
- Кнопки: пауза, скорость (1x, 2x, 4x), перезапуск
- Отображение: «Рейтинг обновлён: [дата последнего прогона]»

### Фаза 4: Интеграция в AppCraft сайт

**Задача:** Добавить страницу проекта и встроить арену на appcraft.pro.

#### 4.1. Страница проекта
- `/projects/battleground/` на appcraft.pro — лендинг с описанием:
  - Что это за проект
  - Как работает (API ботов, правила)
  - Лидерборд (текущий рейтинг)
  - Ссылка на GitHub
  - Кнопка «Смотреть бой» → переход на арену

#### 4.2. Страница арены
- `/projects/battleground/arena/` — живая демонстрация
- Полноэкранная арена с ботами и лидербордом
- Или: встроена как iframe/компонент на странице проекта

#### 4.3. Деплой
- Vite build → статика в `dist/`
- Nginx отдаёт `dist/` по пути `/projects/battleground/arena/`
- leaderboard.json обновляется ночными прогонами

---

## Целевая структура проекта (после модернизации)

```
pubg/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── Dockerfile
├── docker-compose.yml
├── CLAUDE.md                          # Этот файл
├── README.md                          # Обновлённая документация
│
├── src/
│   ├── main.ts                        # Браузерная точка входа
│   ├── headless.ts                    # Node.js headless точка входа
│   ├── config.ts                      # Типизированная конфигурация
│   │
│   ├── types/
│   │   ├── brain.ts                   # Brain, Action интерфейсы
│   │   ├── creature.ts                # Creature интерфейс
│   │   ├── bullet.ts                  # Bullet интерфейс
│   │   ├── game-object.ts             # GameObject интерфейс
│   │   ├── event.ts                   # GameEvent интерфейс
│   │   └── enums.ts                   # Kind, ActionType, EventType и т.д.
│   │
│   ├── engine/
│   │   ├── Engine.ts                  # Главный класс — игровой цикл
│   │   ├── Physics.ts                 # Обёртка Matter.js
│   │   ├── Combat.ts                  # Логика боя, урона
│   │   ├── Spawner.ts                 # Генерация пуль, препятствий, звёзд
│   │   ├── IQSystem.ts                # Расчёт IQ-рейтинга
│   │   └── CreatureManager.ts         # Спавн, смерть, прогрессия существ
│   │
│   ├── renderer/
│   │   ├── Renderer.ts                # Canvas рендер (Matter.js Render)
│   │   ├── Leaderboard.ts             # UI таблицы лидеров
│   │   └── UI.ts                      # Кнопки, управление
│   │
│   ├── brains/
│   │   ├── index.ts                   # Реестр всех ботов
│   │   ├── edmund.ts                  # Bear — обучающий пример
│   │   ├── bulletbull.ts              # Bull — турель
│   │   ├── dexter.ts                  # Splitpus — мститель
│   │   ├── enigma.ts                  # Miner — инфобот
│   │   ├── reptile.ts                 # Runchip — уклонист
│   │   ├── rathorn.ts                 # Rhino — hit & run
│   │   ├── mindblast.ts              # Splitpus — IQ-охотник
│   │   ├── pacifist.ts               # Moose — пацифист
│   │   ├── hodor.ts
│   │   ├── derzkyi.ts
│   │   ├── helltrain.ts
│   │   ├── niloultet.ts
│   │   ├── prosucc.ts
│   │   ├── utilizator.ts
│   │   └── yssysin.ts
│   │
│   └── utils/
│       ├── geometry.ts                # distanceBetween, angleBetween и др.
│       └── helpers.ts                 # randomInt, randomAngle и др.
│
├── public/
│   └── img/                           # Все спрайты (из оригинала)
│       ├── creatures/
│       ├── effects/
│       ├── ground/
│       └── obstacles/
│
├── data/
│   └── leaderboard.json               # Результаты серверных прогонов
│
├── original/                           # Архив оригинального кода (для справки)
│   ├── battleground.js
│   ├── config.js
│   ├── index.html
│   └── brains/
│
└── index.html                         # Vite HTML-точка входа
```

---

## Порядок выполнения работ

### Шаг 1: Инициализация проекта
1. Создать `package.json` с зависимостями (vite, typescript, matter-js)
2. Создать `tsconfig.json`
3. Создать `vite.config.ts`
4. Перенести оригинальные файлы в `original/` для справки
5. Перенести спрайты в `public/img/`
6. Убедиться что `npm install && npm run dev` запускается

### Шаг 2: Типы
1. Создать все файлы в `src/types/`
2. Описать все интерфейсы и enum из оригинального кода
3. Это фундамент — должно быть точным

### Шаг 3: Утилиты
1. Перенести helper-функции в `src/utils/geometry.ts` и `helpers.ts`
2. Типизировать их

### Шаг 4: Движок
1. Пошагово разбить `battleground.js` на модули в `src/engine/`
2. Начать с Physics.ts (обёртка Matter.js)
3. Затем Engine.ts (основной цикл)
4. Затем остальные модули
5. **ВАЖНО:** Сохранить точную логику оригинала — не менять правила игры

### Шаг 5: Боты
1. Перевести каждого бота на TypeScript
2. Сохранить оригинальную стратегию каждого
3. Убрать глобальные переменные, использовать импорты
4. Создать реестр `src/brains/index.ts`

### Шаг 6: Рендер
1. Перенести логику рендера в `src/renderer/`
2. Адаптировать под модульную архитектуру
3. Отделить от движка

### Шаг 7: Браузерная точка входа
1. `src/main.ts` — импортирует движок + рендер + ботов
2. `index.html` — минимальный HTML с контейнером
3. Должно работать: `npm run dev` → открыть в браузере → бой идёт

### Шаг 8: Headless-режим
1. `src/headless.ts` — Node.js скрипт
2. Запускает Engine без Renderer
3. Прогоняет N тиков
4. Сохраняет leaderboard.json
5. `npm run headless` — работает

### Шаг 9: Лидерборд
1. В браузерном режиме загружать `data/leaderboard.json`
2. Отображать общий рейтинг из серверных прогонов
3. Отдельно — текущий локальный бой

### Шаг 10: Docker
1. Dockerfile для headless-прогонов
2. docker-compose.yml
3. Инструкция по настройке cron для ночных запусков

---

## Сервер и инфраструктура

### Сервер
- IP: 89.169.185.172
- SSH Key: `/var/www/html/appcraft_site_development/keys/deploy_key`
- User: master
- OS: Ubuntu 24.04 LTS

### Деплой
- Проект собирается через `npm run build` → `dist/`
- Nginx отдаёт `dist/` по нужному пути
- leaderboard.json обновляется ночным cron-запуском Docker-контейнера

### Ночной прогон
- Cron: `0 2 * * * docker run --rm -v /path/to/data:/app/data pubg-headless`
- Контейнер прогоняет 1 час игры → записывает leaderboard.json → завершается
- leaderboard.json доступен Nginx как статический файл

---

## Ключевые принципы

1. **Не менять правила игры** — все механики (урон, IQ, спеллы, звёзды) остаются оригинальными
2. **Не менять API ботов** — thinkAboutIt() с теми же входами/выходами, только типизированными
3. **Движок без рендера** — Engine должен работать и в браузере, и в Node.js
4. **Локальная демо, серверный рейтинг** — публичная страница показывает серверный лидерборд + локальную демку
5. **Open-source** — код на GitHub, MIT лицензия, хорошая документация
