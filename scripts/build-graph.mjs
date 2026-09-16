// Build assets/graph.json from the Jarvis daily digests.
// Source: https://github.com/Solvement/jarvis-digest  (docs/data/YYYY-MM-DD.json)
// Usage:  node scripts/build-graph.mjs [--from data/jarvis]  (defaults to fetching from GitHub)
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const RAW = 'https://raw.githubusercontent.com/Solvement/jarvis-digest/main/docs/data/';
const API = 'https://api.github.com/repos/Solvement/jarvis-digest/contents/docs/data';
const argFrom = process.argv.indexOf('--from');
const localDir = argFrom > -1 ? process.argv[argFrom + 1] : null;

// Concept aliases → canonical label (mirrors profile/known.md in jarvis-digest).
const ALIAS = new Map(Object.entries({
  'model context protocol': 'MCP', 'mcp': 'MCP',
  'retrieval-augmented generation': 'RAG', 'rag': 'RAG', 'retrieval augmented generation': 'RAG',
  'react': 'ReAct', 'react agent': 'ReAct',
  'kv cache': 'KV cache', 'kv-cache': 'KV cache',
  'multi-agent': 'Multi-agent', 'multi agent': 'Multi-agent', 'multiagent': 'Multi-agent',
  'planning': 'Planning', 'task decomposition': 'Planning',
  'memory': 'Agent memory', 'agent memory': 'Agent memory',
  'embedding': 'Embeddings', 'embeddings': 'Embeddings', 'vector database': 'Embeddings',
  'reranker': 'Reranking', 'cross-encoder': 'Reranking', 'rerank': 'Reranking',
  'prompt injection': 'Prompt injection',
  'vlm': 'VLM', 'vision-language model': 'VLM', 'vision language model': 'VLM',
  'reward model': 'Reward model', 'rlhf': 'RLHF', 'ppo': 'RLHF',
  'dpo': 'DPO', 'direct preference optimization': 'DPO',
  'grpo': 'GRPO', 'group relative policy optimization': 'GRPO',
  'reinforcement learning': 'RL', 'rl': 'RL',
  'latent diffusion': 'Diffusion', 'flow matching': 'Flow matching',
  'attention': 'Transformer', 'sparse attention': 'Sparse attention',
  'pretraining': 'Pretraining', 'next-token prediction': 'Pretraining',
  'hallucination': 'Hallucination', 'test-time compute': 'Test-time compute', 'world model': 'World model',
  'quantization': 'Quantization', 'int8': 'Quantization',
  'diffusion model': 'Diffusion', 'diffusion': 'Diffusion', 'ddpm': 'Diffusion',
  'speculative decoding': 'Speculative decoding',
  'long context': 'Long context', 'context window': 'Long context',
  'knowledge distillation': 'Distillation', 'distillation': 'Distillation', 'on-policy distillation': 'Distillation',
  'mixture of experts': 'MoE', 'moe': 'MoE',
  'vision transformer': 'ViT', 'vit': 'ViT',
  'swe-bench': 'SWE-bench',
  'alignment': 'Alignment', 'safety': 'Alignment',
  'tool use': 'Tool use', 'tool-use': 'Tool use', 'function calling': 'Tool use',
  'agent': 'Agents', 'agents': 'Agents', 'llm agent': 'Agents',
  'evaluation': 'Evaluation', 'agent evaluation': 'Evaluation', 'benchmark': 'Evaluation', 'eval': 'Evaluation',
  'lora': 'LoRA', 'fine-tuning': 'Fine-tuning', 'sft': 'Fine-tuning',
  'transformer': 'Transformer', 'self-attention': 'Transformer',
  'flash attention': 'FlashAttention', 'flashattention': 'FlashAttention',
  'chain-of-thought': 'Chain-of-thought', 'cot': 'Chain-of-thought',
  'vla': 'VLA', 'vision-language-action': 'VLA', 'embodied ai': 'VLA',
  'clip': 'CLIP', 'graphrag': 'GraphRAG', 'graph rag': 'GraphRAG',
  'idempotency': 'Idempotency', 'reconciliation': 'Reconciliation',
}));
const canon = (s) => {
  const k = String(s || '').trim();
  if (!k) return null;
  return ALIAS.get(k.toLowerCase()) || k;
};

async function loadDays() {
  const days = [];
  if (localDir) {
    for (const f of readdirSync(localDir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort()) {
      days.push(JSON.parse(readFileSync(join(localDir, f), 'utf8')));
    }
    return days;
  }
  const list = await fetch(API).then((r) => r.json());
  for (const f of list.filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f.name)).sort((a, b) => a.name.localeCompare(b.name))) {
    days.push(await fetch(RAW + f.name).then((r) => r.json()));
  }
  return days;
}

const days = await loadDays();
const items = new Map();
const firstSeen = new Map();
let collected = 0, filtered = 0, selected = 0;
for (const day of days) {
  collected += day.stats?.collected || 0;
  filtered += day.stats?.filtered || 0;
  selected += day.stats?.selected || 0;
  for (const it of day.items || []) {
    if (!items.has(it.id)) firstSeen.set(it.id, day.date);
    items.set(it.id, { ...it, seen: day.date });
  }
}

// Concept frequency across everything Jarvis selected.
const conceptCount = new Map();
for (const it of items.values()) {
  const c = new Set();
  for (const p of it.digest?.prereqs || []) { const n = canon(p.name); if (n) c.add(n); }
  for (const r of it.digest?.related || []) { const n = canon(r); if (n) c.add(n); }
  for (const k of it.keywords || []) { const n = canon(k); if (n && ALIAS.has(String(k).toLowerCase())) c.add(n); }
  for (const n of c) conceptCount.set(n, (conceptCount.get(n) || 0) + 1);
}

