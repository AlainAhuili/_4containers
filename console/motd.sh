# shellcheck shell=bash
# Welcome banner for interactive login shells (sourced from /etc/profile.d by bash -l)
if [ -n "$PS1" ]; then
  . /etc/os-release
  printf '\n  \033[1;33m%s\033[0m  ·  user \033[1m%s\033[0m (sudo without password)\n' "$PRETTY_NAME" "$(whoami)"
  printf '  Tools: git, vim, nano, tmux, htop, python3 %s, node %s, gcc, curl, jq\n' \
    "$(python3 -c 'import sys;print("%d.%d"%sys.version_info[:2])')" "$(node -v 2>/dev/null)"
  printf '  Install more with: \033[1msudo apt update && sudo apt install <package>\033[0m\n'
  if [ -d "$HOME/workspace" ]; then
    printf '  Workspace (this computer): \033[1;36m~/workspace\033[0m  ·  host services: \033[1mhost.docker.internal:<port>\033[0m\n'
  fi
  printf '\n'
fi
