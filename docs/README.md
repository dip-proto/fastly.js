# Fastly.JS Documentation

Welcome to the Fastly.JS documentation! This guide will help you understand how to use Fastly.JS to create a local development environment for testing and deploying Fastly VCL configurations.

## What is Fastly.JS?

Fastly.JS is a reimplementation of the Fastly platform in JavaScript/TypeScript. It provides a local development environment for testing and deploying Fastly VCL configurations without requiring the actual Fastly infrastructure.

With Fastly.JS, you can:

- Test VCL configurations locally before deploying to Fastly
- Develop and debug VCL code without incurring Fastly usage costs
- Learn VCL in a controlled environment
- Create a CI/CD pipeline for VCL development
- Simulate Fastly's edge computing capabilities

## Documentation Structure

This documentation is organized into the following sections:

### [Getting Started](./getting-started.md)

A step-by-step guide to installing and setting up Fastly.JS, including your first VCL configuration.

### Tutorials

Learn how to use Fastly.JS through a series of tutorials:

1. [Basic VCL Syntax and Structure](./tutorials/01-basic-vcl-syntax.md)
2. [Request and Response Handling](./tutorials/02-request-response-handling.md)
3. [Caching Strategies](./tutorials/03-caching-strategies.md)
4. [Backend Configuration](./tutorials/04-backend-configuration.md)
5. [Error Handling](./tutorials/05-error-handling.md)
6. [Advanced Features](./tutorials/06-advanced-features.md)

### Examples

Real-world examples of VCL configurations:

- [Basic Caching](./examples/basic-caching.md)
- [A/B Testing](./examples/ab-testing.md)
- [Content Rewriting](./examples/content-rewriting.md)
- [Access Control](./examples/access-control.md)
- [Load Balancing](./examples/load-balancing.md)
- [Error Pages](./examples/error-pages.md)

### Features

Detailed documentation for specific features:

- [Edge Side Includes (ESI)](./features/edge-side-includes.md)
- [Goto Statements](./goto.md)
- [Restart Functionality](./reference/restart.md)

### API Reference

Documentation for the JavaScript/TypeScript API:

- [VCL Parser](./api/vcl-parser.md)
- [VCL Compiler](./api/vcl-compiler.md)
- [VCL Runtime](./api/vcl-runtime.md)
- [HTTP Object Model](./api/http-object-model.md)
- [Caching System](./api/caching-system.md)
- [Standard Library](./api/standard-library.md)

### Reference

Reference documentation for VCL:

- [VCL Subroutines](./reference/vcl-subroutines.md)
- [VCL Variables](./reference/vcl-variables.md)
- [VCL Functions](./reference/vcl-functions.md)
- [VCL Statements](./reference/vcl-statements.md)
- [VCL Operators](./reference/vcl-operators.md)

### [Troubleshooting](./troubleshooting.md)

Common issues and solutions, debugging techniques, and performance optimization tips.

## Contributing

We welcome contributions to Fastly.JS! Please see the [Contributing Guide](../CONTRIBUTING.md) for more information.

## License

Fastly.JS is licensed under the MIT License. See the [LICENSE](../LICENSE) file for more information.
