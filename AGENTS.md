# Rhythm Frontend — Agent Instructions

> Scope: the Rhythm (`ریتم`) frontend repository. This file describes **how coding agents work**. The governing rules live in `.specify/memory/constitution.md`; feature requirements live in their respective Spec Kit artifacts.

## 1. Instruction hierarchy

1. Follow the project's ratified `.specify/memory/constitution.md`.
2. Follow the approved feature specification, plan, and tasks under `specs/` (or the repository's configured Spec Kit location).
3. Follow these operational instructions.
4. Follow existing repository conventions when they do not conflict with the above.

If rules conflict or a required artifact is missing, identify the conflict or gap instead of silently inventing a new rule. Do not modify the constitution without explicit approval.

## 2. Product context

Rhythm is a Persian-first, RTL life-planning application. Current/near-term domains include nutrition and weekly meal planning, recipes and ingredients, shopping and pantry inventory, workout planning and tracking, calendar views, reminders, and user/agent preferences. Future domains may include tasks, study planning, habits, and external calendar synchronization.

- Display dates in **Jalali**; weeks begin **Saturday**.
- Use the user's configured time zone; use `Asia/Tehran` only as a fallback when the project has no defined setting.
- Keep domain data and date/time values unambiguous. Do not store localized display strings as canonical timestamps.
- The present development phase may use mock repositories. Do not imply that UI-only scheduling, notifications, AI, or Google Calendar synchronization actually runs in production.
- Nutrition, workout energy, and supplement-related outputs are estimates or user-provided records, not medical prescriptions.

## 3. Mandatory workflow for every change

### Before coding

1. Read this file and `.specify/memory/constitution.md` if present.
2. Inspect `package.json`, TypeScript/configuration files, the router, the relevant feature, and current test setup. **Do not assume** a library or directory exists.
3. Identify existing contracts, hooks, repositories, domain utilities, and design-system primitives that can be reused.
4. Establish the exact change scope, affected files, data ownership, and regression risks.
5. For a non-trivial feature, use the project's Spec Kit workflow: specify requirements → resolve ambiguities → plan → tasks → implement. Use the command syntax available in the installed integration.
6. Before modifying shared code, check all known consumers.

### While coding

1. Make the smallest coherent change that satisfies the approved task.
2. Preserve working behavior outside the requested module.
3. Keep business calculations out of JSX and external IO out of pure domain functions.
4. Build on established patterns; do not introduce a new state library, form library, date library, or CSS system without justification.
5. Ensure changes are reflected across the relevant data adapters and UI views without duplicating the source of truth.
6. Never introduce placeholder buttons that appear functional; either implement them against mock/real contracts or label them explicitly as unavailable.

### Before completion

1. Run available typecheck, lint, relevant tests, and build; report the exact commands and outcomes.
2. Test affected flows, including error/empty/loading states, RTL, mobile layout, and Jalali date boundaries when relevant.
3. Verify the change did not alter unrelated routes or features.
4. Report changed files, behavior, decisions, tests actually run, limitations, and deferred work.
5. Do not state that a test or integration succeeded if it was not executed or verified.

## 4. File and folder placement

Prefer feature ownership and the repository's existing structure; the tree below is **illustrative, not a migration command**:

```text
src/
  app/                 # app composition, routing, providers, layouts
  features/
    nutrition/
    shopping/
    workout/
    calendar/
    settings/
  shared/              # genuinely reusable, business-agnostic UI/utils
  services/            # existing API, domain, repository, mock boundaries
  store/               # cross-feature state only if necessary
```

- Place feature-specific pages, components, hooks, types, schemas, and tests inside their owning feature where existing conventions allow.
- Pure business logic belongs in a domain module/service; follow the repository's established location (for example, `src/services/domain/`), rather than creating a duplicate.
- API calls and persistence access belong in existing API/repository adapters, not in arbitrary presentational components.
- `shared/` is for proven cross-feature reuse, **not** miscellaneous or speculative code.
- Avoid cross-feature imports of private internals; use public contracts or application-level composition.
- Do not create speculative empty folders, relocate unrelated files, or run broad formatting changes.
- Avoid circular dependencies and duplicate definitions of domain models.
- Keep feature-specific tests close to the owning feature or follow the established test directory convention.

### File naming

| Purpose         | Rule                          | Example                            |
| --------------- | ----------------------------- | ---------------------------------- |
| React component | PascalCase                    | `WorkoutSessionCard.tsx`           |
| Page            | PascalCase + `Page`           | `WorkoutPlannerPage.tsx`           |
| Hook            | `use` + PascalCase            | `useWorkoutSessions.ts`            |
| Pure function   | descriptive camelCase         | `calculateWorkoutCalories.ts`      |
| Repository      | descriptive + `Repository`    | `workoutRepository.ts`             |
| Schema          | descriptive + `Schema`        | `workoutSessionSchema.ts`          |
| Tests           | source-name + `.test`/`.spec` | `calculateWorkoutCalories.test.ts` |

Use the current project's established naming pattern if it differs; do not rename existing files solely to meet this table. Avoid `helpers2`, `misc`, `newComponent`, or version-suffixed file names without a clear domain reason.

## 5. Coding and boundaries

- Use strict TypeScript and explicit types at module boundaries. Do not use `any` or unsafe casts to silence errors.
- Validate untrusted external and persisted data at runtime using the existing validation stack.
- Prefer explicit state machines/unions for draft, reviewing, confirmed, cancelled, and completed states.
- Keep React components focused on rendering and interaction; extract meaningful reusable behavior, not arbitrary one-line helpers.
- Keep query/server state, form state, and local presentation state separate. Avoid storing derivable state.
- Prefer immutable updates and stable entity IDs. Handle async errors and repeat submissions intentionally.
- Use existing design tokens, shared controls, form patterns, and responsive RTL layout.
- Prefer CSS logical properties; ensure accessibility, labels, focus behavior, keyboard use, and readable Persian validation messages.
- Do not hardcode test data in UI components. Mock data belongs in mock fixtures/repositories and must be replaceable by backend adapters.
- Never ship secrets, protected system prompts, API keys, credentials, or authorization logic in the frontend.

## 6. Domain invariants

- **Nutrition:** recipes/ingredient catalog entries are templates; changing a meal-plan instance must not mutate the canonical recipe. Nutrition totals must derive from selected serving sizes and ingredient data; represent missing values honestly.
- **Shopping:** consolidate ingredient quantities by stable IDs and compatible units. Subtract usable pantry stock; preserve manual items and already-purchased states when regenerating lists. Do not decrement inventory merely because a plan was approved.
- **Workout:** distinguish `WorkoutProgram`, `WorkoutTemplate`, scheduled `WorkoutSession`, and actual activity logs. Editing one scheduled session must not silently rewrite the reusable template. Clearly label MET-based calorie calculations as estimates.
- **Calendar:** use adapters to project confirmed source records into events; calendar is not another independent copy of nutrition/workout plans. Do not invent start/end times. Keep one-way external sync and real notifications disabled until implemented by a backend.
- **Agent preferences:** user-editable custom instructions must remain separate from backend-enforced policy; never expose protected system instructions in client code.
- **History:** avoid implementing a deletion/retention policy for weekly records until requirements explicitly define one.

## 7. Tests and quality gates

- Add/update unit tests for modified pure domain logic, particularly Jalali/week boundaries, time zones, quantity conversions, nutrition totals, shopping-list regeneration, scheduling conflicts, and workout-calorie estimation.
- Add regression/integration tests for cross-module data flows and meaningful user interactions when the existing test infrastructure supports them.
- Use deterministic fixtures and explicitly test unknown/missing inputs and boundary conditions.
- Run repository-defined commands for typechecking, linting, tests, and production build. Inspect scripts rather than guessing names.
- Do not weaken test assertions, disable lint rules, or add `@ts-ignore` without explicit justification.
- If checks cannot be run, state why and report them as **not run**, never as passing.

## 8. Change safety and git discipline

- Do not overwrite, discard, or revert unrelated user changes.
- Do not run destructive git commands, mass-renames, or dependency upgrades unless specifically authorized.
- Prefer focused edits and small diffs. Keep the scope of changed files proportional to the task.
- Ask for approval before an intentionally breaking contract, database shape, or shared behavior change if the approved spec does not already cover it.
- If a task exposes unrelated defects, document them separately instead of silently expanding scope.

## 9. Completion response format

Provide a short, factual summary with:

1. **Implemented:** user-visible behavior and important internal changes.
2. **Files changed:** created/modified files and their purposes.
3. **Validation:** commands run and their actual results.
4. **Caveats:** mocked behavior, known issues, assumptions, deferred backend integration.

Keep all user-facing explanations in Persian unless the user explicitly requests English. Source-code identifiers and technical files may remain in English.

## 10. Spec Kit cooperation

- Treat the constitution as governance, this file as operating instructions, and per-feature specs as product requirements.
- Do not put transient feature requirements into the constitution or this file.
- During `/speckit.plan`, check architecture and dependencies against the constitution and these boundaries.
- During `/speckit.tasks`, split work into verifiable, feature-scoped changes with explicit test tasks.
- During `/speckit.implement`, follow the approved plan; report blockers rather than inventing requirements.
- Update this file only when **general agent workflow** changes; update the constitution only with project-owner approval.
