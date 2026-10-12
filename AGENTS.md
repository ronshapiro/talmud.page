# Agent Guidelines & Repository Conventions

This document outlines conventions and instructions for autonomous coding agents working on `talmud.page`.

## Domain Terminology

### `ref` / `refs` (Sefaria Citation Identifiers)
- **Do NOT rename `ref` or `refs` to `reference` or `references`.**
- In this codebase, the Jewish literature corpus, and Sefaria's APIs and data models, `ref` is the canonical domain term for a textual citation or passage identifier (e.g., `"Bava Kamma 2a"`, `"Genesis 1:1"`, `"Berakhot 2a:1"`).
- Retain `ref` and `refs` in variable names, parameter names, function names, and file names (e.g., `ref`, `refs`, `mergeRefs`, `refSorter`, `refSuffixIndex`).

## Code Style & Variable Naming
- Except for domain terms like `ref` / `refs` and standard loop index variables (`i`, `j`), all variable names should be spelled out with full words. Avoid arbitrary abbreviations.

## Git Commit & Pull Request Guidelines
- Write commit messages and PR titles as concise, complete, and proper sentences (capitalize the first word, express actions clearly).
- Do **NOT** use Conventional Commit prefixes such as `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `test:`, or `style:`.
- **Examples**:
  - ✅ `Break non-contiguous Talmud page ranges into separate chunks in PR titles`
  - ✅ `Sort Talmud pages and reference ranges in strict page order`
  - ❌ `feat: break non-contiguous page ranges`
  - ❌ `fix: page ordering in title`

## Git Safety Guidelines
- **NEVER** run `git push --force`, `git push -f`, `git push --force-with-lease`, or any flag that forces an overwrite of remote branch history.
- Always perform standard, non-destructive `git push` commands (`git push` or `git push -u origin HEAD`).
- Open or update Pull Requests automatically once work is completed, committed, and verified.
