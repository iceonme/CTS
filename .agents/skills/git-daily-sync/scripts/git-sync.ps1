#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Git daily sync helper script

.DESCRIPTION
    Helps automate daily Git sync workflow - pull at start of work, push at end.

.PARAMETER Action
    Action to perform: pull, push, sync (pull then push)

.PARAMETER Message
    Commit message for push action (optional, defaults to timestamp)

.EXAMPLE
    .\git-sync.ps1 -Action pull
    Pull latest changes from GitHub

.EXAMPLE
    .\git-sync.ps1 -Action push -Message "End of day progress"
    Commit and push changes to GitHub

.EXAMPLE
    .\git-sync.ps1 -Action sync
    Pull then push (sync with remote)
#>
param(
    [Parameter(Mandatory)]
    [ValidateSet("pull", "push", "sync")]
    [string]$Action,
    
    [string]$Message = ""
)

# Colors for output
$Green = "`e[32m"
$Yellow = "`e[33m"
$Red = "`e[31m"
$Reset = "`e[0m"

function Write-Info($msg) { Write-Host "${Yellow}[INFO]${Reset} $msg" }
function Write-Success($msg) { Write-Host "${Green}[OK]${Reset} $msg" }
function Write-Error($msg) { Write-Host "${Red}[ERROR]${Reset} $msg" }

# Check if we're in a git repo
$gitRoot = git rev-parse --show-toplevel 2>$null
if (-not $gitRoot) {
    Write-Error "Not a git repository"
    exit 1
}

Write-Info "Working in: $gitRoot"

switch ($Action) {
    "pull" {
        Write-Info "Pulling latest changes from GitHub..."
        
        # Check for local changes
        $hasChanges = git status --porcelain
        $stashed = $false
        
        if ($hasChanges) {
            Write-Info "Local changes detected, stashing..."
            git stash push -m "auto-stash before pull $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
            if ($LASTEXITCODE -ne 0) {
                Write-Error "Failed to stash changes"
                exit 1
            }
            $stashed = $true
        }
        
        # Pull
        git pull
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Pull failed"
            exit 1
        }
        
        # Pop stash if we stashed
        if ($stashed) {
            Write-Info "Restoring local changes..."
            git stash pop
            if ($LASTEXITCODE -ne 0) {
                Write-Error "Failed to restore stashed changes. Run 'git stash list' to recover."
                exit 1
            }
        }
        
        Write-Success "Pull complete!"
    }
    
    "push" {
        Write-Info "Pushing changes to GitHub..."
        
        # Check for changes
        $hasChanges = git status --porcelain
        if (-not $hasChanges) {
            Write-Info "No changes to commit"
            # Still try to push in case there are unpushed commits
            git push
            exit 0
        }
        
        # Stage all
        git add .
        
        # Commit
        $commitMsg = if ($Message) { $Message } else { "WIP: $(Get-Date -Format 'yyyy-MM-dd HH:mm')" }
        git commit -m "$commitMsg"
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Commit failed"
            exit 1
        }
        
        # Push
        git push
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Push failed"
            exit 1
        }
        
        Write-Success "Push complete!"
    }
    
    "sync" {
        Write-Info "Syncing with GitHub (pull then push)..."
        
        # Pull with stash handling
        $hasChanges = git status --porcelain
        $stashed = $false
        
        if ($hasChanges) {
            Write-Info "Local changes detected, stashing..."
            git stash push -m "auto-stash before sync $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
            $stashed = $true
        }
        
        git pull
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Pull failed"
            exit 1
        }
        
        if ($stashed) {
            git stash pop
        }
        
        # Push if there are now changes to push
        $hasChanges = git status --porcelain
        $unpushed = git log --branches --not --remotes --oneline
        
        if ($hasChanges -or $unpushed) {
            if ($hasChanges) {
                git add .
                $commitMsg = if ($Message) { $Message } else { "Sync: $(Get-Date -Format 'yyyy-MM-dd HH:mm')" }
                git commit -m "$commitMsg"
            }
            git push
            if ($LASTEXITCODE -ne 0) {
                Write-Error "Push failed"
                exit 1
            }
        } else {
            Write-Info "Nothing to push"
        }
        
        Write-Success "Sync complete!"
    }
}
