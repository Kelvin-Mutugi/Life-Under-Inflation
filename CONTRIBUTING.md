# Contributing to Life Under Inflation

Thank you for your interest in contributing. This project aims to be approachable and easy to extend. Please follow the guidelines below to make your contributions smooth and reviewable.

## How to contribute

1. Fork the repository and create a new branch for your work: `git checkout -b feature/brief-description`.
2. Make changes in a focused, atomic manner with clear commit messages.
3. Run the app and any tests locally before opening a Pull Request.
4. Open a Pull Request (PR) against `main` with a clear description of the change, motivation, and any relevant screenshots or recordings.

## Issues

- Before opening a new issue, search existing issues to avoid duplicates.
- For bug reports include: steps to reproduce, expected vs actual behavior, environment (node version, OS), and minimal reproduction steps if possible.

## Code style and quality

- JavaScript/JSX should follow common conventions. Run `npm install` and use the editor tooling for linting/formatting.
- Keep functions small and focused; prefer clear variable names and inline comments for non-obvious logic.

## Testing

- Add tests for any non-trivial logic where appropriate. Currently the project does not include a test framework; if you add tests, include instructions for running them in your PR description.

## Pull Request checklist

- [ ] Branch contains a single logical change
- [ ] Code builds and runs locally (`npm install && npm run dev`)
- [ ] Changes are documented in the README or another relevant file
- [ ] PR description explains the motivation, changes, and how to test

## Communication & support

If you have questions or need design/behavior guidance, open an issue to start discussion before implementing large changes.

## License

By contributing, you agree that your contributions will be licensed under the repository's license (see `LICENSE`).
