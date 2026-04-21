# Aluminum Project

A monorepo containing a **Laravel** backend API and a **React + Vite + TypeScript + Tailwind CSS 4** frontend for an aluminum company management system.

## Stack

- **Backend**: Laravel 12 (PHP 8.2+, Composer, SQLite by default) in `backend/`
- **Frontend**: React 19 + Vite + TypeScript + Tailwind CSS 4 in `frontend/`

## Prerequisites

Before you start, make sure you have the following installed:

- **PHP 8.2+** with the following extensions enabled: `pdo_sqlite`, `mbstring`, `openssl`, `tokenizer`, `xml`, `ctype`, `json`, `bcmath`, `fileinfo`, `curl`
- **Composer** (PHP package manager) — https://getcomposer.org
- **Node.js 20+** and **npm** — https://nodejs.org
- **Git** — https://git-scm.com

Check your versions:

```bash
php -v
composer -V
node -v
npm -v
git --version
```

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Mohammed123-najeh/Aluminum-company.git
cd Aluminum-company
```

### 2. Set up the backend (Laravel)

```bash
cd backend

# Install PHP dependencies
composer install

# Copy the example env file and generate an app key
cp .env.example .env
php artisan key:generate

# Create the SQLite database file (if it does not exist)
# Linux / macOS:
touch database/database.sqlite
# Windows (PowerShell):
#   New-Item -ItemType File -Path database/database.sqlite -Force

# Run migrations (and seeders, if you want sample data)
php artisan migrate
php artisan db:seed        # optional

# Create the storage symbolic link (for uploaded files)
php artisan storage:link

# Start the backend server
php artisan serve --host=127.0.0.1 --port=8000
```

The API will be available at `http://localhost:8000`.

Health check endpoint: `GET http://localhost:8000/up`

> **Tip:** The repository is pre-configured for SQLite. If you prefer MySQL/PostgreSQL, update the `DB_*` variables in `backend/.env` and re-run `php artisan migrate`.

### 3. Set up the frontend (React + Vite)

Open a **new terminal** (keep the backend running), then:

```bash
cd frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The frontend will be available at `http://localhost:5173`.

## Environment Variables

### Backend (`backend/.env`)

Key variables you may want to adjust:

```env
APP_URL=http://localhost:8000
FRONTEND_URL=http://localhost:5173

DB_CONNECTION=sqlite
# For MySQL/PostgreSQL instead, uncomment and set:
# DB_CONNECTION=mysql
# DB_HOST=127.0.0.1
# DB_PORT=3306
# DB_DATABASE=aluminum
# DB_USERNAME=root
# DB_PASSWORD=
```

### Frontend

If the frontend needs to know the API URL, create a `frontend/.env` file:

```env
VITE_API_URL=http://localhost:8000
```

## Common Commands

### Backend

```bash
php artisan serve              # start the dev server
php artisan migrate            # run migrations
php artisan migrate:fresh      # drop all tables and re-run migrations
php artisan db:seed            # run seeders
php artisan tinker             # interactive REPL
php artisan route:list         # list all routes
composer test                  # run tests
```

### Frontend

```bash
npm run dev          # start the Vite dev server
npm run build        # build for production (output in dist/)
npm run preview      # preview the production build locally
```

## Project Structure

```
ALumnuim_project/
├── backend/          # Laravel 12 API
│   ├── app/
│   ├── database/
│   ├── routes/
│   └── ...
├── frontend/         # React + Vite + TS + Tailwind
│   ├── src/
│   ├── public/
│   └── ...
├── docs/             # Project documentation
└── README.md
```

## Troubleshooting

- **`SQLSTATE[HY000] [14] unable to open database file`** — Make sure `backend/database/database.sqlite` exists and that the path in `.env` is correct.
- **`No application encryption key has been specified.`** — Run `php artisan key:generate` inside `backend/`.
- **CORS errors in the browser** — Check that `FRONTEND_URL` in `backend/.env` matches the URL the frontend runs on, then run `php artisan config:clear`.
- **Port already in use** — Use a different port, e.g. `php artisan serve --port=8001` or `npm run dev -- --port=5174`.
- **`composer install` fails** — Make sure all required PHP extensions listed in *Prerequisites* are enabled.

## License

This project is for internal use by the aluminum company team.
