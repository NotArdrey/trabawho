# Professional Application Design and Engineering Standard

## 1. Purpose

This standard defines how an application should be structured, designed, and tested so that it remains:

- Professional and visually consistent
- Easy to understand and operate
- Accessible across input methods
- Responsive across supported screen sizes
- Maintainable as the project grows
- Predictable for users and developers

It is technology- and theme-independent.

## 2. Core Principles

### 2.1 Clarity before decoration

Every screen must make these points clear:

1. Where the user is
2. What information is available
3. What action should be taken next
4. What happened after an action
5. How to recover from a mistake

Visual effects must never reduce readability or obscure hierarchy.

### 2.2 Consistency before novelty

The same action, state, or content type should look and behave consistently throughout the application.

Examples:

- Save actions use the same terminology and feedback.
- Destructive actions always require appropriate confirmation.
- Back navigation appears in a consistent location.
- Form errors follow the same presentation pattern.
- Selected items use the same visual language.

### 2.3 Recognition over recall

Do not force users to remember information unnecessarily. Provide visible labels, helpful placeholders, examples, current selections, summaries of supplied information, contextual instructions, and recently entered or relevant values.

A user should not need to leave a task simply to remember its requirements.

### 2.4 Progressive disclosure

Show the information needed for the current task first. Place advanced or secondary information behind clearly labeled disclosures, tabs, or inspectors. Do not show every setting at once merely because it exists.

### 2.5 Safe and reversible interaction

Whenever practical:

- Preserve unfinished work.
- Support editing after mistakes.
- Provide Undo or recovery.
- Confirm destructive operations.
- Avoid mutating data after invalid input.
- Explain the effect of irreversible actions before confirmation.

## 3. Application Architecture

### 3.1 Feature-based organization

Organize application code around product features rather than file types alone.

```text
src/
  app/
    router/
    providers/
    guards/
    navigation/
  components/
    ui/
    layout/
  features/
    feature-name/
      pages/
      components/
      hooks/
      services/
      types.ts
      index.ts
  lib/
  styles/
  assets/
```

Responsibilities:

- Pages compose complete screens.
- Components render focused interface units.
- Hooks/controllers manage state and orchestration.
- Services handle APIs, databases, and external systems.
- Types define feature-specific contracts.
- Shared UI must not depend on business-specific knowledge.
- Shared libraries contain genuinely reusable infrastructure.

### 3.2 Component boundaries

Create a component when a section has its own interaction behavior, is reused, has a clear conceptual responsibility, can be tested independently, or makes a parent page easier to understand. Do not split trivial markup into many meaningless components.

### 3.3 File-size limits

- Target: no more than 500 lines
- Review required: 501–600 lines
- Prohibited without exceptional justification: more than 600 lines

Large files should be split by responsibility, not by arbitrary line ranges.

### 3.4 Import rules

Use stable source aliases instead of fragile cross-directory paths.

```ts
import { Button } from "@/components/ui/button";
import { useAssessment } from "@/features/assessments";
```

Avoid:

```ts
import { Button } from "../../../../components/ui/button";
```

Rules:

- Features must expose deliberate public entry points.
- Avoid deep imports into another feature’s internal files.
- Shared packages must not import application code.
- Presentation components must not directly access the database.
- Circular dependencies are prohibited.

### 3.5 Separation of concerns

```text
User interface
    ↓
Feature state and orchestration
    ↓
Domain rules and validation
    ↓
Data-access services
    ↓
Database or external API
```

Business rules should remain testable without rendering the interface.

## 4. Shared Component Standard

Use shared components for ordinary interface behavior: buttons, icon buttons, form fields, text inputs, selects, checkboxes, radio groups, tabs, disclosures, dialogs, confirmation dialogs, dropdown menus, tooltips, badges, status indicators, inline feedback, empty states, loading states, page headers, toolbars, sidebars, and pagination.

Specialized components may be created for domain-specific interactions such as diagrams, canvases, charts, or editors.

### 4.1 Component API quality

Shared components must:

- Use typed props
- Support disabled and loading states
- Expose accessible labels
- Support keyboard operation
- Preserve visible focus
- Allow controlled styling variants
- Avoid embedding feature-specific language
- Behave consistently across every usage

### 4.2 Variants

Define explicit semantic variants rather than styling buttons individually:

```ts
type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive";
```

Do not use color alone to communicate purpose.

## 5. Visual Hierarchy

### 5.1 Page structure

A typical page should follow this order:

```text
Page label
Page title
Short description
Primary page action
Context or filters
Main workspace
Secondary information
```

The user should recognize the page purpose without reading every element.

