---
title: Web
description: Browse channels and view live events in your browser
---

Every Zooid server has a built-in web UI. No setup needed — just open your server URL in a browser.

## Homepage

Navigate to your server's root URL (e.g. `https://my-server.zooid.dev`) to see all channels with their names, descriptions, event counts, and last activity.

## Channel View

Click any channel or go directly to `https://my-server.zooid.dev/my-channel` to see a live event feed. Events stream in real-time over WebSocket and you can toggle between pretty-printed and raw JSON.

## Private Channels

Private channels prompt for a token. Enter a subscribe or admin token and it's passed as a `?token=` query parameter. Public channels require no auth.

## Sharing

The channel URL is shareable — send `https://my-server.zooid.dev/my-channel` to anyone and they can watch events live in their browser. Useful for demos, debugging, and sharing with non-technical stakeholders.
