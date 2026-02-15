#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Git daily sync - simple upload/download operations

.DESCRIPTION
    Simple two-operation workflow: download (pull) at start, upload (push) at end.

.PARAMETER Action
    Action to perform: download (pull), upload (push)

.PARAMETER Message
    Commit message for upload action (optional, defaults to timestamp)

.EXAMPLE
    .\git-sync.ps1 -Action download
    Download/pull latest code from GitHub

.EXAMPLE
    .\git-sync.ps1 -Action upload -Message "Added login feature"
    Upload/push changes to GitHub
#>
param(
    [Parameter(Mandatory)]
    [ValidateSet("download", "upload")]
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
    "download" {
        Write-Info "Downloading latest code from GitHub..."
        
        # Check for local changes
        $hasChanges = git status --porcelain
        $stashed = $false
        
        if ($hasChanges) {
            Write-Info "Local changes detected, temporarily saving..."
            git stash push -m "auto-stash before download $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
            if ($LASTEXITCODE -ne 0) {
                Write-Error "Failed to save changes"
                exit 1
            }
            $stashed = $true
        }
        
        # Pull
        git pull
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Download failed"
            exit 1
        }
        
        # Restore stash if we saved
        if ($stashed) {
            Write-Info "Restoring your local changes..."
            git stash pop
            if ($LASTEXITCODE -ne 0) {
                Write-Error "Failed to restore your changes. Run 'git stash list' to recover."
                exit 1
            }
        }
        
        Write-Success "Download complete!"
    }
    
    "upload" {
        Write-Info "Uploading changes to GitHub..."
        
        # Check for changes
        $hasChanges = git status --porcelain
        if (-not $hasChanges) {
            # Check if there are unpushed commits
            $unpushed = git log --branches --not --remotes --oneline 2>$null
            if ($unpushed) {
                Write-Info "No new changes, but found unpushed commits"
            } else {
                Write-Info "No changes to upload"
                exit 0
            }
        }
        
        # Stage all changes
        git add -A
        
        # Commit
        $commitMsg = if ($Message) { $Message } else { "Update: $(Get-Date -Format 'yyyy-MM-dd HH:mm')" }
        git commit -m "$commitMsg"
        if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne 1) {  # Exit 1 = nothing to commit
            Write-Error "Commit failed"
            exit 1
        }
        
        # Push
        git push
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Upload failed"
            exit 1
        }
        
        Write-Success "Upload complete!"
    }
}
