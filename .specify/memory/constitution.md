# Rhythm Frontend Constitution

## Core Principles

### I. Feature-Based Architecture (NON-NEGOTIABLE)

The frontend MUST follow a feature-based architecture with clear ownership boundaries.

- Each business feature MUST own its feature-specific components, hooks, types, validation schemas, and business logic.
- Features MUST remain independently understandable and maintainable.
- Shared functionality MUST be extracted only when it is genuinely reused or represents a stable cross-feature contract.
- Circular dependencies between features are prohibited.
- Direct imports from another feature's internal implementation are prohibited. Cross-feature communication MUST use explicitly defined public APIs, shared contracts, or application-level orchestration.
- New features MUST integrate with the existing application architecture rather than introduce competing architectural patterns.
- Existing working modules MUST NOT be refactored or modified unless required by the approved feature specification.
- Any necessary cross-feature change MUST be explicitly documented and its impact verified.

Current business domains include:

- Nutrition and meal planning
- Recipes and ingredients
- Shopping and inventory
- Workout planning and tracking
- Calendar and notifications
- User preferences and settings

Future domains MUST follow the same architectural principles.

### II. Single Responsibility and Clean Code

Every module, component, function, and hook MUST have a clearly defined responsibility.

- Components MUST primarily handle presentation and interaction.
- Business rules MUST NOT be embedded in JSX.
- Calculations MUST be implemented as pure functions whenever possible.
- API communication MUST be separated from presentation.
- Complex conditional rendering MUST be extracted into readable components or functions.
- Avoid unnecessary abstraction, inheritance, and premature generalization.
- Prefer composition over large, configurable, multipurpose components.
- Avoid duplicated business logic and derived state.
- Use early returns when they improve readability.
- Prefer explicit logic over clever or compressed expressions.
- Comments MUST explain non-obvious decisions, constraints, or trade-offs rather than repeat the code.
- Dead code, unused exports, and obsolete imports MUST be removed when directly related to the change.

Code MUST prioritize maintainability, correctness, and readability over minimizing line count.

### III. Type Safety and Explicit Contracts (NON-NEGOTIABLE)

TypeScript MUST be used with strict type checking.

- The `any` type is prohibited unless an exceptional use is explicitly justified.
- Unsafe type assertions MUST NOT be used to bypass validation.
- External data MUST be treated as untrusted.
- API responses, persisted data, and imported data MUST be validated at appropriate trust boundaries.
- Domain entities MUST have explicit, meaningful TypeScript types.
- Prefer discriminated unions for entities with multiple states or variants.
- Use enums or union types consistently with the existing codebase.
- Do not create duplicate definitions of the same domain concept.
- Form values, API DTOs, and domain models MUST be separated when their responsibilities differ.
- Runtime validation MUST use the project's existing validation solution, such as Zod when available.
- State transitions MUST be explicit and type-safe.

Domain and API contracts MUST remain independent of specific UI components.

### IV. Predictable State and Data Flow

Application state MUST have one clear source of truth.

- Server-owned data MUST be managed through the existing repository/query architecture.
- Local UI state MUST remain local whenever practical.
- Global state MUST be reserved for genuinely cross-feature concerns.
- Do not store values that can be reliably derived from existing state.
- State updates MUST be immutable.
- Forms MUST have explicit default values, validation, submission, and error handling.
- Optimistic updates MUST have a rollback or reconciliation strategy.
- Async operations MUST expose loading, error, success, and empty states.
- Related views MUST remain consistent after data changes.
- Mock data MUST NOT be embedded directly inside presentation components.
- Data persistence MUST be accessed through replaceable adapters or repositories.

The frontend MUST NOT silently claim that a backend operation succeeded when it has only updated local state.

### V. User Experience, Accessibility, and RTL (NON-NEGOTIABLE)

Rhythm is a Persian-first, RTL application.