// Kevin's own systems, linked by hand to the concepts they actually use.
const MINE = [
  { id: 'mine:via', label: 'VIA', sub: 'Enterprise agent platform · Yanfeng', href: '#work',
    uses: ['RAG', 'Reranking', 'Embeddings', 'Multi-agent', 'Planning', 'Evaluation', 'Tool use', 'Agent memory', 'Long context'] },
  { id: 'mine:seckill', label: 'Seckill Plus', sub: 'High-concurrency order system · Capgemini', href: '#work',
    uses: ['Idempotency', 'Reconciliation'] },
  { id: 'mine:nio', label: 'NIO inspection', sub: 'Production vision post-training · NIO', href: '#work',
    uses: ['DPO', 'LoRA', 'Fine-tuning', 'Quantization', 'Evaluation'] },
  { id: 'mine:roborefer', label: 'RoboRefer', sub: 'Cross-view consistency · NYU', href: '#research',
    uses: ['VLM', 'ViT', 'Fine-tuning', 'Evaluation'] },
  { id: 'mine:esca', label: 'ESCA', sub: 'Latent-space expression · NYU', href: '#research',
    uses: ['Transformer', 'Diffusion', 'Alignment'] },
  { id: 'mine:jarvis', label: 'Jarvis', sub: 'Daily reading pipeline', href: '#work',
    uses: ['Agents', 'Evaluation', 'Planning', 'Tool use', 'RAG'] },
];
for (const m of MINE) for (const u of m.uses) conceptCount.set(u, (conceptCount.get(u) || 0) + 1);

const MIN_CONCEPT = 3;
const mineConcepts = new Set(MINE.flatMap((m) => m.uses));
const concepts = [...conceptCount.entries()].filter(([label, n]) => n >= MIN_CONCEPT || mineConcepts.has(label)).map(([label]) => label);
const conceptSet = new Set(concepts);

// Keep the strongest, most recent readings so the graph stays legible (~90 items).
const ranked = [...items.values()]
  .filter((it) => (it.core_score || 0) >= 8)
  .sort((a, b) => (b.core_score - a.core_score) || (b.seen.localeCompare(a.seen)))
  .slice(0, 90);

const nodes = [];
const links = [];
const pushLink = (s, t, kind) => { if (s && t && s !== t) links.push({ source: s, target: t, kind }); };

for (const c of concepts) nodes.push({ id: 'c:' + c, type: 'concept', label: c, weight: conceptCount.get(c) });
for (const m of MINE) {
  nodes.push({ id: m.id, type: 'mine', label: m.label, sub: m.sub, href: m.href });
  for (const u of m.uses) if (conceptSet.has(u)) pushLink(m.id, 'c:' + u, 'uses');
}
for (const it of ranked) {
  const d = it.digest || {};
  nodes.push({
    id: it.id, type: it.kind === 'paper' ? 'paper' : 'project', label: it.title,
    date: firstSeen.get(it.id), url: it.url, code: it.code_url || null, score: it.core_score,
    one: d.one_liner || '', verdict: d.verdict || '', level: d.read_level || '', keywords: (it.keywords || []).slice(0, 5),
  });
  const seen = new Set();
  for (const p of d.prereqs || []) { const n = canon(p.name); if (n && conceptSet.has(n) && !seen.has(n)) { seen.add(n); pushLink(it.id, 'c:' + n, 'prereq'); } }
  for (const r of d.related || []) { const n = canon(r); if (n && conceptSet.has(n) && !seen.has(n)) { seen.add(n); pushLink(it.id, 'c:' + n, 'related'); } }
}
// Drop readings that ended up with no edge into the concept layer.
const linked = new Set(links.flatMap((l) => [l.source, l.target]));
const finalNodes = nodes.filter((n) => n.type === 'concept' ? linked.has(n.id) : (n.type === 'mine' || linked.has(n.id)));
const finalIds = new Set(finalNodes.map((n) => n.id));
const finalLinks = links.filter((l) => finalIds.has(l.source) && finalIds.has(l.target));

const out = {
  generated: new Date().toISOString().slice(0, 10),
  source: 'https://github.com/Solvement/jarvis-digest',
  stats: {
    days: days.length, first: days[0]?.date, last: days.at(-1)?.date,
    collected, filtered, selected, unique: items.size,
    papers: [...items.values()].filter((i) => i.kind === 'paper').length,
    projects: [...items.values()].filter((i) => i.kind !== 'paper').length,
    concepts: finalNodes.filter((n) => n.type === 'concept').length,
    shown: finalNodes.length, edges: finalLinks.length,
    perDay: days.map((d) => ({ date: d.date, collected: d.stats?.collected || 0, filtered: d.stats?.filtered || 0, selected: d.stats?.selected || 0 })),
  },
  recent: [...items.values()].sort((a, b) => b.seen.localeCompare(a.seen) || b.core_score - a.core_score).slice(0, 6)
    .map((it) => ({ id: it.id, kind: it.kind, title: it.title, url: it.url, date: it.seen, one: it.digest?.one_liner || '', score: it.core_score })),
  nodes: finalNodes, links: finalLinks,
};
if (!existsSync('assets')) mkdirSync('assets');
writeFileSync('assets/graph.json', JSON.stringify(out));
console.log(`graph.json: ${out.stats.shown} nodes (${out.stats.concepts} concepts), ${out.stats.edges} edges, ${items.size} readings over ${days.length} days; ${collected} → ${filtered} → ${selected}`);
