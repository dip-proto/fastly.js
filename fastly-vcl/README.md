# Fastly VCL: A Comprehensive Guide

This guide provides detailed documentation on how to write a Fastly VCL service, explaining how Fastly VCL works, the HTTP request pipeline, and real-world examples.

## Table of Contents

1. [Introduction to Fastly VCL](./01-introduction.md)
2. [The HTTP Request Pipeline](./02-request-pipeline.md)
3. [VCL Basics](./03-vcl-basics.md)
4. [Backend Configuration](./04-backend-configuration.md)
5. [Caching Strategies](./05-caching-strategies.md)
6. [Real-World Examples](./06-real-world-examples.md)

## 📚 Complete VCL Function Reference

> For a comprehensive reference of **ALL Fastly VCL functions**, see the [**vcl-functions**](vcl-functions) directory. This essential reference contains detailed documentation for every function available in Fastly VCL, including parameters, return values, and usage examples.

The function reference is a critical companion to this guide and should be consulted frequently when developing VCL code.

## What is Fastly VCL?

Fastly VCL (Varnish Configuration Language) is a domain-specific language used to configure Fastly's edge cloud platform. It's based on the open-source Varnish Cache language but includes Fastly-specific extensions and features.

With Fastly VCL, you can:

- Control how requests and responses are processed
- Define caching behavior
- Implement content-based routing
- Perform edge-based transformations
- Implement security policies
- And much more

This documentation will help you understand how to leverage Fastly VCL to build powerful, efficient edge computing solutions.