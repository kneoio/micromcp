# micromcp

Stdio MCP server that exposes an [OKF](https://github.com/okf) knowledge bundle to coding agents
(Claude Code, Cursor, …). It reads the bundle straight off disk, so edits are live — no build, no
deploy, no HTTP.

Currently it serves the Mixpla platform bundle that lives in `jesoos`
(`src/main/resources/knowledge`).

## Tools

| Tool | Purpose |
| --- | --- |
| `list_concepts` | Index of every document: bundle-relative path + frontmatter (`type`, `title`, `description`, `tags`, `audience`). |
| `get_concept(path)` | Full markdown of one document, e.g. `workflows/emission.md`. |

There is deliberately no search tool: the agent picks the right document from the index itself, so
none of the weighted-search logic in the jesoos loader is duplicated here.

## Setup

```bash
npm install
cp .env.example .env   # then set KNOWLEDGE_DIR to the bundle root
```

## Register in an agent

Claude Code:

```bash
claude mcp add mixpla-knowledge -- node /home/aidazi/WebstormProjects/micromcp/src/index.js
```

Cursor — `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "mixpla-knowledge": {
      "command": "node",
      "args": ["/home/bill_gates/Projects/micromcp/src/index.js"]
    }
  }
}
```

`KNOWLEDGE_DIR` comes from this project's `.env`, so the agent config needs no environment of its
own. To point one agent at a different bundle, set `KNOWLEDGE_DIR` in its `env` block — a real
environment variable wins over `.env`.
