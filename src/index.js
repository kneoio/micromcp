#!/usr/bin/env node
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const projectRoot = resolve(fileURLToPath(import.meta.url), "../..");
const envFile = join(projectRoot, ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

const KNOWLEDGE_DIR = process.env.KNOWLEDGE_DIR;
if (!KNOWLEDGE_DIR) throw new Error("KNOWLEDGE_DIR is not set (see .env.example)");
const root = resolve(KNOWLEDGE_DIR);
if (!existsSync(root)) throw new Error(`KNOWLEDGE_DIR does not exist: ${root}`);

/** Minimal frontmatter reader: flat `key: value` and `key: [a, b]` pairs. */
function parseFrontmatter(text) {
  if (!text.startsWith("---\n")) return {};
  const end = text.indexOf("\n---", 4);
  if (end === -1) return {};
  const meta = {};
  for (const line of text.slice(4, end).split("\n")) {
    const match = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, key, raw] = match;
    meta[key] = raw.startsWith("[")
      ? raw.replace(/^\[|]$/g, "").split(",").map((v) => v.trim()).filter(Boolean)
      : raw.replace(/^["']|["']$/g, "");
  }
  return meta;
}

async function listMarkdown(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listMarkdown(full)));
    else if (entry.name.endsWith(".md")) out.push(full);
  }
  return out;
}

/** Resolve an agent-supplied relative path, refusing anything outside the bundle. */
function resolveConcept(path) {
  const full = resolve(root, path.endsWith(".md") ? path : `${path}.md`);
  if (full !== root && !full.startsWith(root + sep)) throw new Error(`Path escapes the bundle: ${path}`);
  return full;
}

const server = new McpServer({ name: "micromcp", version: "0.1.0" });

server.registerTool(
  "list_concepts",
  {
    title: "List knowledge concepts",
    description:
      "Index of every document in the OKF knowledge bundle: relative path plus its frontmatter " +
      "(type, title, description, tags, audience). Use it to pick which concept to read, then call get_concept.",
    inputSchema: {},
  },
  async () => {
    const files = (await listMarkdown(root)).sort();
    const concepts = await Promise.all(
      files.map(async (file) => {
        const meta = parseFrontmatter(await readFile(file, "utf8"));
        return { path: relative(root, file), ...meta };
      })
    );
    return { content: [{ type: "text", text: JSON.stringify({ bundle: root, count: concepts.length, concepts }, null, 2) }] };
  }
);

server.registerTool(
  "get_concept",
  {
    title: "Read a knowledge concept",
    description: "Full markdown of one document, addressed by the relative path returned by list_concepts (e.g. workflows/emission.md).",
    inputSchema: { path: z.string().describe("Bundle-relative path, with or without the .md suffix") },
  },
  async ({ path }) => {
    const text = await readFile(resolveConcept(path), "utf8");
    return { content: [{ type: "text", text }] };
  }
);

await server.connect(new StdioServerTransport());
