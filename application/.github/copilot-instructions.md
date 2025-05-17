# Minimal, Readable, and Consistent Front‑End Code Guidelines

*Intended use:* Supply these rules as system or style prompts to an AI code generator so it consistently outputs production‑ready HTML, CSS, and JavaScript without over‑engineering. Accessibility concerns are **out of scope** for this guideline.

---

## 1 Philosophy

* **Minimal** – generate only what is needed for stated requirements.
* **Readable** – clarity over cleverness; explicit over implicit.
* **Consistent** – follow these rules uniformly across languages.
* **Direct** - Should not suggest a robust solution outside the scope of request. Always suggest a simple and direct solution.
* **Add debug if needed** - Suggest adding debug codes when needed. Don't suggesting codes based on your assumption.

---

## 2 General Formatting

| Rule        | Setting                                                                       |
| ----------- | ----------------------------------------------------------------------------- |
| Indentation | 2 spaces (no tabs)                                                            |
| Line length | ≤ 100 characters                                                              |
| Quotes      | Double quotes for HTML & JS strings; single quotes for JS literal apostrophes |
| End‑of‑file | Always newline                                                                |
| Prettier    | Assume default settings to auto‑format                                        |

Remove dead code; do **not** leave commented‑out blocks.

---

## 3 HTML Guidelines

### 3.1 Structure

1. Single `<main>` per document; wrap optional `<header>`, `<nav>`, `<footer>`.
2. Favor semantic elements; avoid unnecessary `<div>` wrappers ("divitis").
3. Self‑close void elements (`<img />`, `<input />`, `<br />`).

### 3.2 Attributes

* Boolean attrs have no value (`disabled`, `checked`).
* Attribute order: `id`, `class`, `type`, `name`, `value`, `src`, `href`, `alt`, `title`, data‑*, aria‑*.
* Class names use **kebab‑case**.

### 3.3 Comments

```html
<!-- Section: Product Cards -->
```

One short line explaining *why*, not *what*.

---

## 4 CSS Guidelines

### 4.1 Organization

* Component‑scoped file when feasible (`product-card.css`).
* Global `base.css` contains resets and variables.

### 4.2 Methodology

* **BEM‑lite** convention: `.block__element--modifier`.
* No ID selectors except when required for JS hooks.

### 4.3 Syntax & Values

* Custom properties in `:root`.
* Use `rem` for type scale, `em` for component internal spacing, `%/vh/vw` for layout.
* One blank line between rule sets.
* Keep selector specificity ≤ 0,1,0; avoid `!important`.

### 4.4 Comments

```css
/* Layout grid for product list */
```

Explain purpose; keep to one line.

---

## 5 JavaScript Guidelines

### 5.1 Language & Modules

* ES2020+; each file an ES module (`export`/`import`).

### 5.2 Naming & Declarations

* **camelCase** for variables/functions; **PascalCase** for classes.
* Declare with `const` by default; use `let` only when reassigning; never `var`.

### 5.3 Functions

* Prefer small, pure functions; isolate side‑effects.
* Use arrow functions unless a named function improves stack traces.

### 5.4 Error Handling (Balanced)

* Wrap only external/data‑dependent calls in `try…catch`.
* In `catch`, log details with `console.error(err)` and either:

  1. Return a safe fallback value, **or**
  2. Re‑throw a custom Error with clear message.
* Never swallow errors silently.

### 5.5 Async Patterns

* Prefer `async/await` over Promise chains.
* Always attach a final `catch`.

### 5.6 DOM Interaction

1. Cache selectors (`const $card = document.querySelector(...)`).
2. Use `addEventListener`; no inline event handlers.
3. Clean up listeners in teardown.

### 5.7 Logging & Comments

```js
// Fetch product list; show skeleton until resolved.
```

* Comment *why* not *how*. Don't use JSDoc Style.
* Strip `console.*` before production build except `console.error`.

### 5.8 Libraries

* Default to Vanilla JS; import lightweight library only when native solution > 30 lines.

---

## 6 Performance & Security Basics

* Insert user content with `textContent`, not `innerHTML`, to prevent XSS.


---

**End of guidelines.**
