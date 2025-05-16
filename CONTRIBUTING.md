# Contributing to Fastly.JS

Thank you for your interest in contributing to Fastly.JS! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md) to foster an open and welcoming environment.

## Getting Started

1. Fork the repository on GitHub
2. Clone your fork to your local machine
3. Install dependencies with `bun install`
4. Create a new branch for your changes
5. Make your changes and add tests
6. Run the tests with `bun run test`
7. Commit your changes and push to your fork
8. Submit a pull request

## Development Environment

Fastly.JS requires the following tools:

- [Bun](https://bun.sh) runtime (v1.0.0 or higher)
- Node.js 16+ (for some development tools)
- Git

## Project Structure

- `src/`: Core implementation files
  - `vcl.ts`: Main VCL interface for loading and executing VCL files
  - `vcl-parser.ts`: VCL lexer and parser
  - `vcl-compiler.ts`: Compiles VCL AST to executable functions
  - `vcl-types.ts`: TypeScript type definitions for VCL
- `test/`: Test suites and framework
- `fastly-vcl/`: Documentation and specifications for Fastly VCL
  - `vcl-functions/`: Detailed documentation for all VCL functions
- `docs/`: Documentation for users
- `examples/`: Example VCL configurations

## Coding Standards

- Use TypeScript for all new code
- Follow the existing code style
- Use meaningful variable and function names
- Add comments for complex logic
- Write unit tests for new features
- Update documentation for user-facing changes

## Pull Request Process

1. Ensure your code follows the coding standards
2. Update the documentation if necessary
3. Add or update tests as appropriate
4. Make sure all tests pass
5. Update the README.md or other documentation if necessary
6. Submit a pull request with a clear description of the changes

## Testing

Fastly.JS has a comprehensive test suite. To run the tests:

```bash
bun run test
```

To run specific test suites:

```bash
bun run test:basic
bun run test:stdlib
bun run test:caching
bun run test:backend
```

When adding new features, please add appropriate tests. See the [test README](test/README.md) for more information on writing tests.

## Documentation

Documentation is a crucial part of Fastly.JS. When adding new features or making changes, please update the documentation accordingly.

- Update the README.md if necessary
- Update or add documentation in the docs/ directory
- Add examples for new features
- Update the TECHNICAL_DETAILS.md file for technical changes

## Feature Requests

If you have an idea for a new feature, please open an issue on GitHub with the following information:

- A clear and descriptive title
- A detailed description of the feature
- Any relevant examples or use cases
- Any potential implementation details

## Bug Reports

If you find a bug, please open an issue on GitHub with the following information:

- A clear and descriptive title
- A detailed description of the bug
- Steps to reproduce the bug
- Expected behavior
- Actual behavior
- Any relevant logs or error messages
- Your environment (OS, Bun version, etc.)

## License

By contributing to Fastly.JS, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).

## Contact

If you have any questions or need help, you can:

- Open an issue on GitHub
- Join the community discussion on [Discord/Slack/etc.]
- Email the maintainers at [email@example.com]

Thank you for contributing to Fastly.JS!
