# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-08-18

### Added

- GraphQL SDL files now generate executable Bruno GraphQL requests, including native query and variables blocks for every query and mutation.
- GraphQL fixture and compatibility coverage that validates generated collections with Bruno's parser and validates generated operations against the source schema.

### Fixed

- GraphQL schema loading, nested selections with required arguments, and recursive schema mapping.

## [1.2.0] - 2026-08-18

### Added

- Collection planning and OpenAPI collection-mapping modules.
- Unit coverage for OpenAPI schema and security mapping, Swagger normalization, GraphQL schema mapping, parser input modes, generator compatibility, validation, and fixtures.

### Changed

- Upgraded Bruno language support to v4 compatibility and updated collection, request, serializer, writer, test-generation, CLI output, parser, and plugin-execution paths.
- Refactored generation orchestration and parser implementations.
- Updated package metadata, lockfile dependencies, and GitHub repository references.

## [1.1.0] - 2026-06-30

### Added

- MIT license.
