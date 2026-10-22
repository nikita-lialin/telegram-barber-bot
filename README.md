# telegram-barber-bot

Telegram-бот-визитка парикмахерской: мастера, услуги и цены, фото работ, график, адрес и быстрая связь для записи.

Стек: TypeScript, Node.js 22, [grammY](https://grammy.dev). Языки: русский и английский.

Документация:

- [Сценарии и критерии приёмки](docs/SCENARIOS.md)
- [Архитектура](docs/ARCHITECTURE.md)

## Токен бота

1. Откройте [@BotFather](https://t.me/BotFather) в Telegram и отправьте `/newbot`.
2. Следуйте подсказкам, в конце BotFather выдаст токен вида `123456:ABC...`.
3. Не публикуйте токен и не коммитьте его в репозиторий.

## Локальный запуск (dev)

```bash
npm ci
cp .env.example .env   # впишите BOT_TOKEN
npm run dev
```

`npm run dev` перезапускает бота при изменении файлов. Бот работает через long polling: домен и HTTPS не нужны. Запускайте только один экземпляр на токен, иначе Telegram вернёт ошибку 409.

Переменные окружения (см. `.env.example`):

| Переменная    | Назначение                                   |
| ------------- | -------------------------------------------- |
| `BOT_TOKEN`   | токен от @BotFather (обязательна)            |
| `NODE_ENV`    | `development` или `production`               |
| `LOG_LEVEL`   | уровень логов, по умолчанию `info`           |
| `SESSION_DIR` | папка с сессиями (язык), по умолчанию `./sessions` |

## Docker

```bash
docker build -t barber-bot .
docker run -d --name barber-bot \
  -e BOT_TOKEN=123456:ABC... \
  -v barber-sessions:/app/sessions \
  barber-bot
```

Том `/app/sessions` хранит выбранный пользователями язык, чтобы он не терялся при обновлении образа. Файл `.env` в образ не попадает, переменные задаются окружением.

Для запуска с файлом: `docker run --rm --env-file .env -v barber-sessions:/app/sessions barber-bot`. Docker не вырезает комментарии после значения (`KEY=value # текст`), поэтому в `.env` комментарии пишите только на отдельных строках. Из `.env` уберите `SESSION_DIR`, чтобы действовало значение из образа.

## Деплой на VPS

Бот работает через Docker Compose (`docker-compose.yml`), домен и HTTPS не нужны.

**На сервере (один раз):**

1. Установите Docker с плагином Compose и Git. Создайте пользователя для деплоя и добавьте его в группу `docker`.
2. Склонируйте репозиторий: `git clone https://github.com/nikita-lialin/telegram-barber-bot.git`. Для приватного репозитория добавьте на сервер read-only deploy key.
3. В папке проекта создайте `.env` по образцу `.env.example` (`BOT_TOKEN=...`, `NODE_ENV=production`; комментарии только на отдельных строках). Файл не коммитится.
4. Первый запуск: `docker compose up -d --build`.
5. Добавьте публичный ключ деплоя в `~/.ssh/authorized_keys` этого пользователя.

**В GitHub (Settings → Secrets and variables → Actions):**

- Secrets: `VPS_HOST` (адрес сервера), `VPS_USER`, `VPS_SSH_KEY` (приватный ключ), `VPS_KNOWN_HOSTS` (вывод `ssh-keyscan -p <порт> <адрес>`, снятый с вашего компьютера).
- Variables (необязательно): `VPS_PORT` (по умолчанию 22), `VPS_PROJECT_PATH` (путь к проекту на сервере, по умолчанию `telegram-barber-bot` в домашней папке).

После этого каждый push в `main` с успешным CI запускает workflow Deploy: он обновляет код до проверенного коммита и выполняет `docker compose up -d --build`.

**Проверка и логи:**

```bash
docker compose ps
docker compose logs -f
```

Запускайте только один экземпляр бота на токен, иначе Telegram вернёт ошибку 409.

## Данные салона

Весь контент лежит в `data/*.json`: `services.json` (услуги и цены), `masters.json`, `schedule.json` (график и часовой пояс), `business.json` (адрес, контакты), `gallery.json`. Фото лежат в `assets/`.

Порядок правки:

1. Отредактируйте нужный JSON.
2. Проверьте данные и фото без запуска бота: `npm run validate-data`. Команда укажет файл и поле с ошибкой.
3. Закоммитьте и пересоберите образ. Горячей перезагрузки данных нет: изменения подхватываются после рестарта.

Перед коммитом новых фото можно ужать их: `npm run optimize-assets`.

## Команды

| Команда                              | Что делает                           |
| ------------------------------------ | ------------------------------------ |
| `npm run dev`                        | запуск с перезапуском при изменениях |
| `npm run build` / `npm start`        | сборка в `dist/` и запуск            |
| `npm test`                           | тесты (vitest)                       |
| `npm run lint` / `npm run typecheck` | линтер и проверка типов              |
| `npm run format`                     | форматирование prettier              |
| `npm run validate-data`              | проверка `data/*.json` и фото        |
