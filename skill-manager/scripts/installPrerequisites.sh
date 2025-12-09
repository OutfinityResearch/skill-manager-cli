#!/bin/sh

# Installs Git on node:22.20-alpine images via apk and runs npm install.
set -eu

# Install git if not present
if ! command -v git >/dev/null 2>&1; then
    if ! command -v apk >/dev/null 2>&1; then
        printf '%s\n' "apk is not available. This script must run on an Alpine-based Node image." >&2
        exit 1
    fi

    SUDO=""
    if [ "$(id -u)" -ne 0 ]; then
        if command -v sudo >/dev/null 2>&1; then
            SUDO="sudo"
        else
            printf '%s\n' "Root privileges are required to install git. Re-run as root or install sudo." >&2
            exit 1
        fi
    fi

    run_pkg_cmd() {
        if [ -n "$SUDO" ]; then
            "$SUDO" "$@"
        else
            "$@"
        fi
    }

    run_pkg_cmd apk update
    run_pkg_cmd apk add --no-cache git
    printf 'Installed %s\n' "$(git --version)"
else
    printf 'Git is already installed: %s\n' "$(git --version)"
fi

# Run npm install to install dependencies (including achillesAgentLib via postinstall)
cd /code
npm install --omit=dev

printf 'skill-manager-cli dependencies installed successfully.\n'
