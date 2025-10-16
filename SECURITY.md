# Security Policy

## Security Audit

This repository has been audited for security vulnerabilities. All identified vulnerabilities have been resolved.

### Audit Date
October 16, 2025

### Vulnerabilities Fixed
- Updated `@octokit/rest` from v21.0.2 to v22.0.0 to fix multiple ReDoS vulnerabilities in transitive dependencies
- Replaced deprecated `vsce` package with `@vscode/vsce` v3.6.2 to fix xml2js prototype pollution vulnerability
- Fixed additional vulnerabilities in transitive dependencies through `npm audit fix`

### Security Best Practices

#### For Users
1. **Personal Access Tokens**: Store your Azure DevOps and GitHub personal access tokens securely in VS Code settings. Never commit tokens to version control.
2. **Token Permissions**: Use the minimum required permissions for personal access tokens as documented in the README.
3. **Regular Updates**: Keep the extension updated to the latest version to ensure you have the latest security fixes.

#### For Developers
1. **Dependency Updates**: Regularly run `npm audit` to check for security vulnerabilities in dependencies.
2. **Automated Audits**: The project uses npm's built-in security audit tools.
3. **Secure Coding**: Avoid storing sensitive information in code. Use VS Code's secure settings storage.

## Reporting a Vulnerability

If you discover a security vulnerability in this extension, please report it by:

1. **Do not** open a public GitHub issue for security vulnerabilities
2. Contact the maintainers directly through GitHub's security advisory feature
3. Provide detailed information about the vulnerability and steps to reproduce

We take security seriously and will respond to security reports as quickly as possible.

## Security Features

- **No Hardcoded Secrets**: The extension does not contain any hardcoded credentials or API keys
- **Secure Token Storage**: Personal access tokens are stored using VS Code's secure settings mechanism
- **HTTPS Only**: All API communications use HTTPS
- **Minimal Permissions**: The extension requests only the minimum necessary permissions

## Dependencies

All production and development dependencies are regularly audited for security vulnerabilities. Current status:

```
npm audit: 0 vulnerabilities
```

### Key Dependencies
- `@octokit/rest`: ^22.0.0 - GitHub API client
- `azure-devops-node-api`: ^14.1.0 - Azure DevOps API client
- `@vscode/vsce`: ^3.6.2 - VS Code extension packaging tool
