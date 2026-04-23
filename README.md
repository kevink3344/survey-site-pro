# HR Survey Management System

Full-stack HR Survey Management System built with React + Tailwind CSS and Express + SQLite.

## Features

- Dashboard with survey/reponse stats and charts
- Surveys management table with per-row action menu
- Multi-page survey editor with drag reordering and branching rules
- Survey results view with summary charts and individual responses
- Global responses page with filters
- Public survey-taking flow at `/s/:slug/:code`
- SQLite persistence and seeded demo data
- Swagger/OpenAPI docs for full CRUD API

## Tech Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, Recharts, React Router
- Backend: Express, TypeScript, better-sqlite3, Zod
- API Docs: Swagger UI + OpenAPI YAML

## Run

```bash
npm install
npm run dev
```

This starts:

- Frontend on `http://localhost:5173`
- API server on `http://localhost:8787`
- Swagger docs on `http://localhost:8787/api/docs`

## Build

```bash
npm run build
```

## Data Model

- `Survey`: title, description, type, status, slug, access_code, pages, questions
- `SurveyResponse`: survey_id, survey_title, survey_type, respondent metadata, submitted_at, answers

Database file is stored at `server/data/survey.sqlite`.
