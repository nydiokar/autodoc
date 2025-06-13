# --- Local Test Runner for Autodoc (PowerShell) ---
# This script simulates the GitHub Actions environment for proper local testing on Windows.
#
# HOW TO USE:
#
# 1. CLONE THE TARGET REPOSITORY:
#    You need a local copy of the repository you want to run this tool against.
#    For example: git clone https://github.com/nydiokar/analyzer.git ../analyzer
#    (This clones it into a folder named 'analyzer' next to your 'autodoc' folder).
#
# 2. CONFIGURE THE TEST PATH:
#    Update the `$TargetRepoPath` variable below to point to your local clone.
#
# 3. SET UP YOUR .env FILE:
#    In this directory (`autodoc/`), create a file named `.env` with your secrets:
#    GH_PAT=ghp_YourPersonalAccessToken
#    OPENAI_API_KEY=sk-YourOpenApiKey
#
# 4. RUN THE SCRIPT:
#    From your PowerShell terminal in this `autodoc/` directory, run:
#    npm run test:local
#
# ------------------------------------------------------------------------------------

# Exit on any error
$ErrorActionPreference = "Stop"

# --- Test Configuration ---
# IMPORTANT: Set this path to your local clone of the repository you want to test against.
$TargetRepoPath = "C:\Users\Cicada38\Projects\autodoc"

# --- Environment Simulation ---
# These variables mimic the GitHub Actions environment.
$env:GITHUB_WORKSPACE = $TargetRepoPath
$env:GITHUB_REPOSITORY = "nydiokar/autodoc" # The "owner/repo" name for the target repo
$env:INPUT_ROOT_DIRECTORY = "src"
$env:INPUT_PULL_NUMBER = ""
$env:INPUT_EXCLUDED_DIRECTORIES = "node_modules,dist,test"
$env:INPUT_REVIEWERS = "nydiokar"
$env:INPUT_BRANCH = "main"
$env:INPUT_JSDOC = "T"
$env:INPUT_README = "F"
# --------------------------

Write-Host "▶️ Building the autodoc project..."
npm run build
Write-Host "✅ Build complete."

Write-Host "▶️ Running documentation generator on target repository: $TargetRepoPath"

# Change the working directory to the target repo so the tool runs in the correct context
Push-Location -Path $TargetRepoPath

# Load secrets from the .env file in the autodoc directory and execute the main script
# Note: We must use an absolute path to the script and the .env file now.
dotenv --path "$($PSScriptRoot)\.env" -- node "$($PSScriptRoot)\dist\index.js"

# Return to the original directory
Pop-Location

Write-Host "✅ Local run finished successfully." 