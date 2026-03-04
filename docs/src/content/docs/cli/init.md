---
title: zooid init
description: Create zooid-server.json with server identity
---

Creates a `zooid-server.json` file in the current directory with a new server identity (name and ID). Run this before `zooid deploy`.

## Usage

```bash
npx zooid init
```

## Arguments

None.

## Options

None.

## Examples

```bash
# Initialize a new Zooid server project
npx zooid init
```

## Notes

- This command must be run before `zooid deploy`.
- The generated `zooid-server.json` file should be committed to version control.
- Running `zooid init` in a directory that already contains `zooid-server.json` will prompt before overwriting.
