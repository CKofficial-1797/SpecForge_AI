# SpecForge AI

### From Requirements to Reliable Software.

SpecForge is an engineering quality and requirement intelligence platform that helps transform incomplete and ambiguous software requirements into clear, testable, and traceable specifications.

It combines deterministic validation with optional AI-assisted analysis. AI-generated suggestions remain drafts until reviewed and explicitly approved by a human.

## The Problem

Software requirements are often vague or incomplete. This leads to assumptions, misunderstandings, unclear acceptance criteria, and difficult testing.

SpecForge helps teams identify requirement quality issues early and turn requirements into verifiable engineering artifacts.

## Architecture

<img width="1650" height="1242" alt="SpecForge High-Level System Architecture (1)" src="https://github.com/user-attachments/assets/b27490c8-1bca-42e2-a126-90f203b55a48" />

## Key Features

- **Project and requirement management** — create, edit, archive, and organize projects and requirements.
- **Requirement versioning** — preserve immutable versions and detect stale updates.
- **Deterministic validation** — identify missing information, vague language, measurability issues, duplicates, and selected potential conflicts.
- **AI-assisted analysis** — identify semantic ambiguity and suggest clarification questions.
- **Clarification and refinement** — collect answers and prepare requirement drafts for human review.
- **Acceptance criteria** — generate and review Given/When/Then criteria.
- **Test case generation** — generate draft test cases from approved acceptance criteria.
- **Traceability and coverage** — connect requirements, acceptance criteria, and test cases using version-aware links.

## Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React, TypeScript, Vite |
| UI | Tailwind CSS, shadcn/ui |
| Routing & State | React Router, TanStack Query |
| Backend | Node.js, Express.js, TypeScript |
| Validation | Zod 4 |
| Database | PostgreSQL |
| ORM | Prisma ORM 7 |
| AI | Ollama, Qwen2.5 3B Instruct; optional Ollama Cloud |
| Testing | Vitest, Supertest, React Testing Library |
| Infrastructure | Docker, Docker Compose |
| CI | GitHub Actions |


## Screenshots 
Projects 
<img width="1600" height="900" alt="01-projects" src="https://github.com/user-attachments/assets/34d30361-5108-4470-ba9b-a52240d35611" />
Project Overview
<img width="1600" height="900" alt="02-project-overview" src="https://github.com/user-attachments/assets/263b5f9b-e71a-4447-8e53-2d802de3c1fc" />
Requirements
<img width="1600" height="900" alt="03-requirements" src="https://github.com/user-attachments/assets/6cbf5588-a47a-4098-8df2-503ed02eb9a8" />
Requirements Creation form 
<img width="1600" height="900" alt="04-requirement-creation-form" src="https://github.com/user-attachments/assets/b2239329-e4b6-4c85-bb59-d2c51d5ec229" />
Requirement Detail form 
<img width="1600" height="900" alt="05-requirement-detail-v2" src="https://github.com/user-attachments/assets/64ee9dd8-1d44-4193-afbb-d6504e618f1c" />
Deterministic Validation 
<img width="1600" height="900" alt="06-deterministic-validation" src="https://github.com/user-attachments/assets/eb59e8cc-560f-4be3-9d51-861f25fa5908" />
AI Analysis 
<img width="1600" height="900" alt="07-ai-analysis" src="https://github.com/user-attachments/assets/a2be05a2-d1fb-4942-bfa8-f82465d39064" />
Clarifications
<img width="1600" height="900" alt="08-clarifications" src="https://github.com/user-attachments/assets/5d552762-f2b1-4f39-a76d-bc613886dc05" />
Refinement Review 
<img width="1600" height="900" alt="09-refinement-review" src="https://github.com/user-attachments/assets/d039c263-3ed8-4fc1-88dd-23c8778967dd" />
Version History 
<img width="1600" height="900" alt="10-version-history" src="https://github.com/user-attachments/assets/de8c3de7-c433-4915-9e2b-0f871067d047" />
Traceability Overview 
<img width="1600" height="900" alt="11-traceability-overview" src="https://github.com/user-attachments/assets/f976345d-1234-45b5-86c3-dd0058eb4be2" />
Acceptance criteria empty 
<img width="1600" height="900" alt="12-acceptance-criteria-empty" src="https://github.com/user-attachments/assets/ba6ba69e-f3a0-4072-9761-134f1aa5e9ad" />
Test cases Empty 
<img width="1600" height="900" alt="13-test-cases-empty" src="https://github.com/user-attachments/assets/a530cceb-4319-4c84-b387-c3980c3e24bb" />
Traceability Matrix 
<img width="1600" height="900" alt="14-traceability-matrix" src="https://github.com/user-attachments/assets/b8a2eedf-b66e-4911-89bc-216e6772f216" />
Coverage and Gaps 
<img width="1600" height="900" alt="15-coverage-and-gaps" src="https://github.com/user-attachments/assets/591146f0-dab7-4fd4-8ce6-112b93fc70d2" />
Human Review Status
<img width="1600" height="900" alt="16-human-review-status" src="https://github.com/user-attachments/assets/f7f4d5d1-e46a-47d9-a838-5292fbdd10b5" />
Project Closing 
<img width="1600" height="900" alt="17-project-closing" src="https://github.com/user-attachments/assets/dc815af6-433e-4c9c-967a-ec80df480dc2" />



