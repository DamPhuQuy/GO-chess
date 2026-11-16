#!/usr/bin/env bash
# ==============================================================================
# Turnkey Environment Bootstrap & Baseline Verifier
# Part of SACH-2026 Engineering Harness (Learn Harness Engineering Standard)
# ==============================================================================
# Usage:
#   ./init.sh                     # Verify baseline and display start command (safe default, skips install)
#   INSTALL_DEPS=1 ./init.sh      # Opt in to install dependencies (runs lifecycle hooks), verify, display start
#   ./init.sh --install           # Flag alias to opt in to dependency installation
#   RUN_START_COMMAND=1 ./init.sh # Verify baseline and automatically run start command
# ==============================================================================

set -euo pipefail

# Run from the scaffolded project root, even when invoked from another directory.
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

# Overrides are trusted project configuration and may contain shell syntax.
# Never fill them from issue text, web pages, or tool output.
INSTALL_CMD="${INSTALL_CMD:-}"
VERIFY_CMD="${VERIFY_CMD:-}"
START_CMD="${START_CMD:-}"
INSTALL_DEPS="${INSTALL_DEPS:-0}"
SYNC_SKILLS="${SYNC_SKILLS:-0}"
INSTALL_CMD_WAS_PROVIDED=0
if [[ -n "$INSTALL_CMD" ]]; then
  INSTALL_CMD_WAS_PROVIDED=1
fi

for arg in "$@"; do
  case "$arg" in
    --install|--with-install) INSTALL_DEPS=1 ;;
    --skills|--with-skills) SYNC_SKILLS=1 ;;
  esac
done

manager=''
if [[ -f backend/package-lock.json && -f frontend/package-lock.json ]]; then
  INSTALL_CMD="${INSTALL_CMD:-npm ci --prefix backend && npm ci --prefix frontend}"
  VERIFY_CMD="${VERIFY_CMD:-npm run build --prefix backend && npm run typecheck --prefix backend && npm run build --prefix frontend}"
  START_CMD="${START_CMD:-docker compose up --build}"
elif [[ -z "$INSTALL_CMD" || -z "$VERIFY_CMD" || -z "$START_CMD" ]]; then
  lockfiles=()
  for file in package-lock.json npm-shrinkwrap.json pnpm-lock.yaml yarn.lock bun.lock bun.lockb uv.lock; do
    [[ -f "$file" ]] && lockfiles+=("$file")
  done
  if (( ${#lockfiles[@]} != 1 )); then
    echo "Specify INSTALL_CMD, VERIFY_CMD and START_CMD when no single supported lockfile is present." >&2
    exit 2
  fi
  case "${lockfiles[0]}" in
    package-lock.json|npm-shrinkwrap.json) manager=npm; install_default=(npm ci); verify_default=(npm test); start_default=(npm run dev) ;;
    pnpm-lock.yaml) manager=pnpm; install_default=(pnpm install --frozen-lockfile); verify_default=(pnpm test); start_default=(pnpm run dev) ;;
    yarn.lock)
      manager=yarn
      if [[ -f package.json ]] && node -e 'const p=require("./package.json"); process.exit(/^yarn@[2-9]/.test(p.packageManager || "") ? 0 : 1)' 2>/dev/null; then
        install_default=(yarn install --immutable)
      else
        install_default=(yarn install --frozen-lockfile)
      fi
      verify_default=(yarn test); start_default=(yarn dev) ;;
    bun.lock|bun.lockb) manager=bun; install_default=(bun install --frozen-lockfile); verify_default=(bun test); start_default=(bun run dev) ;;
    uv.lock) manager=uv; install_default=(uv sync --locked); verify_default=(uv run pytest); start_default=(uv run python -m app) ;;
  esac
fi

run_command() {
  local override="$1"
  shift
  if [[ -n "$override" ]]; then
    bash -c "$override"
  else
    "$@"
  fi
}

show_command() {
  local override="$1"
  shift
  if [[ -n "$override" ]]; then printf '%s' "$override"; else printf '%s ' "$@"; fi
}

# --- Color formatting ---
BOLD='\033[1m'
GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RESET='\033[0m'

