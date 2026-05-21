# Contributing to iPmartGit

Thank you for your interest in contributing to iPmartGit! This document provides guidelines and information for contributors.

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/iPmartNetwork/iPmartGit/issues)
2. If not, create a new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Node.js version and OS

### Suggesting Features

1. Open an issue with the `enhancement` label
2. Describe the feature and its use case
3. Explain why it would be useful

### Submitting Code

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Test your changes locally
5. Commit with a clear message: `git commit -m 'Add: my new feature'`
6. Push to your fork: `git push origin feature/my-feature`
7. Open a Pull Request

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/iPmartGit.git
cd iPmartGit

# Install dependencies
npm install

# Run in development mode (auto-reload)
npm run dev
```

## Code Style

- Use 2 spaces for indentation
- Use single quotes for strings
- Add comments for complex logic
- Keep functions small and focused
- Use meaningful variable names

## Commit Messages

Format: `Type: Description`

Types:
- `Add:` — New feature
- `Fix:` — Bug fix
- `Update:` — Improvement to existing feature
- `Remove:` — Removed feature or file
- `Docs:` — Documentation changes
- `Style:` — CSS/UI changes
- `Refactor:` — Code refactoring

## Project Structure

- `server.js` — Main entry point
- `routes/` — Express route handlers
- `db/` — Database schema and connection
- `lib/` — Utility libraries
- `public/` — Frontend files (HTML, CSS, JS)
- `scripts/` — Setup and utility scripts

## Questions?

Feel free to open an issue or reach out to the maintainers.
