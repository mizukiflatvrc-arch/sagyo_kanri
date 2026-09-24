# AGENTS.md

This file contains repository-specific instructions for coding agents working on **hibi**.

## Project overview

hibi is a web application for recording library work sessions, daily condition, and later reflection.

The application is intended to support record-keeping and reflection. It must not present medical diagnoses, treatment decisions, or judgments about whether a user should return to school or work.

For detailed product behavior and setup instructions, read `README.md`.

## Tech stack

* React 18
* TypeScript
* Vite
* Firebase Authentication
* Cloud Firestore
* Firestore Security Rules
* Vitest
* pdfmake

Node.js 20 or newer is required. Node.js 22 LTS is preferred.

## Repository structure

Keep responsibilities separated according to the existing structure.

* `src/components/` — reusable UI and form components
* `src/contexts/` — authentication, subscriptions, notifications
* `src/hooks/` — reusable React hooks
* `src/lib/` — infrastructure initialization such as Firebase
* `src/pages/` — page-level UI
* `src/services/` — Firestore access and persistence logic
* `src/report/` — report aggregation, summarization, PDF generation
* `src/types/` — domain and form types
* `src/utils/` — date/time conversion, formatting, validation
* `tests/` — integration and Firestore Rules tests

Do not move logic between these layers without a clear reason.

Prefer extending the existing architecture over introducing a parallel abstraction.

## General implementation rules

* Preserve strict TypeScript typing.
* Avoid `any` unless there is no practical alternative.
* Keep domain logic outside React components where practical.
* Keep Firestore access outside page and presentation components.
* Reuse existing types, services, utilities, and patterns before adding new abstractions.
* Avoid large unrelated refactors while implementing a focused feature.
* Preserve existing behavior unless the task explicitly requires changing it.
* Add or update tests when behavior changes.

## Firebase and data safety

All user data is stored under user-specific Firestore paths.

Do not weaken user isolation or Firestore Security Rules.

Important paths include:

```text
users/{uid}/libraries/{libraryId}
users/{uid}/activeSession/current
users/{uid}/sessions/{sessionId}
users/{uid}/sessions/{sessionId}/revisions/{revisionId}
```

When changing Firestore document shapes or write behavior:

1. Check corresponding TypeScript types.
2. Check Firestore mappers.
3. Check Firestore Security Rules.
4. Check related tests.
5. Keep application changes and Rules changes compatible within the same release.

Do not bypass existing transaction-based consistency guarantees.

Do not add secrets, private keys, service account credentials, or provider API keys to client-side environment variables.

Values exposed through `VITE_*` must be treated as public client configuration.

## Date and time handling

Domain dates use JavaScript `Date`.

Firestore conversion belongs at the persistence boundary.

User-facing date/time behavior is based on Japan Standard Time where the existing implementation explicitly requires it.

Do not silently replace the existing JST conversion behavior with browser-local timezone behavior.

## Legacy records

The application contains handling for records created by the previous encrypted data format.

Do not automatically decrypt, migrate, rewrite, or delete legacy records unless an explicit migration plan is part of the task.

Preserve the safeguards implemented in `src/services/legacyRecords.ts` and related flows.

## LLM and report summarization

LLM integration must remain provider-independent.

The frontend must not depend directly on a specific LLM provider such as Gemini, OpenAI, or a local model implementation.

Preserve the abstraction represented by:

```ts
export interface ReportSummarizer {
  summarize(input: ReportSummaryInput): Promise<ReportSummary>;
}
```

Provider-specific behavior should remain behind an adapter or server-side endpoint.

The intended architecture should allow the backend implementation to change between providers without requiring report UI changes.

Do not add a model-selection UI for normal users unless explicitly requested.

Provider and model selection are application or deployment concerns, not user-facing settings.

Do not expose LLM provider API keys in the browser.

### LLM output rules

LLM-generated report content must:

* use only supplied numerical values instead of inventing or recalculating metrics;
* distinguish observations from unsupported conclusions;
* avoid asserting causal relationships that are not present in the data;
* avoid medical diagnosis or medical evaluation;
* remain suitable as a concise aid for reviewing recorded information;
* use structured output when the surrounding code expects structured output.

Maintain validation of model responses before using them in the UI or PDF output.

Do not trust arbitrary LLM output as valid application data.

### Extensibility

When adding new LLM-backed functionality, prefer purpose-specific inputs and outputs over a generic free-form prompt API.

Examples include:

* period summary
* daily work summary
* memo summary
* overall review
* library comparison

Keep provider concerns separate from these application-level purposes.

## Report generation

Report calculations should remain deterministic application logic.

LLMs may summarize or describe calculated values but should not become the source of truth for report metrics.

Preserve the separation between:

* data aggregation;
* comparison calculations;
* LLM summarization;
* PDF rendering.

Changes to report output should include tests where practical.

## Commands

Install dependencies:

```bash
npm install
```

Development server:

```bash
npm run dev
```

Run tests:

```bash
npm test
```

Run TypeScript checks:

```bash
npm run typecheck
```

Run lint:

```bash
npm run lint
```

Create a production build:

```bash
npm run build
```

Run Firestore Rules tests when Rules or related persistence behavior changes:

```bash
npm run test:rules
```

Before considering an implementation complete, run the checks relevant to the changed area.

For normal application changes, prefer at minimum:

```bash
npm test
npm run typecheck
npm run build
```

If the change affects Firestore access or Security Rules, also run:

```bash
npm run test:rules
```

## Working style

Before implementing a substantial change:

1. Inspect the relevant existing code.
2. Follow the established local patterns.
3. Identify affected types, tests, persistence behavior, and Security Rules.
4. Make the smallest coherent change that satisfies the requirement.

When requirements conflict with existing architecture or security assumptions, do not silently work around them. Preserve safety and consistency, and make the conflict explicit in the implementation notes.
