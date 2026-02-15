---
name: git-daily-sync
description: Daily Git synchronization workflow for keeping code in sync across multiple machines via GitHub. Use when user mentions starting work (pull/download from GitHub), ending work (push/upload to GitHub), or daily git sync operations.
---

# Git Daily Sync

Manage daily Git synchronization workflow to keep code synced across multiple computers via GitHub.

## Workflow

### Start Work (Download from GitHub)

When user starts working (e.g., "开始工作", "上班了", "pull最新代码"):

1. Check git status to see if there are local changes
2. If clean: `git pull` to get latest from GitHub
3. If has local changes:
   - Stash them: `git stash push -m "auto-stash before pull"`
   - Pull: `git pull`
   - Pop stash: `git stash pop`

### End Work (Upload to GitHub)

When user ends working (e.g., "结束工作", "下班了", "push到GitHub"):

1. Check git status
2. Stage all changes: `git add .`
3. Commit with timestamp: `git commit -m "WIP: <timestamp>"` or user-provided message
4. Push to GitHub: `git push`

### Quick Sync (Pull then Push)

When user wants to sync: `git pull && git push`

## Common Aliases Setup

If not already configured, suggest these Git aliases:

```bash
git config --local alias.pl pull
git config --local alias.ps push
git config --local alias.st status
git config --local alias.sync "!git pull && git push"
git config --local alias.s "status -sb"
```

## Scripts

Use `scripts/git-sync.ps1` for automated sync operations:

```powershell
# Pull with auto-stash support
.\scripts\git-sync.ps1 -Action pull

# Push with auto-commit
.\scripts\git-sync.ps1 -Action push -Message "Your message"

# Sync (pull then push)
.\scripts\git-sync.ps1 -Action sync
```
