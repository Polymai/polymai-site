#!/usr/bin/env node

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const galleryIndexPath = ["data", "polymai-apps-index.json"].join("/");
const outputPath = path.resolve(rootDir, process.env.POLYMAI_GALLERY_OUTPUT || galleryIndexPath);
const fallbackPath = path.resolve(rootDir, galleryIndexPath);

const GITHUB_API_BASE = "https://api.github.com";
const GITHUB_OWNER = clean(process.env.GITHUB_OWNER || "Polymai", "Polymai", 80);
const GITHUB_PAGES_BASE = clean(process.env.GITHUB_PAGES_BASE || `https://${GITHUB_OWNER.toLowerCase()}.github.io`, "", 300).replace(/\/+$/, "");
const GITHUB_REPO_PREFIX = clean(process.env.GITHUB_REPO_PREFIX || "", "", 80).toLowerCase();
const GITHUB_REPO_LIMIT = boundedNumber(process.env.GITHUB_REPO_LIMIT, 100, 1, 1000);
const GITHUB_PAGE_LIMIT = Math.ceil(GITHUB_REPO_LIMIT / 100);
const GITHUB_TOKEN = clean(process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "", "", 500);
const REQUEST_DELAY_MS = boundedNumber(process.env.GITHUB_REQUEST_DELAY_MS, 80, 0, 2000);
const METADATA_FETCH_TIMEOUT_MS = boundedNumber(process.env.GALLERY_METADATA_TIMEOUT_MS, 2500, 500, 8000);
const GENERIC_SUMMARY_PATTERN = /^(a polymai app build discovered from github|a focused app build prepared for launch)\.?$/i;
const MANIFEST_CANDIDATES = [
  ["polymai-app", "json"].join("."),
  ["data", "polymai-app.json"].join("/"),
  galleryIndexPath,
  ["registry", "json"].join("."),
  ["ai-manifest", "json"].join("."),
  [".polymai", "project-profile.json"].join("/"),
  ["project", ".polymai", "project-profile.json"].join("/"),
];

