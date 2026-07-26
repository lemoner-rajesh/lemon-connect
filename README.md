# Lemon Connect

**Lemon Connect** is an AI Connector Platform: a home for reusable [Model Context Protocol](https://modelcontextprotocol.io) (MCP) connectors that let AI assistants (Claude, ChatGPT, and others) read from real systems.

**Phase 1** ships exactly one connector: **WordPress Search** — a read-only MCP server that lets an assistant search and read the public content of a single WordPress site.

This is deliberately _not_ a CMS management tool, a publishing tool, or a CRUD API. It exposes three tools, all read-only, all operating on already-public content, with no authentication required.

Search and listing cover every public content type the site registers automatically — posts, pages, and any custom post type (news, events, people, ...) — discovered from the site itself, not hardcoded.

## Why this exists

Ask an assistant connected to Lemon Connect things like:

- "Find our latest health articles."
- "Show me insurance news."
- "Who are our leadership team members?"
- "Summarize our About Us page."

The assistant calls the tools below, gets back structured JSON, and answers in natural language.

## Tools

| Tool                  | Parameters                             | Returns                                                                                                                                |
| --------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `search_content`      | `query` (required), `limit` (optional) | `SearchResult[]` — matches title, excerpt, and body text across every public content type, sorted by relevance, published content only |
| `get_content`         | `id` (required)                        | `ContentDetails` — the full item, plus SEO metadata when an SEO plugin is installed                                                    |
| `list_recent_content` | `limit` (optional)                     | `SearchResult[]` — the most recently published content, newest first                                                                   |

All three are read-only (`readOnlyHint: true`) and return both a JSON text block and MCP `structuredContent` validated against a schema, so the calling assistant can rely on the shape.

**`SearchResult`**: `id`, `title`, `excerpt`, `slug`, `permalink`, `featuredImage` (`{ url, alt, width, height } | null`), `featuredImageAlt`, `author` (`{ id, name, slug } | null`), `publishedDate`, `modifiedDate`, `contentType`, `categories` (`{ id, name, slug }[]`), `tags` (same shape), `score`.

**`ContentDetails`**: everything in `SearchResult` except `score`, plus `contentHtml` and `contentText` (paragraph-preserving plain text — prefer this one), `wordCount`, `estimatedReadingTime` (whole minutes, ~200 words/minute), and `seo` (`{ seoTitle, metaDescription, canonicalUrl, openGraphImage }`, present only when the site has an SEO plugin like Yoast SEO installed).

Every field WordPress can't supply is `null` rather than omitted, so the shape is always predictable. All URLs — including ones found inside the HTML body — are resolved to absolute URLs. When WordPress's own excerpt is empty, one is generated from the body and capped at 200 characters.

### Search ranking

`search_content` results are ranked by relevance, highest first, via each result's `score` (`0`–`1`):

1. Exact title match (`1.0`)
2. Title starts with the query (`0.85`)
3. Title contains the query (`0.7`)
4. Slug match (`0.55`)
5. Excerpt match (`0.4`)
6. Content match (`0.25`), or a small baseline (`0.1`) if WordPress's own search returned it without a direct match on any of these fields

The client fetches up to `limit` candidates per content type from WordPress (so up to `types × limit` total), and `WordPressConnector` re-ranks that whole pool by `score` before returning the true top `limit` — so a strong match in a less-common content type isn't crowded out by weaker matches in a more common one.

`score` is **only** present on `search_content` results — `list_recent_content` has no query to rank against, so the field is omitted there rather than filled with a placeholder.

## Architecture

Lemon Connect is built as a **connector platform**, not a WordPress-specific tool. The MCP tools layer only knows about the `Connector` interface — it has no idea WordPress exists.

```
src/
  config/                 Environment loading & validation (zod)
  server/                 MCP server factory + stdio/HTTP transports + Express app
  connectors/
    connector.ts          The Connector interface: search() / get() / recent()
    wordpress/
      client/             WordPressClient — the only code that knows about
                           WordPress REST API URLs, params, and response shapes;
                           discovers registered post types, resolves featured
                           media, and returns ResolvedWpPost values
      mappers/             ResolvedWpPost -> SearchResult/ContentDetails
                           translation (content-mapper.ts), WpMedia ->
                           FeaturedImage translation (media-mapper.ts)
      wordpress-connector.ts  Implements Connector using WordPressClient
  tools/                  MCP tool definitions (search_content, get_content,
                           list_recent_content) + shared error handling
  types/                  Connector-agnostic domain types (SearchResult,
                           ContentDetails, FeaturedImage, Author, Category, Tag)
  utils/                  Structured logging, HTML-to-text/paragraph helpers,
                           URL absolutization, excerpt truncation
  errors/                 ValidationError, ConfigError, ConnectorError, WordPressError
tests/                    Unit + integration tests, mirroring src/
```

**Adding a second connector** (Drupal, Contentful, Sanity, GitHub, ...) means:

1. Writing a new `connectors/<name>/` implementing `Connector`.
2. Wiring it up in `src/index.ts`.

The `tools/` layer, the MCP server, and both transports never change.

### Design notes

- **`Connector` interface** (`src/connectors/connector.ts`) — `search()`, `get()`, `recent()`. The single seam between "MCP tools" and "a specific backend."
- **`WordPressClient`** (`src/connectors/wordpress/client/`) — a thin REST wrapper. It is the _only_ file that builds a `/wp-json/wp/v2/...` URL or knows what a WordPress REST response looks like. It depends on `WordPressClientPort`-shaped structural typing so tests can inject a fake client.
- **Dynamic post-type discovery** — the client queries `/wp/v2/types` once (cached for its lifetime) to find every registered content type, instead of hardcoding `post`/`page`. WordPress core/system types (media, nav menu items, site-editor blocks, font assets) are excluded by a curated list; any other type — built-in or a site's custom post type — is searched automatically.
- **Featured media resolution** — the client uses the `_embed`-provided media object when present (no extra request); it only falls back to a direct `/media/{id}` fetch when a post's `featured_media` wasn't embedded, deduping repeated media ids within a batch.
- **Search ranking split** — `WordPressClient.search()` returns an unranked candidate pool (WordPress's per-type ordering isn't comparable across types); `WordPressConnector.search()` maps it to `SearchResult[]`, scores each against the query (`src/utils/relevance.ts`), and returns the top `limit` by score. Ranking lives in the connector because it's a property of the mapped domain fields (title/slug/excerpt/content), not the raw WordPress response — keeping `WordPressClient` a dumb REST client and `computeRelevanceScore` independently unit-testable.
- **Dependency injection throughout** — `WordPressClient` takes an injectable `fetch`; `WordPressConnector` takes a `WordPressClientPort`; tool registration takes a `Connector`. Nothing reaches for a global. See `tests/` for unit tests built on exactly these seams, including an end-to-end test that drives the real `McpServer` over an in-memory MCP transport.
- **Errors** — `ValidationError` (bad tool input), `ConfigError` (bad/missing env config, fatal at startup), `ConnectorError`/`ContentNotFoundError` (connector-level failures), `WordPressError` (WordPress REST API failures, carrying `statusCode`/`endpoint`/`cause` for logging). Tool handlers catch these and return an MCP `isError` result with a clean message — internal details and stack traces are logged server-side only, never returned to the client.
- **Logging** — structured JSON via [pino](https://getpino.io), always written to **stderr**. This matters: under the stdio transport, stdout _is_ the JSON-RPC message stream, so nothing may ever be written there. `console.log` is banned by lint rule for the same reason.

## Requirements

- Node.js **22+** (Node 24 LTS recommended)
- A WordPress site with its REST API publicly reachable (the default for most WordPress installs)

## Getting started

```bash
npm install
cp .env.example .env
# edit .env and set WORDPRESS_URL to your site, e.g. https://example.com

npm run dev      # stdio transport, auto-reload on change
```

### Available scripts

| Script                            | Purpose                                            |
| --------------------------------- | -------------------------------------------------- |
| `npm run dev`                     | Run from source with `tsx watch` (stdio transport) |
| `npm run build`                   | Type-check and compile to `dist/`                  |
| `npm start`                       | Run the compiled server (`dist/index.js`)          |
| `npm run typecheck`               | Type-check without emitting                        |
| `npm run lint` / `lint:fix`       | ESLint (strict, type-checked ruleset)              |
| `npm run format` / `format:check` | Prettier                                           |
| `npm test` / `test:watch`         | Vitest unit + integration tests                    |

## Configuration

All configuration is via environment variables (see `.env.example`).

| Variable               | Required | Default | Description                                                                                                         |
| ---------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------- |
| `WORDPRESS_URL`        | Yes      | —       | Base URL of the WordPress site, e.g. `https://example.com`                                                          |
| `PORT`                 | No       | —       | If set, starts the Streamable HTTP transport on this port. If unset, starts stdio. Railway sets this automatically. |
| `WORDPRESS_TIMEOUT_MS` | No       | `10000` | Timeout for requests to the WordPress REST API                                                                      |
| `DEFAULT_SEARCH_LIMIT` | No       | `10`    | Default `limit` for `search_content` / `list_recent_content`                                                        |
| `MAX_SEARCH_LIMIT`     | No       | `50`    | Upper bound callers may request for `limit`                                                                         |
| `LOG_LEVEL`            | No       | `info`  | `fatal` \| `error` \| `warn` \| `info` \| `debug` \| `trace` \| `silent`                                            |

Missing or invalid required configuration fails fast at startup with a clear `ConfigError`, rather than surfacing later as a confusing WordPress API error.

## Transports

Lemon Connect supports both MCP transports and picks automatically based on environment:

- **`process.env.PORT` is set → Streamable HTTP.** Exposes:
  - `GET /` — `{ "name": "Lemon Connect", "connector": "WordPress Search", "status": "running", "version": "..." }`
  - `GET /health` — `{ "status": "ok" }`
  - `POST /mcp` — the MCP endpoint (stateless: a fresh server/session per request)
  - `GET /mcp`, `DELETE /mcp` — `405`, since this deployment doesn't use MCP sessions

  Since Phase 1 only exposes public content, `POST /mcp` requires **no authentication** — no bearer token, no API key, no OAuth. That's intentional; see [Future phases](#future-phases).

- **`process.env.PORT` is unset → stdio.** For local clients like Claude Desktop.

### Using with Claude Desktop (stdio)

Add to your Claude Desktop MCP config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "lemon-connect": {
      "command": "node",
      "args": ["/absolute/path/to/lemon-connect/dist/index.js"],
      "env": {
        "WORDPRESS_URL": "https://example.com"
      }
    }
  }
}
```

Run `npm run build` first so `dist/index.js` exists.

### Using the HTTP transport locally

```bash
PORT=3000 WORDPRESS_URL=https://example.com npm run dev
curl http://localhost:3000/health
```

## Deploying to Railway

1. Push this repository to GitHub (or connect it directly) and create a new Railway project from it.
2. Railway's Nixpacks builder detects `package.json`, runs `npm install` then `npm run build` (the `build` script), and starts the service with `npm run start` — no extra configuration needed. A `railway.json` is included for explicitness.
3. In the Railway project's **Variables** tab, set:
   - `WORDPRESS_URL` — your WordPress site's base URL
   - optionally `WORDPRESS_TIMEOUT_MS`, `DEFAULT_SEARCH_LIMIT`, `MAX_SEARCH_LIMIT`, `LOG_LEVEL`
   - **do not** set `PORT` yourself — Railway injects it, which is exactly the signal Lemon Connect uses to start the HTTP transport.
4. Deploy. Once live, verify with:
   ```bash
   curl https://<your-app>.up.railway.app/health
   ```
5. Point your remote MCP client at `https://<your-app>.up.railway.app/mcp`.

## Testing

```bash
npm test
```

Tests are dependency-injected unit tests (no real network calls) plus one integration test that runs the actual `McpServer`, with all three tools registered, over an in-memory MCP transport (`@modelcontextprotocol/sdk/inMemory.js`) talking to a real MCP `Client` — exercising the exact tool schemas and error handling a real assistant would hit.

## Future phases

Deliberately out of scope for Phase 1:

- Multi-site support
- OAuth / Application Passwords / private (non-public) websites
- ChatGPT App / Claude App packaging
- Connector Marketplace publishing
- Caching, rate limiting, analytics, telemetry
- Additional connectors: Drupal, Contentful, Sanity, GitHub, Jira, Figma, ClickUp, custom REST APIs

## License

MIT
