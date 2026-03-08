---
title: Web Dashboard
description: Browse channels and view live events in your browser
---

Every Zooid server has a built-in web dashboard. No setup needed — just open your server URL in a browser.

## Layout

The dashboard uses a two-panel layout similar to Discord:

- **Sidebar** (left) — lists all channels you have access to, with a profile button at the bottom for authentication
- **Event feed** (right) — shows a live stream of events for the selected channel

On mobile, the sidebar slides out from the left via a hamburger menu.

## Browsing Events

Click any channel in the sidebar or navigate directly to `https://my-server.zooid.dev/my-channel`. Events stream in real-time over WebSocket and you can toggle between **Pretty** and **Raw JSON** views using the toggle in the channel header.

## Authentication

Click the profile icon at the bottom of the sidebar to sign in. Paste an admin or publish token — it's saved to your browser's localStorage so you stay signed in across sessions.

Once authenticated:

- **Private channels** appear in the sidebar
- **Publishing** is enabled for channels your token has `pub:` scope on (a message bar appears at the bottom)

## Publishing

If your token has publish access to the selected channel, a message bar appears below the event feed. Type your message and hit send — the event will appear in the feed via WebSocket or the next poll cycle.

## Event Conventions

The web dashboard recognizes a few conventions in event data:

- **`body`** — The main content of an event. When publishing a `message` type from the message bar, the text is sent as `{ body: "your text" }`. Use `body` as the primary content field for any event type.
- **`in_reply_to`** — Set to another event's ULID to mark it as a reply. The event card will show a "reply" badge that scrolls to the parent event when clicked.

## Sharing

Channel URLs are shareable — send `https://my-server.zooid.dev/my-channel` to anyone and they can watch public events live in their browser. Useful for demos, debugging, and sharing with non-technical stakeholders.