### 5.2 Typography

Use a restrained type scale.

- Page title: 36–40px
- Section title: 22–28px
- Panel heading: 17–20px
- Normal content: 14–16px
- Form content: 13–15px
- Labels and metadata: 11–13px

Do not use oversized text inside dense workspaces. Reserve monospace fonts for code and technical values. Maintain readable line height. Avoid excessive uppercase text. Do not concatenate titles, counts, badges, or metadata; every distinct value should have its own layout element.

### 5.3 Spacing

Use a consistent spacing scale such as `4, 8, 12, 16, 24, 32, 48, 64`.

- Small gap: tightly related information
- Medium gap: fields within one group
- Large gap: separate sections or concepts

Avoid both cramped controls and excessive empty space.

### 5.4 Borders and containers

Borders should indicate meaningful boundaries such as the page workspace, navigator, form control, dialog, table, or data region. Avoid unnecessary panel-inside-panel decoration when spacing and headings already establish structure. Use a consistent border radius across comparable components.

## 6. Layout and Responsiveness

### 6.1 Responsive composition

Design layouts intentionally for wide desktop, regular desktop, tablet, and mobile. Do not simply shrink the desktop interface.

```text
Wide:    Navigator | Editor
Tablet:  Navigator above editor
Mobile:  Collapsed selector, then editor
```

### 6.2 Overflow protection

For every flexible row or grid:

- Use appropriate `min-width: 0`.
- Allow long titles to wrap.
- Truncate only nonessential summaries.
- Never truncate addresses, commands, IDs, or calculated values.
- Avoid fixed widths that cause horizontal overflow.
- Keep scrollbars visible where scrolling exists.

### 6.3 Touch targets

Interactive controls should generally be at least 44 × 44 CSS pixels or points. Compact visual icons may be smaller, but their interactive area must remain accessible.

## 7. Navigation and Information Architecture

### 7.1 Navigation order

Navigation should reflect the user’s workflow rather than internal implementation.

```text
CREATE
- Content
- Assessments

DELIVER
- Classes
- Sharing

REVIEW
- Results
- Reports
```

Related tasks should appear near each other.

### 7.2 Location and history

Users should be able to determine their current section, selected record, how to return, and whether unsaved work exists. Browser or system Back must behave predictably. Meaningful navigation state should be represented in routes or URL parameters when appropriate.

### 7.3 Tabs

Use tabs only for peer-level views of the same object, such as `CONTENT | SETTINGS | PREVIEW`. Do not use tabs as a substitute for unrelated navigation.

## 8. Forms and Data Entry

### 8.1 Field structure

Every field should provide a persistent label, expected value, accepted format, example when needed, validation feedback, and relationship to the current task. Placeholders are examples, not labels.

### 8.2 Validation

Separate:

- **Malformed input:** must not change state.
- **Valid but incorrect input:** may remain editable with clear feedback.
- **Warnings:** explain risk without blocking when intentional use is reasonable.
- **Blocking errors:** prevent saving or submission.

Errors should appear near the affected field and include a corrective action. Avoid messages such as “Invalid value,” “Something went wrong,” or “Request failed.” Prefer messages such as “Enter a prefix from 0 to 32,” “The end date must be after the opening date,” or “This name is already being used.”

### 8.3 Saving

Clearly distinguish unsaved changes, saving, saved, save failed, and offline or queued changes. Routine save feedback should be compact and temporary. Do not fill the screen with persistent success alerts.

### 8.4 Destructive actions

Destructive actions must use clear words such as `DELETE LESSON`, identify the affected record, explain what will remain or be removed, require confirmation when recovery is difficult, and be visually separated from ordinary actions. Avoid ambiguous icon-only destructive controls unless a tooltip and accessible label are present.

## 9. Action Hierarchy

Each task state should have one dominant primary action.

```text
ADD QUESTION     SAVE ASSESSMENT
secondary        primary
```

- Put actions near the content they affect.
- Place the final or primary action last in reading order.
- Group related actions.
- Separate destructive actions.
- Avoid duplicate actions unless both locations are necessary.
- Disable actions only when the user can understand why.
- Explain blocked actions near the control.

## 10. Feedback and System Status

### 10.1 Feedback categories

Use consistent semantic states: success, information, warning, error, loading, offline, empty, and disabled. Each state must use more than color through an icon, label, description, and appropriate accessibility announcement.

### 10.2 Notifications

Use inline feedback for field and section results, temporary notifications for routine success, persistent banners only for ongoing conditions, and dialogs only for blocking decisions or confirmation. Success notifications should dismiss automatically unless the information remains important.

### 10.3 Loading

