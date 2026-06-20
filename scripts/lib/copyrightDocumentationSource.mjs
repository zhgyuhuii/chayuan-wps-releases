/**
 * 文档鉴别材料：正文来源（60 页底稿优先，否则拼接），供 PDF / Word 管线共用。
 */

import fs from 'node:fs'
import path from 'node:path'
import { COPYRIGHT_REPO_ROOT } from './copyrightMeta.mjs'

const ROOT = COPYRIGHT_REPO_ROOT

export function applyManualPlaceholders(text, meta) {
  const rh = meta.rightsholder?.trim() || '（以申请表记载为准）'
  return String(text || '')
    .replaceAll('{{SOFTWARE_NAME}}', meta.softwareName)
    .replaceAll('{{VERSION}}', meta.version)
    .replaceAll('{{RIGHTSHOLDER}}', rh)
}

/** 弱化 Markdown/HTML，便于鉴别材料以纯文本行排版（拼接模式） */
export function stripDocumentationMarkup(text) {
  let s = String(text || '')
  s = s.replace(/<[^>]+>/g, '')
  s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, '')
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1')
  s = s.replace(/\*([^*]+)\*/g, '$1')
  s = s.replace(/^#{1,6}\s+/gm, '')
  s = s.replace(/^>\s?/gm, '')
  return s
}

export function extractReadmeChineseSection(repoRoot) {
  const p = path.join(repoRoot, 'README.md')
  if (!fs.existsSync(p)) return ''
  const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/)
  const start = lines.findIndex((l) => /^##\s+简体中文\s*$/.test(l.trim()))
  const end = lines.findIndex((l) => /^##\s+English\s*$/.test(l.trim()))
  if (start < 0) return ''
  const slice = end > start ? lines.slice(start, end) : lines.slice(start)
  return slice.join('\n')
}

export function readDocFile(relFromRoot, repoRoot = ROOT) {
  const abs = path.join(repoRoot, relFromRoot)
  if (!fs.existsSync(abs)) {
    console.warn('缺少文档源文件，已跳过:', relFromRoot)
    return ''
  }
  return fs.readFileSync(abs, 'utf8')
}

/**
 * @returns {string[]} 连续正文行（主路径为底稿 Markdown，保留 # 等以便 Word 结构化）
 */
export function buildContinuousDocumentationLines(meta, repoRoot = ROOT) {
  const primaryRel = process.env.COPYRIGHT_DOC_PRIMARY || 'artifacts/copyright-design-document-60p.zh.md'
  const primaryAbs = path.isAbsolute(primaryRel) ? primaryRel : path.join(repoRoot, primaryRel)
  if (fs.existsSync(primaryAbs) && process.env.COPYRIGHT_DOC_CONCAT_LEGACY !== '1') {
    const raw = fs.readFileSync(primaryAbs, 'utf8')
    console.log('文档鉴别材料正文来源:', primaryRel)
    return applyManualPlaceholders(raw, meta).split(/\r?\n/)
  }

  const parts = []
  const manualPath = 'scripts/templates/copyright-identification-manual.zh.md'
  parts.push(applyManualPlaceholders(readDocFile(manualPath, repoRoot), meta))
  parts.push(extractReadmeChineseSection(repoRoot))
  parts.push(readDocFile('TEMPLATE_FIELDS_SPEC.md', repoRoot))
  parts.push(readDocFile('MODEL_ICONS_README.md', repoRoot))
  const extra = process.env.COPYRIGHT_DOC_EXTRA?.trim()
  if (extra) {
    const ap = path.isAbsolute(extra) ? extra : path.join(repoRoot, extra)
    if (fs.existsSync(ap)) parts.push(fs.readFileSync(ap, 'utf8'))
    else console.warn('COPYRIGHT_DOC_EXTRA 文件不存在:', ap)
  }

  const out = []
  console.log('文档鉴别材料正文来源: 拼接模式（未找到 60 页底稿或已设 COPYRIGHT_DOC_CONCAT_LEGACY=1）')
  for (let pi = 0; pi < parts.length; pi++) {
    const raw = parts[pi]
    if (!raw?.trim()) continue
    const plain = stripDocumentationMarkup(raw)
    const lines = plain.split(/\r?\n/)
    out.push(`【文档鉴别材料·节选来源 ${pi + 1}/${parts.length}】`)
    out.push(...lines)
    out.push('')
  }
  while (out.length && out[out.length - 1] === '') out.pop()
  return out
}

export const LINES_PER_PAGE = 50
export const PAGES_FRONT = 30
export const PAGES_BACK = 30
export const LINES_FRONT = PAGES_FRONT * LINES_PER_PAGE
export const LINES_BACK = PAGES_BACK * LINES_PER_PAGE
export const THRESHOLD_ALL = LINES_FRONT + LINES_BACK

export function selectIdentificationBody(allLines) {
  const n = allLines.length
  if (n <= THRESHOLD_ALL) {
    const lineNoStart = allLines.map((_, i) => i + 1)
    return { mode: 'all', bodyLines: [...allLines], lineNoStart, totalSourceLines: n }
  }
  const front = allLines.slice(0, LINES_FRONT)
  const back = allLines.slice(n - LINES_BACK)
  const lineNoStart = [
    ...Array.from({ length: LINES_FRONT }, (_, i) => i + 1),
    ...Array.from({ length: LINES_BACK }, (_, i) => n - LINES_BACK + i + 1)
  ]
  return { mode: 'front-back', bodyLines: [...front, ...back], lineNoStart, totalSourceLines: n }
}

export function padToFullPages(bodyLines, lineNoStart) {
  const out = [...bodyLines]
  const nos = [...lineNoStart]
  const rem = out.length % LINES_PER_PAGE
  if (rem !== 0) {
    const pad = LINES_PER_PAGE - rem
    const lastNo = nos.length ? nos[nos.length - 1] : 0
    for (let i = 0; i < pad; i++) {
      out.push('')
      nos.push(lastNo + i + 1)
    }
  }
  return { lines: out, lineNoStart: nos }
}