function clean(value, fallback = "", maxLength = 240) {
  return String(value || fallback).replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function boundedNumber(value, fallback, min, max) {
  const parsed = Number(value || "");
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function titleFromSlug(value) {
  return clean(value, "Polymai build", 90)
    .replace(/^app\d+[-_]?/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function normalizeTokenText(value) {
  return clean(value, "", 500)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function tokensFrom(value) {
  return normalizeTokenText(value)
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length >= 4 && !["polymai", "github", "build", "preview", "live"].includes(token));
}

function editDistanceWithinTwo(a, b) {
  if (Math.abs(a.length - b.length) > 2) return false;
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    let rowMinimum = previous[0];
    for (let j = 1; j <= b.length; j += 1) {
      const saved = previous[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + cost);
      diagonal = saved;
      rowMinimum = Math.min(rowMinimum, previous[j]);
    }
    if (rowMinimum > 2) return false;
  }
  return previous[b.length] <= 2;
}

function tokenMatches(sourceTokens, candidateText) {
  const candidateTokens = tokensFrom(candidateText);
  return sourceTokens.some((source) => candidateTokens.some((candidate) => {
    return source === candidate ||
      source.includes(candidate) ||
      candidate.includes(source) ||
      (source.length >= 6 && candidate.length >= 6 && editDistanceWithinTwo(source, candidate));
  }));
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([a-f0-9]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function readHtmlAttribute(tag, name) {
  const match = String(tag || "").match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"));
  return match ? decodeHtmlEntities(match[2] || match[3] || "") : "";
}

function extractMetaContent(html, names) {
  const wanted = new Set(names.map((name) => name.toLowerCase()));
  const tags = String(html || "").match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const key = clean(readHtmlAttribute(tag, "name") || readHtmlAttribute(tag, "property"), "", 80).toLowerCase();
    if (wanted.has(key)) return clean(readHtmlAttribute(tag, "content"), "", 320);
  }
  return "";
}

function extractHtmlTitle(html) {
  const match = String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? clean(decodeHtmlEntities(match[1]), "", 120) : "";
}

function metadataDescriptionLooksRelated(metadata, title, repoName) {
  const description = clean(metadata?.description, "", 320);
  if (!description) return false;
  const sourceTokens = [...tokensFrom(title), ...tokensFrom(repoName)];
  if (!sourceTokens.length) return true;
  if (tokenMatches(sourceTokens, description)) return true;
  return tokenMatches(sourceTokens, metadata?.title || "");
}

async function readLiveAppMetadata(rawUrl) {
  const url = clean(rawUrl, "", 300);
  if (!url) return { screenStatus: "missing", screenStatusCode: 0 };
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return { screenStatus: "invalid", screenStatusCode: 0 };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), METADATA_FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(parsed.toString(), {
        headers: {
          "Accept": "text/html,application/xhtml+xml",
          "User-Agent": "polymai-app684-gallery-refresh",
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        return {
          screenStatus: "needs-check",
          screenStatusCode: response.status,
        };
      }
      const html = (await response.text()).slice(0, 220000);
      return {
        screenStatus: "ok",
        screenStatusCode: response.status,
        title: extractHtmlTitle(html),
        description: extractMetaContent(html, ["description", "og:description"]),
      };
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return { screenStatus: "needs-check", screenStatusCode: 0 };
  }
}

function fallbackDescription(title, focus) {
  const focusLabel = /^github build$/i.test(focus) ? "app" : focus.toLowerCase();
  return `${title} is a live Polymai ${focusLabel} preview with an embeddable product surface and a full-screen example to inspect.`;
}

function normalizeDescription(app, title, focus) {
  const raw = clean(app.description || app.metaDescription || app.summary, "", 320);
  if (raw && !GENERIC_SUMMARY_PATTERN.test(raw)) return raw;
  return fallbackDescription(title, focus);
}

function sleep(ms) {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

function githubHeaders() {
  const headers = {
    "Accept": "application/vnd.github+json",
    "User-Agent": "polymai-app684-gallery-refresh",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
  return headers;
}

async function githubFetchJson(route, { optional = false } = {}) {
  await sleep(REQUEST_DELAY_MS);
  const response = await fetch(`${GITHUB_API_BASE}${route}`, { headers: githubHeaders() });
  if (optional && response.status === 404) return null;
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    if (optional) return null;
    throw new Error(`GitHub HTTP ${response.status} for ${route}: ${text || response.statusText}`);
  }
  return await response.json();
}

async function listGithubReposForRoute(routeBase) {
  const repos = [];
  for (let page = 1; page <= GITHUB_PAGE_LIMIT && repos.length < GITHUB_REPO_LIMIT; page += 1) {
    const perPage = Math.min(100, GITHUB_REPO_LIMIT - repos.length);
    const pageRepos = await githubFetchJson(`${routeBase}&per_page=${perPage}&page=${page}`);
    if (!Array.isArray(pageRepos) || !pageRepos.length) break;
    repos.push(...pageRepos);
    if (pageRepos.length < perPage) break;
  }
  return repos.slice(0, GITHUB_REPO_LIMIT);
}

async function listGithubRepos() {
  const owner = encodeURIComponent(GITHUB_OWNER);
  try {
    return await listGithubReposForRoute(`/orgs/${owner}/repos?type=all&sort=updated&direction=desc`);
  } catch {
    return await listGithubReposForRoute(`/users/${owner}/repos?type=all&sort=updated&direction=desc`);
  }
}

function repoMatches(repo) {
  const name = clean(repo?.name, "", 120).toLowerCase();
  if (!name) return false;
  if (repo?.archived || repo?.fork) return false;
  if (name === "polymai-site") return false;
  if (GITHUB_REPO_PREFIX && !name.startsWith(GITHUB_REPO_PREFIX)) return false;
  return true;
}

async function readGithubFileJson(repo, relPath) {
  const fullName = clean(repo?.full_name, "", 160);
  if (!fullName) return null;
  const encodedPath = encodeURIComponent(relPath).replace(/%2F/g, "/");
  const result = await githubFetchJson(`/repos/${fullName}/contents/${encodedPath}`, { optional: true });
  if (!result || typeof result !== "object" || Array.isArray(result)) return null;
  if (clean(result.encoding, "", 40) !== "base64") return null;
  const content = clean(result.content, "", 400000);
  if (!content) return null;
  try {
    return JSON.parse(Buffer.from(content.replace(/\s/g, ""), "base64").toString("utf8"));
  } catch {
    return null;
  }
}

async function readGithubManifest(repo) {
  for (const relPath of MANIFEST_CANDIDATES) {
    const data = await readGithubFileJson(repo, relPath);
    if (data) return { path: relPath, data };
  }
  return null;
}

async function readGithubPagesUrl(repo) {
  const fullName = clean(repo?.full_name, "", 160);
  if (!fullName) return "";
  const pages = await githubFetchJson(`/repos/${fullName}/pages`, { optional: true });
  return clean(pages?.html_url, "", 300);
}

function githubPagesUrlForRepo(repo) {
  const name = clean(repo?.name, "", 120);
  if (!name || !GITHUB_PAGES_BASE) return "";
  return `${GITHUB_PAGES_BASE}/${encodeURIComponent(name)}/`;
}

function normalizeApp(app, index) {
  const title = clean(app.title || app.name, `Polymai build ${index + 1}`, 90);
  const id = clean(app.id || title, `build-${index + 1}`, 90)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const url = clean(app.url, "", 300);
  const focus = clean(app.focus || app.category, "Workflow", 60);
  const description = normalizeDescription(app, title, focus);
  const screenStatus = clean(app.screenStatus, "", 40);
  return {
    id: id || `build-${index + 1}`,
    title,
    focus,
    audience: clean(app.audience, "Growing teams", 90),
    industry: clean(app.industry, "Operations", 80),
    summary: description,
    description,
    status: screenStatus === "needs-check" ? "Needs check" : clean(app.status, "Preview-ready", 60),
    impact: clean(app.impact, "Launch-ready", 70),
    url,
    previewUrl: clean(app.previewUrl || app.embedUrl || url, "", 300),
    screenStatus,
    screenStatusCode: boundedNumber(app.screenStatusCode, 0, 0, 599),
    publishedAt: clean(app.publishedAt || app.updatedAt, "", 40),
    updatedAt: clean(app.updatedAt || app.publishedAt, "", 40),
    repo: clean(app.repo, "", 160),
    manifest: clean(app.manifest, "", 120),
  };
}

function appFromGithubRepo(repo, manifest, liveUrl, liveMetadata) {
  const appManifest = manifest?.data || {};
  const manifestApp = typeof appManifest.app === "object" && appManifest.app ? appManifest.app : {};
  const intent = typeof appManifest.intent === "object" && appManifest.intent ? appManifest.intent : {};
  const architecture = typeof appManifest.architecture === "object" && appManifest.architecture ? appManifest.architecture : {};
  const repoName = clean(repo?.name, "polymai-build", 90);
  const title = clean(appManifest.title || appManifest.name || manifestApp.name || titleFromSlug(repoName), titleFromSlug(repoName), 90);
  const focus = clean(appManifest.focus || appManifest.category || manifestApp.type || architecture.pattern, "GitHub build", 60);
  const metadataDescription = metadataDescriptionLooksRelated(liveMetadata, title, repoName) ? liveMetadata.description : "";
  const screenStatus = clean(liveMetadata?.screenStatus, liveUrl ? "unknown" : "none", 40);
  const isLive = screenStatus === "ok";
  const description = normalizeDescription({
    description: appManifest.description || manifestApp.description || metadataDescription || repo?.description,
    summary: appManifest.summary ||
      manifestApp.summary ||
      (intent.primaryGoal ? `Polymai build focused on ${clean(intent.primaryGoal, "useful software", 120)}.` : ""),
  }, title, focus);

  return {
    id: clean(repoName, "github-build", 90).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    title,
    focus,
    audience: clean(appManifest.audience || "Polymai customers", "Polymai customers", 90),
    industry: clean(appManifest.industry || "Custom software", "Custom software", 80),
    summary: description,
    description,
    status: liveUrl ? (isLive ? "Live app" : "Needs check") : "Repository",
    impact: liveUrl ? (isLive ? "Open live app" : "Check publish") : "Review source",
    url: liveUrl || clean(repo?.html_url, "", 300),
    previewUrl: liveUrl || clean(repo?.html_url, "", 300),
    screenStatus,
    screenStatusCode: boundedNumber(liveMetadata?.screenStatusCode, 0, 0, 599),
    publishedAt: clean(repo?.updated_at, "", 40),
    updatedAt: clean(repo?.updated_at, "", 40),
    repo: clean(repo?.full_name, "", 160),
    manifest: manifest?.path || "",
  };
}

async function loadFallbackApps() {
  try {
    const fallback = JSON.parse(await readFile(fallbackPath, "utf8"));
    return Array.isArray(fallback.apps) ? fallback.apps.map(normalizeApp) : [];
  } catch {
    return [];
  }
}

async function buildIndex() {
  const repos = (await listGithubRepos()).filter(repoMatches);
  const apps = [];
  for (const repo of repos) {
    const [manifest, pagesApiUrl] = await Promise.all([
      readGithubManifest(repo),
      readGithubPagesUrl(repo),
    ]);
    const homepageUrl = clean(repo.homepage, "", 300);
    const candidateUrl = pagesApiUrl || homepageUrl || githubPagesUrlForRepo(repo);
    const liveMetadata = candidateUrl ? await readLiveAppMetadata(candidateUrl) : {};
    const screenedLive = liveMetadata.screenStatus === "ok";
    const knownPublished = Boolean(pagesApiUrl || homepageUrl);
    const liveUrl = knownPublished || screenedLive ? candidateUrl : "";
    if (!manifest && !liveUrl) continue;
    apps.push(appFromGithubRepo(repo, manifest, liveUrl, liveMetadata));
  }
  const normalized = apps.length ? apps.map(normalizeApp) : await loadFallbackApps();
  return {
    generatedAt: new Date().toISOString(),
    source: apps.length ? `github:${GITHUB_OWNER}` : "fallback",
    count: normalized.length,
    apps: normalized,
  };
}

function stablePayloadShape(payload) {
  return JSON.stringify({
    source: payload.source,
    count: payload.count,
    apps: payload.apps,
  });
}

async function preserveGeneratedAtWhenUnchanged(payload) {
  try {
    const previous = JSON.parse(await readFile(outputPath, "utf8"));
    if (stablePayloadShape(previous) === stablePayloadShape(payload)) {
      return {
        ...payload,
        generatedAt: clean(previous.generatedAt, payload.generatedAt, 40),
      };
    }
  } catch {
    // No previous output to compare.
  }
  return payload;
}

async function writeIndex(payload) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  const tempPath = `${outputPath}.${process.pid}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await rename(tempPath, outputPath);
}

try {
  const payload = await preserveGeneratedAtWhenUnchanged(await buildIndex());
  await writeIndex(payload);
  console.log(`Wrote ${payload.count} app(s) to ${path.relative(rootDir, outputPath)} from ${payload.source}.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
