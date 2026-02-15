---
name: git-daily-sync
description: Simple daily Git upload/push and download/pull operations to sync code between multiple computers via GitHub. Use when user mentions uploading/pushing code to GitHub, downloading/pulling code from GitHub, start work, or end work.
---

# Git Daily Sync

Simple two-operation workflow: **Download** (pull) at start, **Upload** (push) at end.

## Private Repository Setup (First Time)

For private repos, you need a GitHub Personal Access Token (PAT):

1. Go to GitHub → Settings → Developer settings → Personal access tokens → Generate new token
2. Select scope: `repo` (full control of private repositories)
3. Copy the token

### Clone Private Repo
```bash
git clone https://<USERNAME>:<TOKEN>@github.com/<owner>/<repo>.git
```

### Or Update Existing Repo Remote
```bash
git remote set-url origin https://<USERNAME>:<TOKEN>@github.com/<owner>/<repo>.git
```

### Secure Alternative: Use Git Credential Helper
```bash
# Store credentials securely
git config --global credential.helper store

# Then normal clone (will prompt for username/password once)
git clone https://github.com/<owner>/<repo>.git
# Username: your GitHub username
# Password: your Personal Access Token (not your GitHub password)
```

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
