# SpecForge AI

### From Requirements to Reliable Software.

SpecForge AI helps software teams improve the quality of their requirements before development begins. It identifies unclear or incomplete requirements, suggests questions to resolve missing details, and helps transform them into well-defined requirements, acceptance criteria, and test cases.

By combining rule-based validation with AI assistance and human review, SpecForge creates a structured path from an initial requirement to testable and traceable software specifications.

## The Problem

Poorly defined requirements lead to incorrect assumptions, development rework, unclear expectations, and incomplete testing.

SpecForge addresses this problem by helping teams identify requirement gaps early, clarify stakeholder expectations, and maintain a clear connection between requirements and testing.

## Architecture

<img width="1650" height="1242" alt="SpecForge High-Level System Architecture (1)" src="https://github.com/user-attachments/assets/b27490c8-1bca-42e2-a126-90f203b55a48" />

## Key Features
- **Project Management**: Create and organize projects and manage all their requirements in one place.

- **Requirement Management**: Create, edit, archive, and maintain requirements with a clear version history.

- **Deterministic Validation**: Automatically detect missing details, vague language, unmeasurable conditions, duplicate requirements, and selected potential conflicts.

- **AI-Powered Analysis**: Analyze requirements for semantic ambiguity and identify potential issues that rule-based checks may miss.

- **Smart Clarifications**: Generate relevant questions to help stakeholders resolve missing or unclear requirement details.

- **Requirement Refinement**: Use clarification answers to prepare improved requirement drafts for human review and approval.

- **Acceptance Criteria Generation**: Generate structured Given/When/Then acceptance criteria from approved requirements.

- **Test Case Generation**: Generate test case drafts from approved acceptance criteria and validate them before approval.

- **Traceability Matrix**: Track relationships between requirements, acceptance criteria, and test cases across requirement versions.

- **Coverage and Gap Analysis** : Identify approved testing coverage, missing test cases, and areas that still need attention.

- **Human-in-the-Loop Review** : Keep AI-generated content as drafts until a person reviews and explicitly approves it.



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

### 1. Project Management
View and manage all projects in one place.

<img width="1920" height="1010" alt="Screenshot (15)" src="https://github.com/user-attachments/assets/03faf0f6-f2aa-4fee-b986-c6593f45f7d4" />

### 2. Project Overview
Review project details and its requirement summary.

<img width="1920" height="956" alt="Screenshot (9)" src="https://github.com/user-attachments/assets/3bf44b06-d132-49fc-be1f-d04488b6e1f0" />



### 3. Requirement Management
Browse and manage requirements within a project.

<img width="1920" height="949" alt="Screenshot (4)" src="https://github.com/user-attachments/assets/334df4ff-0272-462a-b581-df0baf8c60a6" />


### 4. Create Requirement
Add a new requirement to a project.

<img width="1626" height="821" alt="image" src="https://github.com/user-attachments/assets/0804a15c-7483-494f-a4af-854f19ac8ff3" />


### 5. Requirement Details
View an individual requirement and its details.

![Requirement Details](https://github.com/user-attachments/assets/64ee9dd8-1d44-4193-afbb-d6504e618f1c)

### 6. Deterministic Validation
Identify requirement quality issues using rule-based checks.

<img width="1627" height="831" alt="image" src="https://github.com/user-attachments/assets/599e3603-afae-48e8-bae1-d48837518a83" />


### 7. AI-Assisted Analysis
Use AI to identify semantic ambiguity and potential requirement issues.

<img width="1626" height="827" alt="image" src="https://github.com/user-attachments/assets/f0c9717c-cc72-416f-ac40-aa19222dd935" />


### 8. Clarification Questions
Review questions that help resolve unclear or incomplete requirements.

![Clarifications](https://github.com/user-attachments/assets/5d552762-f2b1-4f39-a76d-bc613886dc05)

### 9. Requirement Refinement Review
Review a proposed requirement refinement before approval.

<img width="1897" height="873" alt="image" src="https://github.com/user-attachments/assets/d64dcf1e-533a-43d4-bb1f-47e4e27bd732" />


### 10. Requirement Version History
Inspect previous versions of a requirement.

![Version History](https://github.com/user-attachments/assets/de8c3de7-c433-4915-9e2b-0f871067d047)







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

##  AI Setup


### Local Ollama (Preferred ,if there is no premium api key)

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

Get an API key from [Ollama](https://ollama.com/settings/keys). 

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
- Deterministic conflict checks cover only selected patterns.
- AI suggestions may be incorrect or incomplete and require human review.
- Deterministic validation and schema-based checks help reject unsupported or invalid AI outputs, but cannot guarantee detection of every hallucination.
- - **AI Grounding Limitations:** AI-generated findings must be supported by the provided requirement context. Responses containing unsupported evidence may be rejected by validation, resulting in unsuccessful analysis. This can occur even when the AI provider is available, and repeated attempts may not resolve the issue.




---

**SpecForge AI — From Requirements to Reliable Software.**