echo -e "${BOLD}${CYAN}=== [Harness Environment Bootstrap] ===${RESET}"
echo -e "${BOLD}Repository root:${RESET} $(pwd)"
echo -e "${BOLD}Timestamp:${RESET} $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo ""

# 1. Dependency installation (opt-in to protect against unreviewed postinstall lifecycle scripts)
echo -e "${BOLD}${YELLOW}>>> Step 1: Dependency installation...${RESET}"
if [[ "$INSTALL_DEPS" == "1" || "$INSTALL_CMD_WAS_PROVIDED" == "1" ]]; then
  echo -e "Command: ${CYAN}$(show_command "$INSTALL_CMD" "${install_default[@]:-}")${RESET}"
  run_command "$INSTALL_CMD" "${install_default[@]:-}"
  echo -e "${GREEN}✓ Dependencies installed successfully.${RESET}\n"
else
  echo -e "${CYAN}ℹ Skipping automatic dependency installation (safe opt-in default).${RESET}"
  echo -e "  To execute package installation and lifecycle scripts, run with:"
  echo -e "  ${BOLD}INSTALL_DEPS=1 ./init.sh${RESET} or ${BOLD}./init.sh --install${RESET}."
  echo -e "  Command that would run: ${CYAN}$(show_command "$INSTALL_CMD" "${install_default[@]:-}")${RESET}\n"
fi

# 2. Skill manifest inspection (optional declared-skill integration)
if [[ -f .agents/skills-manifest.json ]]; then
  echo -e "${BOLD}${YELLOW}>>> Step 2: Skill Stack Inspection...${RESET}"
  if [[ "$SYNC_SKILLS" == "1" ]]; then
    echo -e "${CYAN}ℹ Inspecting declared skill stack from .agents/skills-manifest.json...${RESET}"
    if command -v python3 >/dev/null 2>&1; then
      python3 -c '
import json
try:
    with open(".agents/skills-manifest.json") as f:
        data = json.load(f)
    skills = [s.get("id") for s in data.get("skills", [])]
    names = ", ".join(skills)
    print("Declared skills (" + str(len(skills)) + "): " + names)
except Exception:
    pass
'
    fi
    echo -e "${GREEN}✓ Skill manifest loaded.${RESET}\n"
  else
    echo -e "${CYAN}ℹ Project declares skills manifest at .agents/skills-manifest.json.${RESET}"
    echo -e "  To inspect declared skills during bootstrap, run with: ${BOLD}SYNC_SKILLS=1 ./init.sh${RESET} or ${BOLD}./init.sh --skills${RESET}.\n"
  fi
fi

# 3. Baseline verification
echo -e "${BOLD}${YELLOW}>>> Step 3: Running baseline verification...${RESET}"
echo -e "Command: ${CYAN}$(show_command "$VERIFY_CMD" "${verify_default[@]:-}")${RESET}"
if run_command "$VERIFY_CMD" "${verify_default[@]:-}"; then
  echo -e "${GREEN}✓ Baseline verification PASSED. Environment is clean and ready.${RESET}\n"
else
  echo -e "${RED}✗ Baseline verification FAILED!${RESET}"
  echo -e "${RED}HALT: Agent must repair baseline failures before introducing any new changes.${RESET}"
  exit 1
fi

# 4. Start command handling
echo -e "${BOLD}${YELLOW}>>> Step 4: Application runtime command${RESET}"
echo -e "Start command: ${CYAN}$(show_command "$START_CMD" "${start_default[@]:-}")${RESET}"
if [ "${RUN_START_COMMAND:-0}" = "1" ]; then
  echo -e "${GREEN}Executing start command...${RESET}"
  if [[ -n "$START_CMD" ]]; then exec bash -c "$START_CMD"; else exec "${start_default[@]}"; fi
else
  echo -e "${BOLD}To start the service manually, execute:${RESET} ${CYAN}$(show_command "$START_CMD" "${start_default[@]:-}")${RESET}"
  echo -e "${GREEN}=== Bootstrap complete. Ready for task execution ===${RESET}"
fi