- All user-facing text MUST be clear, natural Persian unless the feature explicitly requires another language.
- All primary application layouts MUST support RTL correctly.
- Prefer CSS logical properties over physical left/right positioning where appropriate.
- Dates MUST be displayed in the Jalali calendar.
- The first day of the week MUST be Saturday.
- Time display MUST follow the user's configured timezone and a consistent 24-hour format.
- Internal date representations MUST be unambiguous and timezone-aware where required.
- All interactive elements MUST support appropriate keyboard interaction and accessible names.
- Forms MUST provide understandable labels, validation feedback, and error messages.
- Color MUST NOT be the only method of communicating status.
- Mobile and desktop layouts MUST be usable and responsive.
- Existing design tokens, typography, spacing, and UI patterns MUST be reused.
- New UI MUST remain visually consistent with existing Rhythm modules.

User-facing workflows MUST minimize unnecessary steps while preserving explicit confirmation for important operations.

### VI. Testing and Regression Protection (NON-NEGOTIABLE)

All critical business behavior MUST be verifiable through automated tests.

- New or modified domain calculations MUST have unit tests.
- Date calculations, calendar boundaries, scheduling conflicts, nutrition calculations, shopping aggregation, and workout calculations MUST be covered when affected.
- Shared component behavior MUST be tested when it contains meaningful interactions.
- Cross-feature integration changes MUST have appropriate integration or regression tests.
- Critical user workflows MUST have suitable end-to-end coverage when test infrastructure is available.
- Bug fixes SHOULD include a regression test reproducing the failure.
- Tests MUST verify observable behavior rather than implementation details.
- Mock services MUST support deterministic tests.
- No code change may knowingly leave existing relevant tests failing.

For critical domain logic, tests SHOULD be written before implementation or alongside the smallest implementation increment.

A feature is not complete merely because its UI renders successfully.

### VII. Simplicity, Performance, and Security

Prefer the simplest implementation that satisfies the approved requirements.

- Follow YAGNI, DRY, and SOLID principles pragmatically.
- Do not introduce new libraries when existing dependencies adequately solve the problem.
- Avoid premature optimization.
- Optimize only when justified by measurable or clearly identifiable performance concerns.
- Prevent unnecessary rerenders in frequently updated interfaces.
- Use pagination or virtualization for potentially large collections when appropriate.
- Avoid unnecessarily large client bundles.
- Never place API secrets, credentials, or private system instructions in frontend source code.
- Client-side validation MUST NOT be treated as a security boundary.
- User-generated content MUST be handled safely.
- Destructive actions MUST have appropriate confirmation and recovery behavior.
- Sensitive data MUST NOT be logged unnecessarily.
- Error messages MUST avoid exposing credentials or internal system information.

Security and data correctness MUST take priority over convenience.

---

## File and Folder Organization Rules

### 1. General Directory Structure

The following structure is the preferred architectural target, not a mandate to reorganize existing files immediately.

```text
src/
  app/
    layouts/
    providers/
    router/

  features/
    nutrition/
    shopping/
    workout/
    calendar/
    settings/

  shared/
    components/
      ui/
    hooks/
    utils/
    types/
    constants/

  services/
    api/
    domain/
    mock/
    repositories/

  store/
```

Rules:

- Existing project conventions MUST be inspected before adding directories.
- New files MUST be placed near the feature that owns them.
- Existing working files MUST NOT be moved solely to conform to this diagram.
- Structure changes MUST have a clear, documented benefit.
- Unrelated files MUST NOT be reorganized during feature development.
- Root-level directories MUST NOT be added without an identifiable architectural responsibility.
- Empty placeholder directories SHOULD NOT be created for speculative future features.

### 2. Feature Folder Structure

A feature MAY contain the following directories as needed:

```text
features/
  workout/
    components/
    pages/
    hooks/
    services/
    domain/
    types/
    schemas/
    constants/
    utils/
    tests/
    index.ts
```

Rules:

