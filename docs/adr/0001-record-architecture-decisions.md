# ADR 0001: Record Architecture Decisions

**Status:** Accepted
**Date:** 2026-07-19

## Context

TribeOS needs a lightweight, durable record of significant architectural decisions so that engineers and AI assistants understand *why* the system is built the way it is.

## Decision

We will use Architecture Decision Records (ADRs). Each ADR is a numbered Markdown file in `docs/adr/` and follows the format: Context, Decision, Consequences. ADRs are immutable once accepted; superseding decisions create a new ADR that references the old one.

## Consequences

- A clear, chronological history of architectural choices.
- New contributors (human or AI) can quickly understand the reasoning behind the system.
- Superseded decisions remain visible for context rather than being deleted.
