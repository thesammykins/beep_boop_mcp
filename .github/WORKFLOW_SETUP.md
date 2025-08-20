# GitHub Actions Workflow Setup

This repository uses GitHub Actions for automated building, testing, and publishing. Here's how it works:

## Workflows

### 1. Test Workflow (`test.yml`)
- **Triggers**: On push to any branch except `main`, and on PRs to `main`
- **Purpose**: Run tests and build checks on feature branches
- **Jobs**:
  - Tests across Node.js versions 18, 20, 22
  - TypeScript compilation check
  - Build verification

### 2. Build and Publish Workflow (`build-and-publish.yml`)
- **Triggers**: On push to `main` branch only
- **Purpose**: Build, version, and publish releases
- **Jobs**:
  - **Test**: Full test suite across Node.js versions
  - **Security**: npm audit for vulnerabilities
  - **Publish**: Version bumping, changelog generation, npm publishing, GitHub releases
  - **Notify**: Optional Discord notifications

## Required Secrets

To fully utilize the workflows, configure these repository secrets:

### Required for Publishing
1. **`NPM_TOKEN`**: npm authentication token
   ```bash
   # Get your npm token
   npm login
   npm token create --type=automation
   ```

### Optional for Notifications
2. **`DISCORD_WEBHOOK_URL`**: Discord webhook for release notifications
   - Create a Discord webhook in your server
   - Add the webhook URL to repository secrets

## Setup Instructions

### 1. npm Publishing Setup
1. Ensure you're logged into npm: `npm login`
2. Create an automation token: `npm token create --type=automation`
3. Add the token to GitHub repository secrets as `NPM_TOKEN`

### 2. Semantic Versioning
The workflow automatically determines version bumps based on commit messages:

- **Major version** (1.0.0 → 2.0.0): Include "BREAKING", "breaking", or "major" in commit message
- **Minor version** (1.0.0 → 1.1.0): Include "feat", "feature", or "minor" in commit message  
- **Patch version** (1.0.0 → 1.0.1): All other changes

### 3. Branch Protection (Recommended)
Configure branch protection for `main`:
1. Go to Settings → Branches
2. Add rule for `main` branch
3. Enable:
   - Require status checks to pass before merging
   - Require branches to be up to date before merging
   - Include administrators

## Workflow Behavior

### Feature Branch Development
1. Create feature branch: `git checkout -b feature/my-feature`
2. Make changes and commit
3. Push to GitHub: `git push origin feature/my-feature`
4. GitHub Actions runs test workflow
5. Create PR when ready
6. Tests run again on PR

### Publishing to Main
1. Merge PR to `main` (or push directly)
2. GitHub Actions runs full build and publish workflow:
   - Tests across multiple Node.js versions
   - Security audit
   - Automatic version bumping based on commits
   - Changelog generation
   - npm package publishing
   - GitHub release creation
   - Discord notification (if configured)

### Version Bumping Logic
- Analyzes commit messages since last tag
- Automatically updates `package.json` version
- Creates git tag and pushes back to repository
- Generates/updates `CHANGELOG.md`

## Troubleshooting

### Build Failures
- Check the Actions tab for detailed logs
- Most common issues:
  - TypeScript compilation errors
  - Missing dependencies
  - Test failures
  - npm audit security issues

### Publishing Issues
- Verify `NPM_TOKEN` is set correctly
- Ensure npm package name is available
- Check if version already exists on npm

### Skip Publishing
To push to main without triggering a publish (e.g., for documentation changes):
- Include `[skip ci]` in commit message
- Or make sure no meaningful code changes exist (workflow checks for this)

## Manual Operations

### Manual Version Bump
```bash
npm version patch|minor|major
git push origin main --follow-tags
```

### Manual Publish
```bash
npm run build
npm publish
```

### Testing Locally
```bash
# Test the build
npm run build

# Test with different Node versions using nvm
nvm use 18 && npm ci && npm run build
nvm use 20 && npm ci && npm run build
nvm use 22 && npm ci && npm run build
```