- Directories MUST be created only when they contain real functionality.
- Feature-specific code MUST remain inside the owning feature.
- Reusable code MUST NOT be promoted to `shared` without a demonstrated cross-feature need.
- Components MUST NOT directly import internal files from unrelated features.
- Feature entry points SHOULD expose a minimal public interface.
- Domain rules MUST remain independent of React and rendering frameworks.
- Feature-owned services MUST not duplicate an existing shared repository or API responsibility.

### 3. File Naming Conventions

New files MUST follow these naming rules unless the existing repository has an established, conflicting convention.

| File type            | Naming convention                 | Example                            |
| -------------------- | --------------------------------- | ---------------------------------- |
| React component      | PascalCase                        | `WorkoutCard.tsx`                  |
| React page           | PascalCase with Page suffix       | `WorkoutPlannerPage.tsx`           |
| React hook           | camelCase with use prefix         | `useWorkoutSessions.ts`            |
| Domain utility       | camelCase                         | `calculateWorkoutCalories.ts`      |
| Service              | camelCase with descriptive suffix | `workoutService.ts`                |
| Repository           | camelCase with Repository suffix  | `workoutRepository.ts`             |
| Validation schema    | camelCase with Schema suffix      | `workoutSessionSchema.ts`          |
| Types                | Descriptive file name             | `workout.types.ts`                 |
| Constant definitions | Descriptive file name             | `workout.constants.ts`             |
| Unit test            | Matching source filename          | `calculateWorkoutCalories.test.ts` |

Additional rules:

- Names MUST describe responsibility rather than implementation history.
- Avoid meaningless names such as `helper.ts`, `common.ts`, `misc.ts`, or `utils2.ts`.
- Avoid names like `NewComponent`, `FinalComponent`, or `ComponentV2` unless versioning is a deliberate domain requirement.
- Prefer named exports for reusable components and utilities unless required by the framework.
- Avoid excessive barrel exports that introduce circular dependencies.
- Do not create multiple files representing the same concept without distinct responsibilities.
- Keep import paths consistent with the project's alias configuration.

### 4. Component Organization

Components MUST be organized according to responsibility and ownership.

- Page components coordinate page layout, queries, and major UI sections.
- Feature components implement reusable interfaces within a feature.
- Shared UI components contain design-system primitives without feature-specific business rules.
- Form components manage presentation and interaction but delegate domain calculations.
- Complex repeated UI SHOULD be extracted into focused components.
- Large components SHOULD be decomposed when they contain multiple independent responsibilities.
- Component extraction MUST NOT be based solely on arbitrary line-count thresholds.
- Avoid deeply nested component trees caused by unnecessary wrappers.

### 5. Hooks Organization

- Hooks MUST represent reusable React behavior or a meaningful application interaction.
- Hooks MUST NOT become containers for unrelated business logic.
- Feature-specific hooks MUST remain in their owning feature.
- Shared hooks MUST have a genuine cross-feature responsibility.
- Hooks MUST follow React's Rules of Hooks.
- Hooks MUST clean up subscriptions, listeners, and asynchronous side effects appropriately.
- Pure calculations MUST NOT be implemented as hooks merely for reuse.

### 6. Domain Logic Organization

Domain logic MUST remain independent of UI components.

For Rhythm, domain logic includes:

- Nutrition and macronutrient calculations
- Ingredient quantity conversions
- Shopping list aggregation
- Pantry inventory reconciliation
- Workout calorie estimations
- Workout session duration calculations
- Calendar date calculations
- Scheduling conflict detection
- Weekly plan state transitions

Rules:

- Business calculations MUST be deterministic where possible.
- Domain logic MUST have explicit input and output contracts.
- Domain functions MUST NOT depend directly on React components.
- Domain services MUST NOT directly manipulate the DOM.
- Domain rules shared between multiple features SHOULD be placed in an appropriately owned shared domain module.
- Domain logic MUST include appropriate edge-case handling and tests.

### 7. API and Repository Organization

All remote data access MUST pass through a clearly defined data-access boundary.

