#!/bin/bash
# Symlinks all skills installed in .agents/skills/ into .claude/skills/
# Run after updating skills-lock.json to make skills available to Claude Code.
set -e

AGENTS_SKILLS=".agents/skills"
CLAUDE_SKILLS=".claude/skills"

if [ ! -d "$AGENTS_SKILLS" ]; then
  echo "No .agents/skills directory found — nothing to link."
  exit 0
fi

for skill_dir in "$AGENTS_SKILLS"/*/; do
  name=$(basename "$skill_dir")
  target="$CLAUDE_SKILLS/$name"
  if [ -L "$target" ]; then
    echo "Already linked: $name"
  elif [ -e "$target" ]; then
    echo "Skipping $name — non-symlink already exists at $CLAUDE_SKILLS/$name"
  else
    ln -sf "../../$AGENTS_SKILLS/$name" "$target"
    echo "Linked: $name"
  fi
done