## Getting Started

### Prerequisites

- Node.js 22 or later
- npm
- Git
- Docker Desktop with Docker Compose

### Run with Docker Compose

1. Clone the repository:

   ```bash
   git clone <YOUR_REPOSITORY_URL>
   cd SpecForge_AI
   ```

2. Create your environment file:

   ```bash
   cp .env.example .env
   ```

   On Windows PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

3. Start the application:

   ```bash
   docker compose up --build
   ```

4. Open the application:

   - Frontend: http://localhost:8080
   - API health: http://localhost:3000/api/health

### Run for Local Development

```bash
npm ci
cp .env.example .env
docker compose up -d db
npm run dev
```

On Windows PowerShell, use `Copy-Item .env.example .env` for the environment-file copy.

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

## Optional AI Setup

AI is optional. Project management, requirement versioning, and deterministic validation can be used without AI inference.

### Local Ollama

Install [Ollama](https://ollama.com/) and download the model:

```bash
ollama pull qwen2.5:3b-instruct
```

Configure the backend environment:

```env
AI_PROVIDER=ollama
OLLAMA_ENABLED=true
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:3b-instruct
```

For Docker Desktop with Ollama installed on the host, configure:

```env
OLLAMA_DOCKER_BASE_URL=http://host.docker.internal:11434
```

### Ollama Cloud

Configure your own cloud credentials in the backend environment:

```env
AI_PROVIDER=ollama-cloud
OLLAMA_ENABLED=true
OLLAMA_API_KEY=<YOUR_OLLAMA_API_KEY>
OLLAMA_MODEL=<SUPPORTED_CLOUD_MODEL>
```

Get an API key from [Ollama](https://ollama.com/settings/keys). Never commit API keys or `.env` files. Cloud inference sends the supplied requirement context to Ollama Cloud.

## Engineering Principles

- Deterministic validation works independently of AI.
- AI output is validated and treated as untrusted input.
- AI-generated artifacts remain drafts until human approval.
- Requirement versions are immutable.
- Acceptance criteria and test cases retain links to their source requirement versions.
- Coverage counts only valid, approved artifacts with correct version links.

## Testing

Run the project checks from the repository root:

```bash
npm run lint
npm run format:check
npm run typecheck
npm run test
npm run build
```

Integration tests require a dedicated PostgreSQL test database. Configure `TEST_DATABASE_URL`, then run:

```bash
npm run test:integration --workspace backend
```

## Project Structure

```text
SpecForge_AI/
├── frontend/
├── backend/
├── prisma/
├── docs/
│   └── screenshots/
├── docker-compose.yml
├── .env.example
├── package.json
└── README.md
```
















## Limitations

- Authentication and project-level user authorization are not implemented.
- Do not expose the application to untrusted networks or use it as a multi-user service.
- Deterministic conflict checks cover only selected patterns.
- AI suggestions may be incorrect or incomplete and require human review.
- Cloud AI availability depends on the configured account, model, and quota.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Architecture Decisions](docs/DECISIONS.md)
- [Development Guide](docs/DEVELOPMENT.md)
- [AI Provider Configuration](docs/AI_PROVIDER_CONFIGURATION.md)
- [Ollama Setup](docs/OLLAMA_SETUP.md)
- [AI Evaluation](docs/AI_EVALUATION.md)
- [Test Case Generation](docs/TEST_CASE_GENERATION.md)
- [Traceability](docs/TRACEABILITY.md)
- [Reliability](docs/RELIABILITY.md)
- [Security](SECURITY.md)

---

**SpecForge AI — From Requirements to Reliable Software.**