- UI components MUST NOT make arbitrary direct HTTP requests when an established repository or API client exists.
- API response normalization SHOULD occur at the data boundary.
- Domain entities MUST NOT be tightly coupled to external provider response formats.
- Mock and real implementations SHOULD conform to compatible contracts.
- Components MUST NOT need significant rewrites when changing from mock to real API implementations.
- Error handling and query invalidation MUST be consistent.
- Backend-specific behavior MUST NOT be simulated as guaranteed production behavior.

### 8. File Size and Complexity

File length is a maintainability signal, not an absolute architectural rule.

- Files SHOULD remain focused and reasonably sized.
- Components exceeding approximately 250 lines SHOULD be reviewed for multiple responsibilities.
- Modules exceeding approximately 400 lines SHOULD be reviewed for separation opportunities.
- These thresholds MUST NOT trigger automatic splitting.
- Splitting MUST improve cohesion, testing, or readability.
- Creating many tiny files without meaningful ownership boundaries is discouraged.
- Avoid large files containing unrelated types, constants, business rules, and presentation logic.

### 9. Dependency Direction

The preferred dependency flow is:

```text
Application Composition
        |
        v
Feature UI / Pages
        |
        v
Feature Hooks / Services
        |
        v
Domain Contracts / Repositories
        |
        v
API / Persistence Adapters
```

Rules:

- Lower-level domain logic MUST NOT depend on UI components.
- Infrastructure implementations MUST satisfy defined contracts.
- Shared primitives MUST NOT import business features.
- Cross-feature operations SHOULD be coordinated through application-level services or explicit domain contracts.
- Circular imports are prohibited.
- A dependency MUST have a clear architectural reason.

---

## Additional Technical Constraints

### Technology Stack

The existing repository is the source of truth for the installed technology stack.

The intended frontend architecture uses React and TypeScript.

Existing libraries for routing, forms, validation, styling, queries, state management, charts, and dates MUST be reused where appropriate.

An agent MUST NOT assume that a particular library is installed solely because it is mentioned in a specification.

Before introducing a dependency, the agent MUST:

1. Inspect the existing package manifest and implementation.
2. Check whether an existing dependency already solves the problem.
3. Explain the purpose of the new dependency.
4. Consider bundle size, maintenance, and compatibility.
5. Avoid unrelated dependency upgrades.

### Forms and Validation

- Forms MUST use the project's established form management pattern.
- Validation schemas SHOULD be reusable where appropriate.
- Forms MUST display field-level errors clearly.
- Submission MUST prevent accidental duplicates.
- Async submissions MUST expose progress and failure states.
- Forms SHOULD preserve unsaved values when appropriate.
- Required fields MUST be distinguishable from optional fields.
- Validation MUST NOT silently alter user input.

### Calendar and Localization

- Persian language and RTL are first-class requirements.
- Display dates MUST use the Jalali calendar.
- The week MUST start on Saturday.
- Internal date values MUST not rely on ambiguous locale-specific strings.
- Date conversion MUST be centralized in the existing calendar utility or domain layer.
- Timezone conversion MUST be explicit where relevant.
- Weekly planning logic MUST use consistent date boundaries.
- Date-related functionality MUST be tested around month/year transitions.

### Nutrition, Workout, and Health-Related Information

- Estimated values MUST be visibly distinguished from measured values.
- Nutrition and workout calculations MUST use documented formulas or identifiable data sources.
- Missing inputs MUST NOT be replaced with fabricated measurements.
- User-defined targets MUST NOT be silently changed.
- Exercise energy estimates MUST NOT automatically change nutrition targets.
- Supplement dosage and medically significant scheduling MUST NOT be generated without an appropriate verified basis.
- Health-related UI MUST avoid presenting approximate calculations as medical conclusions.

### AI and Agent Integration

- AI-generated content MUST be treated as untrusted input.
- User-editable agent preferences MUST be separated from protected system policies.
- Protected system instructions MUST NOT be embedded in client bundles.
- Destructive AI-proposed actions MUST require appropriate validation and confirmation.
- Agent operations MUST use typed contracts and validated inputs.
- UI MUST represent draft, pending, confirmed, failed, and completed states accurately.
- Backend and workflow orchestration responsibilities MUST NOT be implemented as insecure frontend substitutes.

