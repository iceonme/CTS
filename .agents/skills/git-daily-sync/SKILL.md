---
name: git-daily-sync
description: Simple daily Git upload/push and download/pull operations to sync code between multiple computers via GitHub. Use when user mentions uploading/pushing code to GitHub, downloading/pulling code from GitHub, start work, or end work.
---

# Git Daily Sync

Simple two-operation workflow: **Download** (pull) at start, **Upload** (push) at end.

## Operations

### Download (Pull) - 下载

When user starts working and wants to get latest code from GitHub:

```bash
git pull
```

Or use the helper: `scripts/git-sync.ps1 -Action download`

### Upload (Push) - 上传

When user finishes working and wants to save code to GitHub:

```bash
git add .
git commit -m "<message>"
git push
```

Or use the helper: `scripts/git-sync.ps1 -Action upload -Message "描述"`

## Git Aliases

Recommended shortcuts:

```bash
# 下载最新代码
git config --local alias.down pull

# 上传代码（自动 add + commit + push）
git config --local alias.up "!git add -A && git commit -m \"update: $(date +%Y-%m-%d-%H:%M)\" && git push"

# 查看状态
git config --local alias.st "status -sb"
```

Usage:
- `git down` - 下载最新代码
- `git up` - 上传所有更改
- `git st` - 查看当前状态
