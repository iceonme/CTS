---
name: git-daily-sync
description: Simple daily Git upload/push and download/pull operations to sync code between multiple computers via GitHub. Use when user mentions uploading/pushing code to GitHub, downloading/pulling code from GitHub, start work, or end work.
---

# Git Daily Sync

Simple two-operation workflow: **Download** (pull) at start, **Upload** (push) at end.

## Repository Info

- **Owner**: iceonme
- **Repo**: cts
- **Token**: <YOUR_GITHUB_TOKEN>

## Setup (First Time - Already Done)

```bash
# Remote URL already configured with token
git remote set-url origin https://iceonme:<YOUR_GITHUB_TOKEN>@github.com/iceonme/cts.git
```

## Operations

### Download (Pull) - 下载代码

Get latest code from GitHub:

```bash
cd /home/iceonme/CTS && git pull
```

### Upload (Push) - 上传代码

Save local changes to GitHub:

```bash
cd /home/iceonme/CTS && git add . && git commit -m "update: $(date +%Y-%m-%d-%H:%M)" && git push
```

## Git Aliases (Optional)

```bash
# 配置别名
git config --local alias.down "pull"
git config --local alias.up "!git add -A && git commit -m \"update: $(date +%Y-%m-%d-%H:%M)\" && git push"
git config --local alias.st "status -sb"

# 使用
git down   # 下载最新代码
git up     # 上传所有更改
git st     # 查看状态
```