### Persistence and Data Integrity

- Data ownership MUST be explicit.
- Mock persistence MUST be distinguishable from production persistence.
- Stable identifiers MUST be used for domain entities.
- Historical and confirmed records MUST not be silently overwritten by draft changes.
- Editing a scheduled workout MUST not automatically mutate the original workout template.
- Editing a planned meal MUST not automatically mutate the original recipe.
- Shopping list regeneration MUST preserve unrelated manual entries and relevant purchase states.
- Any cross-feature synchronization MUST define its source of truth.

---

## Development Workflow and Quality Gates

### 1. Repository Inspection

Before implementing a feature, the agent MUST:

1. Inspect relevant existing files.
2. Identify the owning feature.
3. Identify reusable components and services.
4. Understand existing data models and dependencies.
5. Identify affected routes, state, and business calculations.
6. Determine the minimum necessary change scope.

The agent MUST NOT rewrite existing functionality based solely on assumptions.

### 2. Specification-First Development

Every non-trivial feature MUST have clear requirements and acceptance criteria before implementation.

Specifications SHOULD identify:

- User scenarios
- Functional requirements
- Non-functional constraints
- Data ownership
- Affected modules
- Validation rules
- Error and empty states
- Acceptance tests

The implementation plan MUST respect this constitution.

### 3. Minimal Change Principle (NON-NEGOTIABLE)

Changes MUST remain within the approved feature scope.

- Do not refactor unrelated modules.
- Do not rename unrelated files.
- Do not reformat unrelated files.
- Do not change working business behavior without an explicit requirement.
- Do not remove existing functionality to simplify implementation.
- Do not replace established architectural patterns without justification.
- Preserve backward compatibility for shared interfaces whenever possible.
- If an out-of-scope change is necessary, identify and justify it before proceeding.

### 4. Implementation Quality Gates

Before declaring a feature complete, the following checks MUST pass where supported by the repository:

- TypeScript type checking
- ESLint or the configured linting solution
- Relevant unit tests
- Relevant integration tests
- Production build
- Verification of affected user flows
- RTL and responsive layout verification
- Accessibility checks for affected interactions
- Regression checks for affected existing modules

If a required verification cannot run, the limitation MUST be explicitly reported.

A successful build alone is not sufficient evidence that a feature works correctly.

### 5. Change Reporting

After completing implementation, the agent MUST provide a concise report containing:

- Features implemented
- Files created
- Files modified
- Relevant architectural decisions
- Tests executed and results
- Known limitations
- Deferred work

The agent MUST NOT claim tests passed unless they were actually executed.

---

## Governance

This constitution defines mandatory architectural, quality, and development rules for the Rhythm frontend.

### Authority

- The constitution supersedes conflicting informal development preferences.
- Feature specifications and implementation plans MUST comply with the constitution.
- Explicit approved exceptions MUST be documented.
- Existing code is not automatically invalid because it predates this constitution.
- Existing non-compliant code SHOULD be improved when directly affected by approved work, without initiating unrelated large-scale refactoring.

### Amendments

Amendments MUST:

1. Explain the motivation.
2. Identify the principles being changed.
3. Describe compatibility or migration implications.
4. Receive explicit project-owner approval.
5. Update the constitution version and amendment date.

### Versioning

Use semantic versioning:

- MAJOR: Removal or incompatible redefinition of governing principles.
- MINOR: Addition of principles or substantial governance requirements.
- PATCH: Clarifications and non-semantic wording improvements.

### Compliance

All feature plans, implementation tasks, and code reviews MUST consider constitution compliance.

Any deliberate violation MUST have a documented justification and approval.

**Version**: 1.0.0 | **Ratified**: 2026-11-24 | **Last Amended**: 2026-11-24
