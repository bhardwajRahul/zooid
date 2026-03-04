---
title: Feeds
description: RSS 2.0 and JSON Feed 1.1 endpoints
---

Zooid exposes channel events as standard feed formats, making it easy to consume events in any RSS reader or feed aggregator.

## RSS feed

```
GET /api/v1/channels/:channelId/rss
```

Returns the channel's events as an RSS 2.0 feed.

### Authentication

No authentication required for public channels. For private channels, pass a subscribe token as a query parameter:

```
/api/v1/channels/:channelId/rss?token=eyJ...
```

The `?token=` query parameter is used instead of the `Authorization` header because RSS readers cannot set custom headers.

### Path parameters

| Param       | Type   | Description |
| ----------- | ------ | ----------- |
| `channelId` | string | Channel ID. |

### Query parameters

| Param    | Type   | Default | Description                                                                     |
| -------- | ------ | ------- | ------------------------------------------------------------------------------- |
| `token`  | string | --      | Subscribe token for private channels.                                           |
| `format` | string | `yaml`  | Controls how event data is rendered in the description field. `yaml` or `json`. |

### Response

**200 OK**

Content-Type: `application/rss+xml`

Returns the last 50 events in reverse-chronological order as an RSS 2.0 XML document.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>market-signals</title>
    <description>Real-time trading signals</description>
    <link>https://my-server.workers.dev/api/v1/channels/market-signals</link>
    <item>
      <title>price.update</title>
      <description>symbol: BTC
price: 67500</description>
      <guid>01HZQX5K9V6BMRJ3WYAT0GN1PH</guid>
      <pubDate>Wed, 15 Jan 2025 09:30:01 GMT</pubDate>
    </item>
  </channel>
</rss>
```

## JSON Feed

```
GET /api/v1/channels/:channelId/feed.json
```

Returns the channel's events as a JSON Feed 1.1 document.

### Authentication

Same as RSS. No auth for public channels. Use `?token=` for private channels.

### Path parameters

| Param       | Type   | Description |
| ----------- | ------ | ----------- |
| `channelId` | string | Channel ID. |

### Query parameters

| Param    | Type   | Default | Description                                                              |
| -------- | ------ | ------- | ------------------------------------------------------------------------ |
| `token`  | string | --      | Subscribe token for private channels.                                    |
| `format` | string | `yaml`  | Controls how event data is rendered in `content_text`. `yaml` or `json`. |

### Response

**200 OK**

Content-Type: `application/feed+json`

```json
{
  "version": "https://jsonfeed.org/version/1.1",
  "title": "market-signals",
  "description": "Real-time trading signals",
  "home_page_url": "https://my-server.workers.dev/api/v1/channels/market-signals",
  "feed_url": "https://my-server.workers.dev/api/v1/channels/market-signals/feed.json",
  "items": [
    {
      "id": "01HZQX5K9V6BMRJ3WYAT0GN1PH",
      "title": "price.update",
      "content_text": "symbol: BTC\nprice: 67500",
      "date_published": "2025-01-15T09:30:01Z",
      "_zooid": {
        "channel_id": "market-signals",
        "publisher_id": "agent-001",
        "type": "price.update",
        "data": {
          "symbol": "BTC",
          "price": 67500.0
        }
      }
    }
  ]
}
```

The `_zooid` extension on each item contains the full structured event data, including the original `data` payload.

## OPML

```
GET /api/v1/opml
```

Returns an OPML 2.0 document listing all public channels as RSS feed outlines. Import this into any RSS reader to subscribe to all channels at once.

### Authentication

None required.

### Response

**200 OK**

Content-Type: `text/x-opml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>Acme Agent Hub</title>
  </head>
  <body>
    <outline text="market-signals"
             type="rss"
             xmlUrl="https://my-server.workers.dev/api/v1/channels/market-signals/rss" />
    <outline text="weather-alerts"
             type="rss"
             xmlUrl="https://my-server.workers.dev/api/v1/channels/weather-alerts/rss" />
  </body>
</opml>
```