Every asynchronous action must provide an immediate pressed or loading state, protection against duplicate submission, clear completion or failure feedback, and preservation of existing valid content during refresh. Do not make a button appear unresponsive while waiting for a server.

## 11. Empty, Error, and Loading States

Every data-driven section must support initial loading, empty result, partial content, successful content, recoverable error, permission denied, and offline fallback.

An empty state should explain what is missing, why it matters, and what the user can do next.

```text
No questions yet

Add a question to begin building this assessment.

[ ADD QUESTION ]
```

## 12. Human–Computer Interaction Standard

### 12.1 Visibility of system status

The application must promptly show current selection, current operation, loading state, save state, completion state, and validation result.

### 12.2 Match the real world

Use language familiar to the intended user. Prefer terms such as online backup, saved lesson, published version, and restore previous version. Avoid exposing internal terms such as hydration, schema state, runtime snapshot, entitlement, or internal identifier. Technical terminology is appropriate only when it is part of the subject being taught or the user’s professional task.

### 12.3 User control and freedom

Support Cancel, Back, Undo, editing after errors, reversible selection, and confirmation before destructive changes. Do not trap users in mandatory dialogs or irreversible workflows unnecessarily.

### 12.4 Error prevention

Prevent errors through constrained choices, useful defaults, format examples, duplicate detection, dependency checks, confirmation before replacement, and preview before publication or submission.

### 12.5 Flexibility and efficiency

Support beginners and experienced users through clear visible controls, keyboard shortcuts, drag-and-drop with keyboard alternatives, search and filtering, templates, reusable defaults, and progressive disclosure. Advanced efficiency must not make basic operation harder.

## 13. Accessibility

Target WCAG 2.2 AA where applicable.

- Full keyboard operation
- Visible focus indicators
- Logical focus order
- Correct headings and landmarks
- Accessible names for icon controls
- Form labels programmatically associated with inputs
- Errors associated with affected fields
- Status changes announced politely
- Dialog focus containment and restoration
- Selected, expanded, checked, and disabled states exposed semantically
- Adequate color contrast
- Reduced-motion support
- No meaning communicated by color alone
- Large-text and zoom support

Tooltips must supplement controls, not replace accessible labels. Drag-and-drop must provide keyboard alternatives such as `MOVE EARLIER` and `MOVE LATER`.

## 14. Content and Language

### 14.1 Professional writing

Interface copy should be clear, concise, specific, consistent, action-oriented, and appropriate for the user’s knowledge level.

Prefer:

```text
Select a lesson to edit its content.
Add at least two answers.
Your changes were saved.
```

Avoid:

```text
Perform content entity selection.
Invalid operation.
State successfully mutated.
```

### 14.2 Terminology governance

Maintain a glossary for recurring terms. The same concept must not be called Collection on one page, Workshop on another page, and Package elsewhere. Choose one user-facing term and apply it consistently. Internal names may remain different when compatibility requires it.

## 15. Data and Security Boundaries

- Never display raw database errors to users.
- Never expose tokens, keys, sessions, request headers, or private identifiers.
- Map service failures to safe, understandable messages.
- Keep authorization enforcement on the server.
- Do not rely on hidden buttons as security.
- Validate data at both interface and server boundaries.
- Do not render arbitrary HTML from stored content.
- Require confirmation for sensitive changes.
- Clear protected client data after sign-out or authorization loss.
- Log technical failures securely without exposing them in production UI.

## 16. Testing Standard

### 16.1 Required automated testing

Test domain and validation logic, component behavior, keyboard interaction, navigation and route guards, loading/empty/success/error states, CRUD operations, permission boundaries, unsaved-state preservation, destructive confirmations, and responsive behavior where practical.

### 16.2 Visual validation

Inspect representative screens at 390px, 768px, 1024px, 1280px, and 1440px. Also test browser zoom, large text, long titles, empty data, many records, slow requests, offline behavior, validation failures, and permission loss.

### 16.3 Quality gates

Before release, run type checking, linting, unit and component tests, production build, import-boundary checks, file-size checks, encoding checks, accessibility review, and responsive layout review. Warnings must either be resolved or documented with a reason.

## 17. Definition of Done

A feature is complete only when:

- It fulfills the user’s actual task.
- Its location in the application is logical.
- Its wording is understandable.
- Loading and errors are handled.
- Invalid input is safe.
- Destructive actions are protected.
- Keyboard and assistive-technology use are supported.
- The layout works at supported widths.
- State survives expected navigation.
- Components follow architecture boundaries.
- Relevant automated tests pass.
- No unrelated feature is broken.

A feature merely rendering on screen does not make it complete.
