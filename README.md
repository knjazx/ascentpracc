# Ascent Pracc — CS2 Scrims & Tournament Matchmaking Platform

Полнофункциональная киберспортивная платформа для организации, поиска и проведения тренировочных матчей (праков / скримов) по Counter-Strike 2.

Проект разработан с чистой модульной архитектурой на TypeScript без заглушек и `TODO`.

---

## 🛠 Стек технологий

- **Frontend & Fullstack:** [Next.js 14+](https://nextjs.org/) (App Router), React 18, TypeScript (strict mode)
- **Стилизация:** [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) (тёмная киберспортивная тема по умолчанию с акцентами янтарного/оранжевого CS2 стиля)
- **База данных:** [PostgreSQL](https://www.postgresql.org/) + [Prisma ORM](https://www.prisma.io/)
- **Real-Time коммуникация:** [Socket.IO](https://socket.io/) (интегрирован в кастомный HTTP сервер `server.ts` поверх Next.js)
- **Очереди и фоновые задачи:** [Redis](https://redis.io/) + [BullMQ](https://docs.bullmq.io/) (отдельный процесс воркера)
- **Аутентификация:** Ручная реализация Steam OpenID 2.0 (без passport.js, прямая сверка подписи через Steam API), сессионный JWT `HS256` через библиотеку `jose` в `httpOnly`, `secure`, `sameSite=lax` cookie
- **Валидация:** [Zod](https://zod.dev/) для всех входящих HTTP-запросов и WS-событий
- **Работа со временем:** `date-fns` и `date-fns-tz` (все даты сохраняются в БД в UTC, отображение в локальной IANA таймзоне пользователя)
- **Контейнеризация:** Docker Compose (сервисы `app`, `worker`, `postgres`, `redis`)
- **Язык интерфейса:** Русский

---

## 📐 Архитектура и возможности

### 1. Концепция команд и ролей
- **Команда** представлена карточкой: название, тег, логотип, описание, Discord-ссылка.
- **Менеджеры:** Создатель команды является её владельцем и может назначать со-управляющих по Steam ID / нику (дает права на создание заявок, участие в лобби и ввод счёта). Ростер игроков не ограничивается сайтом.
- **Роли:**
  - `Guest`: просмотр открытых праков, публичных профилей команд, лидерборда и истории матчей.
  - `User`: авторизованный через Steam игрок.
  - `Manager`: управляющий команды (создание заявок, отклики, участие в вето, ввод счёта).
  - `Admin`: рассмотрение судейских споров (диспутов), бан нарушителей, управление пулом карт.

### 2. Заявки и отклики на праки
- Создание заявки: выбор формата (`BO1`, `BO2`, `BO3`), слотов времени, исключенных карт, уровня игры и стороны, предоставляющей сервер (`HOST`, `GUEST`, `NEGOTIABLE`).
- Срок жизни открытой заявки (по умолчанию 7 дней), автоматический перевод в `EXPIRED` через BullMQ.
- Принятие отклика защищено от состояний гонки (race conditions) на уровне транзакции БД с условием `status = OPEN` -> `MATCHED`. Лишние отклики автоматически отклоняются (`DECLINED`), создается запись `Match`.

### 3. Лобби матча (Real-time Socket.IO)
- **Авторизация WebSocket:** проверка JWT cookie при подключении.
- **Чат лобби:** история из БД, антиспам, системные сообщения о событиях матча.
- **Интерактивное CS2 Вето:**
  - Серверный генератор шагов вето для `BO1`, `BO2`, `BO3`.
  - Монетка (Coin Flip) на `crypto.randomInt`.
  - Таймер хода 60 секунд. При неактивности воркер BullMQ производит авто-бан случайной карты.
  - Анимированная доска карт с карточками, статусами и выбором сторон (`CT` / `T`).
- **Серверные данные:** IP, порт, пароль, кнопка быстрого запуска `steam://connect/...`.
- **Перенос и отмена:** запрос на взаимный перенос времени матча или отмену с подтверждением оппонента.
- **Синхронизация календаря:** экспорт `.ics` (iCalendar) для Google Календаря, Apple Calendar и Outlook.
- **Экстренная неявка:** кнопка фиксации неявки соперника (No-Show), доступная через 15 минут после времени старта.

### 4. Ввод счёта и валидация по правилам CS2
- Поддержка официальных правил соревновательного CS2:
  - **MR12:** победа при 13 раундах (`13:X`, где $X \le 11$).
  - **Overtime MR3:** овертаймы до разницы в 2 раунда (`16:14`, `19:17`, `22:20`...).
  - Ничьи (`12:12`, `15:15`) допустимы только в формате `BO2`.
- Обе стороны вводят результаты. При совпадении серия переходит в `CONFIRMED`, обновляется рейтинг и статистика команд.
- При расхождении статус матча переходит в `DISPUTED` для рассмотрения судьями в админке.
- Таймаут 24 часа: если вторая сторона не подтвердила счёт, результат подтверждается автоматически воркером.

### 5. Фоновый воркер (BullMQ + Redis)
- Отдельный устойчивый процесс (`src/worker/index.ts`).
- Cron-задачи:
  - Каждую минуту: проверка и закрытие просроченных открытых заявок (`check-expirations`).
  - Каждые 10 минут: автоподтверждение результатов матчей, ожидающих ответа >24 ч (`check-overdue-scores`).
- Отложенные задачи:
  - 60-секундный таймаут хода вето с автовыбором карты.
  - Напоминания о предстоящих матчах за 24 ч, 1 ч и 15 минут.
  - Отправка Rich Embed оповещений в Discord через Webhook (`src/lib/discord.ts`).

### 6. Админ-панель (`/admin`)
- Защищена middleware (`Role.ADMIN`).
- **Диспуты (`/admin/disputes`):** сравнение введённых обеими сторонами счетов, судейский ввод финального счёта или аннулирование матча.
- **Жалобы (`/admin/reports`):** управление жалобами на неявки (No-Show) и нарушения правил.
- **Пользователи (`/admin/users`):** поиск по Steam ID / нику, блокировка и разблокировка аккаунтов.
- **Пул карт (`/admin/maps`):** включение/выключение карт для драфта вето.

---

## 🚀 Быстрый старт

### Требования
- Node.js 18+ (рекомендуется v20+)
- PostgreSQL 14+
- Redis 6+
- Steam Web API Key ([получить ключ](https://steamcommunity.com/dev/apikey))

### 1. Клонирование и установка зависимостей
```bash
git clone <repository_url> cs2-scrims
cd cs2-scrims
npm install
```

### 2. Настройка переменных окружения
Создайте файл `.env` на основе `.env.example`:
```env
# Steam Web API Key
STEAM_API_KEY=your_steam_api_key_here

# PostgreSQL
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cs2_scrims?schema=public

# Redis (BullMQ)
REDIS_URL=redis://localhost:6379

# JWT Secret (минимум 32 символа)
JWT_SECRET=super_secret_jwt_key_cs2_scrim_league_at_least_32_chars_long

# Base URL приложения
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Discord Webhook (опционально)
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...

# Steam 64-bit ID администраторов через запятую (получают роль ADMIN при входе/сидировании)
ADMIN_STEAM_IDS=76561198000000001,76561198000000002

# Директория загрузок
UPLOAD_DIR=./uploads

PORT=3000
```

### 3. Миграции и заполнение базы данных
```bash
# Применение схемы Prisma
npx prisma db push

# Сидирование пула карт CS2 и прав администраторов
npm run prisma:seed
```

### 4. Запуск в режиме разработки
```bash
# Запуск веб-сервера и сокетов (Next.js + Socket.IO)
npm run dev

# В отдельном терминале: запуск фонового воркера задач
npm run worker
```
Приложение откроется по адресу `http://localhost:3000`.

---

## 🐳 Запуск через Docker Compose

Для продакшен-развертывания полного стека (`app`, `worker`, `postgres`, `redis`) выполните одну команду:

```bash
docker-compose up -d --build
```

Проверка состояния контейнеров:
```bash
docker-compose ps
```

Просмотр логов:
```bash
docker-compose logs -f app
docker-compose logs -f worker
```

---

## 🔒 Конфигурация Nginx для Production (с поддержкой WebSockets)

При развертывании за Nginx необходимо корректно проксировать HTTP-запросы и обновлять соединение до WebSockets для `/socket.io`:

```nginx
upstream cs2_backend {
    server 127.0.0.1:3000;
    keepalive 64;
}

server {
    listen 80;
    server_name scrims.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name scrims.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/scrims.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/scrims.yourdomain.com/privkey.pem;

    client_max_body_size 10M;

    # Основное приложение Next.js
    location / {
        proxy_pass http://cs2_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Socket.IO WebSocket эндпоинт
    location /socket.io/ {
        proxy_pass http://cs2_backend/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

---

## 💾 Резервное копирование PostgreSQL

Для автоматического ежедневного бэкапа базы данных используйте скрипт `scripts/backup.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/cs2_scrims"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="$BACKUP_DIR/backup_$TIMESTAMP.sql.gz"

mkdir -p $BACKUP_DIR

docker exec -t cs2_scrims_postgres pg_dump -U postgres cs2_scrims | gzip > $FILENAME

# Удалять бэкапы старше 14 дней
find $BACKUP_DIR -type f -name "*.sql.gz" -mtime +14 -delete

echo "Backup completed: $FILENAME"
```

Добавление в `crontab -e`:
```cron
0 4 * * * /bin/bash /path/to/backup.sh > /var/log/cs2_backup.log 2>&1
```

---

## 📂 Структура проекта

```
cs2-scrims/
├── prisma/
│   ├── schema.prisma       # Prisma схема со всеми связями, индексами и enum
│   └── seed.ts             # Сидирование соревновательного пула карт CS2 и админов
├── src/
│   ├── app/
│   │   ├── (auth)/         # /login, /onboarding, /banned
│   │   ├── admin/          # Панель судьи: /admin, /admin/disputes, /reports, /users, /maps
│   │   ├── api/            # REST API (auth, teams, scrims, matches, leaderboard, notifications, uploads, admin)
│   │   ├── leaderboard/    # /leaderboard: таблица лидеров и винрейтов лиги
│   │   ├── lobby/          # /lobby/[matchId]: real-time лобби с вето, чатом и вводом счёта
│   │   ├── matches/        # /matches и /matches/[id]: история и публичный счёт матчей
│   │   ├── notifications/  # /notifications: центр уведомлений
│   │   ├── scrims/         # /scrims/new, /scrims/[id]: создание и детали праков
│   │   ├── settings/       # /settings: таймзона и Discord тег
│   │   └── teams/          # /teams, /teams/new, /teams/[id], /teams/[id]/edit
│   ├── components/         # Модульные React-компоненты (Lobby, Veto, Scrims, Layout, Header, UI)
│   ├── hooks/              # useUser, useSocket
│   ├── lib/
│   │   ├── auth.ts         # Аутентификация и сессия
│   │   ├── date.ts         # date-fns и date-fns-tz утилиты
│   │   ├── discord.ts      # Discord Webhook оповещения
│   │   ├── jwt.ts          # jose JWT генерация и валидация
│   │   ├── prisma.ts       # Prisma Client singleton
│   │   ├── storage.ts      # Абстракция хранилища файлов (/uploads и S3)
│   │   ├── stats.ts        # Пересчёт винрейта, формы и H2H статистики
│   │   ├── socket/         # Socket.IO серверные обработчики (матч, чат, вето)
│   │   └── veto/           # State Machine процесса вето карт (BO1, BO2, BO3)
│   └── worker/             # BullMQ Redis воркер фоновых задач
├── server.ts               # Custom Node HTTP + Next.js + Socket.IO entrypoint
├── docker-compose.yml      # Docker Compose конфигурация
├── Dockerfile              # Мультистейдж Dockerfile приложения
└── Dockerfile.worker       # Dockerfile фонового процесса BullMQ воркера
```

---

## 📜 Лицензия
Проект распространяется под лицензией MIT.
