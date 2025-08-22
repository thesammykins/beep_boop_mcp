# Changelog

## [1.2.0] - 2025-08-22

- feat(ingress): add Slack Socket Mode and Discord gateway listeners, file-based inbox, local HTTP endpoint, and update_user MCP tool
- chore(ingress): fix http ESM import and add src/.gitignore entries
- fix(ingress): lazy-load provider listeners and adjust Slack Bolt import for ESM interop
- docs(ingress): add INGRESS quickstart, SCOPES_INTENTS, and README updates for Discord-first test and update_user tool
- docs(ingress): add step-by-step token acquisition for Slack Socket Mode and Discord, plus HTTP bearer token guidance
- feat(ingress): default inbox to /Users/samanthamyers, create Discord threads and capture replies, post updates into threads, auto-start ingress with MCP server; docs updated
- working mcp conversation tool
- feat: comprehensive documentation validation and update
- feat: add comprehensive ingress/listener system for Discord and Slack integration
- Merge pull request #1 from thesammykins/feature/ingress-listener

## [1.1.3] - 2025-08-20

- fix: Correct package scope from @thesammykis to @thesammykins
- Merge branch 'main' with corrected package scope

## [1.1.2] - 2025-08-20

- fix: Configure npm package for public publishing
- Merge branch 'main' of https://github.com/thesammykins/beep_boop_mcp

## [1.1.1] - 2025-08-20

- docs: Add automated publishing note to README and test NPM_TOKEN workflow
- Merge branch 'main' of https://github.com/thesammykins/beep_boop_mcp

## [1.1.0] - 2025-08-20

- feat: Complete Beep/Boop MCP Server with configuration system
- docs: Update repository URLs and package metadata
- Update README.md
- feat: Add automatic .gitignore management for beep/boop coordination files
- Merge branch 'main' of https://github.com/thesammykins/beep_boop_mcp
- feat: implement comprehensive webhook notifications for Discord and Slack
- feat: Add GitHub Actions workflows for automated testing and publishing
- feat: Configure package for npx compatibility and scoped publishing
- fix: Resolve GitHub Actions CHANGELOG update sed syntax error
- fix: Add proper GitHub Actions permissions for repository access

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2025-08-20

### Added
- GitHub Actions workflows for automated testing and publishing
- Comprehensive workflow documentation
- Automated version bumping based on commit messages
- Automatic changelog generation

### Changed  
- Updated npm test script to be workflow-friendly
- Enhanced .npmignore to exclude GitHub Actions files

## [1.0.0] - Previous

Initial release of beep-boop-mcp-server with core coordination functionality.
