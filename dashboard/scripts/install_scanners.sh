#!/usr/bin/env bash
set -euo pipefail

TOOLS_ROOT="${TOOLS_ROOT:-$PWD/dashboard/.tools}"
BIN_DIR="$TOOLS_ROOT/bin"
TMP_DIR="$TOOLS_ROOT/tmp"

mkdir -p "$BIN_DIR" "$TMP_DIR"

install_gitleaks() {
  local version="${GITLEAKS_VERSION:-8.23.3}"
  local tarball="gitleaks_${version#v}_linux_x64.tar.gz"
  local url="https://github.com/gitleaks/gitleaks/releases/download/v${version#v}/${tarball}"

  echo "Installing gitleaks v${version}..."
  curl -fsSL "$url" -o "$TMP_DIR/$tarball"
  tar -xzf "$TMP_DIR/$tarball" -C "$TMP_DIR"
  mv "$TMP_DIR/gitleaks" "$BIN_DIR/gitleaks"
  chmod +x "$BIN_DIR/gitleaks"
}

install_trivy() {
  local version="${TRIVY_VERSION:-0.57.1}"
  local tarball="trivy_${version}_Linux-64bit.tar.gz"
  local url="https://github.com/aquasecurity/trivy/releases/download/v${version}/${tarball}"

  echo "Installing trivy v${version}..."
  curl -fsSL "$url" -o "$TMP_DIR/$tarball"
  tar -xzf "$TMP_DIR/$tarball" -C "$TMP_DIR"
  mv "$TMP_DIR/trivy" "$BIN_DIR/trivy"
  chmod +x "$BIN_DIR/trivy"
}

if ! command -v gitleaks >/dev/null 2>&1 && [[ ! -x "$BIN_DIR/gitleaks" ]]; then
  install_gitleaks
else
  echo "gitleaks already available"
fi

if ! command -v trivy >/dev/null 2>&1 && [[ ! -x "$BIN_DIR/trivy" ]]; then
  install_trivy
else
  echo "trivy already available"
fi

echo "Scanner install complete. Binaries in: $BIN_DIR"
