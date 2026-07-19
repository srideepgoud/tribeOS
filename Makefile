# TribeOS — developer task runner (Unix/CI convenience).
# On Windows, run the equivalent pnpm/uv commands directly (see README),
# or use `make` via Git Bash / WSL.
#
# Targets delegate to each app's toolchain and activate as milestone phases land:
#   - JS/TS workspace: pnpm
#   - Python backend:  uv (in apps/backend)

.PHONY: help install lint format format-check typecheck test build dev

help:
	@echo "TribeOS make targets:"
	@echo "  install       Install all workspace dependencies (pnpm + uv)"
	@echo "  lint          Run linters across the monorepo"
	@echo "  format        Apply formatters"
	@echo "  format-check  Verify formatting"
	@echo "  typecheck     Run type checkers"
	@echo "  test          Run tests"
	@echo "  build         Build all buildable packages"
	@echo "  dev           Run dev servers"

install:
	pnpm install
	cd apps/backend && uv sync

lint:
	pnpm -r --if-present lint

format:
	pnpm -r --if-present format

format-check:
	pnpm -r --if-present format:check

typecheck:
	pnpm -r --if-present typecheck

test:
	pnpm -r --if-present test

build:
	pnpm -r --if-present build

dev:
	pnpm -r --parallel --if-present dev
