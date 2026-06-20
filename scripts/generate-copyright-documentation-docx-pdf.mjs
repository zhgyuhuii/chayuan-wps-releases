#!/usr/bin/env node
/**
 * 文档鉴别材料：Markdown 正文 → Word（标题样式，正文中不出现 `#` / `##` 等 Markdown 标记字面）→ PDF。
 *
 * - 正文来源、前/后 30「页」（每页 50 行）截取规则与 `generate-copyright-documentation-pdf.mjs` 一致。
 * - Word：标题映射为内置「标题 1–6」样式；粗体、行内代码、引用、列表、围栏代码块做基础排版。
 * - PDF：需本机安装 LibreOffice，调用 `soffice --headless --convert-to pdf`。
 *   未检测到 soffice 时仍写出 `.docx`；若设置 `COPYRIGHT_DOC_WORD_FALLBACK_PDFKIT=1`，则额外调用 pdfkit 脚本生成 PDF。
 *
 * 可选环境变量：
 *   COPYRIGHT_SOFFICE — LibreOffice `soffice` 可执行文件绝对路径。
 */

import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import {
  AlignmentType,
  Document,
  Footer,
  HeadingLevel,
  Header,
  LineRuleType,
  Packer,
  PageNumber,
  PageOrientation,
  Paragraph,
  ShadingType,
  TextRun
} from 'docx'
import { resolveCopyrightMeta, COPYRIGHT_REPO_ROOT } from './lib/copyrightMeta.mjs'
import {
  buildContinuousDocumentationLines,
  LINES_PER_PAGE,
  LINES_FRONT,
  LINES_BACK,
  THRESHOLD_ALL,
  selectIdentificationBody,
  padToFullPages
} from './lib/copyrightDocumentationSource.mjs'

const ROOT = COPYRIGHT_REPO_ROOT
const OUT_DIR = path.join(ROOT, 'artifacts')
const OUT_DOCX = path.join(OUT_DIR, 'copyright-documentation-identification-front30-back30.docx')
const OUT_PDF = path.join(OUT_DIR, 'copyright-documentation-identification-front30-back30.pdf')

const HEADINGS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6
]

function bodyFont() {
  return { ascii: 'SimSun', eastAsia: 'SimSun', hAnsi: 'SimSun' }
}

function monoFont() {
  return { ascii: 'Consolas', eastAsia: 'SimSun', hAnsi: 'Consolas' }
}

function stripLineMdArtifacts(s) {
  return String(s || '')
    .replace(/<[^>]+>/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
}

function splitByBold(text) {
  const out = []
  const re = /\*\*(.+?)\*\*/gs
  let last = 0
  let m
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ t: 'plain', s: text.slice(last, m.index) })
    out.push({ t: 'bold', s: m[1] })
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ t: 'plain', s: text.slice(last) })
  if (out.length === 0) out.push({ t: 'plain', s: text })
  return out
}

function splitByBackticks(text) {
  const out = []
  let i = 0
  while (i < text.length) {
    const j = text.indexOf('`', i)
    if (j < 0) {
      out.push({ t: 'text', s: text.slice(i) })
      break
    }
    if (j > i) out.push({ t: 'text', s: text.slice(i, j) })
    const k = text.indexOf('`', j + 1)
    if (k < 0) {
      out.push({ t: 'text', s: text.slice(j) })
      break
    }
    out.push({ t: 'code', s: text.slice(j + 1, k) })
    i = k + 1
  }
  if (out.length === 0) out.push({ t: 'text', s: text })
  return out
}

/** @param {{ mono?: boolean, bold?: boolean }} opts */
function inlineToRuns(text, opts = {}) {
  const { mono = false, bold = false } = opts
  const font = mono ? monoFont() : bodyFont()
  const size = mono ? 20 : 22
  const runs = []
  for (const seg of splitByBackticks(text)) {
    if (seg.t === 'code') {
      runs.push(
        new TextRun({
          text: seg.s,
          font,
          size,
          shading: { type: ShadingType.CLEAR, fill: 'EEEEEE' }
        })
      )
      continue
    }
    if (mono) {
      runs.push(new TextRun({ text: seg.s, font, size }))
      continue
    }
    for (const b of splitByBold(seg.s)) {
      runs.push(
        new TextRun({
          text: b.s,
          font,
          size,
          bold: bold || b.t === 'bold'
        })
      )
    }
  }
  return runs.length ? runs : [new TextRun({ text: '', font, size })]
}

function lineToParagraphs(line, inFence) {
  const rawTrim = line.trim()
  if (inFence) {
    if (/^[`]{3,}\s*\S*?\s*$/.test(rawTrim)) return { inFence: false, paragraphs: [] }
    return {
      inFence: true,
      paragraphs: [
        new Paragraph({
          shading: { type: ShadingType.CLEAR, fill: 'F5F5F5' },
          spacing: { after: 30, line: 240, lineRule: LineRuleType.AUTO },
          indent: { left: 227 },
          children: inlineToRuns(line, { mono: true })
        })
      ]
    }
  }

  if (/^[`]{3,}/.test(rawTrim)) {
    return { inFence: true, paragraphs: [] }
  }

  if (/^[-*_]{3,}\s*$/.test(rawTrim)) {
    return {
      inFence: false,
      paragraphs: [
        new Paragraph({
          spacing: { before: 80, after: 80 },
          border: {
            bottom: { color: 'CCCCCC', space: 1, style: 'single', size: 6 }
          },
          children: [new TextRun({ text: '', font: bodyFont(), size: 8 })]
        })
      ]
    }
  }

  const hm = line.match(/^(#{1,6})\s+(.*)$/)
  if (hm) {
    const depth = Math.min(hm[1].length, 6)
    const title = stripLineMdArtifacts(hm[2].trimEnd())
    return {
      inFence: false,
      paragraphs: [
        new Paragraph({
          heading: HEADINGS[depth - 1],
          spacing: { before: depth <= 2 ? 200 : 120, after: 80 },
          children: inlineToRuns(title, { bold: depth === 1 })
        })
      ]
    }
  }

  if (/^>\s?/.test(line)) {
    const inner = stripLineMdArtifacts(line.replace(/^>\s?/, ''))
    return {
      inFence: false,
      paragraphs: [
        new Paragraph({
          indent: { left: 360 },
          spacing: { after: 80, line: 276, lineRule: LineRuleType.AUTO },
          children: inlineToRuns(inner)
        })
      ]
    }
  }

  const bullet = line.match(/^\s*[-*]\s+(.*)$/)
  if (bullet) {
    const inner = stripLineMdArtifacts(bullet[1])
    return {
      inFence: false,
      paragraphs: [
        new Paragraph({
          indent: { left: 567, hanging: 284 },
          spacing: { after: 60, line: 276, lineRule: LineRuleType.AUTO },
          children: [new TextRun({ text: '• ', font: bodyFont(), size: 22 }), ...inlineToRuns(inner)]
        })
      ]
    }
  }

  const numbered = line.match(/^\s*\d+\.\s+(.*)$/)
  if (numbered) {
    const inner = stripLineMdArtifacts(numbered[1])
    return {
      inFence: false,
      paragraphs: [
        new Paragraph({
          indent: { left: 567, hanging: 284 },
          spacing: { after: 60, line: 276, lineRule: LineRuleType.AUTO },
          children: inlineToRuns(inner)
        })
      ]
    }
  }

  if (rawTrim === '') {
    return {
      inFence: false,
      paragraphs: [new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: '', font: bodyFont(), size: 22 })] })]
    }
  }

  if (line.startsWith('    ') && rawTrim.length > 0) {
    const codeLine = line.slice(4)
    return {
      inFence: false,
      paragraphs: [
        new Paragraph({
          indent: { left: 284 },
          spacing: { after: 20, line: 240, lineRule: LineRuleType.AUTO },
          children: inlineToRuns(codeLine, { mono: true })
        })
      ]
    }
  }

  if (/^\s*\|/.test(line) && line.includes('|')) {
    return {
      inFence: false,
      paragraphs: [
        new Paragraph({
          spacing: { after: 40, line: 240, lineRule: LineRuleType.AUTO },
          children: inlineToRuns(stripLineMdArtifacts(line), { mono: true })
        })
      ]
    }
  }

  return {
    inFence: false,
    paragraphs: [
      new Paragraph({
        spacing: { after: 60, line: 276, lineRule: LineRuleType.AUTO },
        children: inlineToRuns(stripLineMdArtifacts(line))
      })
    ]
  }
}

function buildDocxChildren(bodyLines) {
  const children = []
  let inFence = false
  for (const line of bodyLines) {
    const { inFence: nextFence, paragraphs } = lineToParagraphs(line, inFence)
    if (paragraphs?.length) children.push(...paragraphs)
    inFence = nextFence
  }
  return children
}

function resolveSoffice() {
  const env = process.env.COPYRIGHT_SOFFICE?.trim()
  if (env && fs.existsSync(env)) return env
  if (process.platform === 'darwin') {
    const p = '/Applications/LibreOffice.app/Contents/MacOS/soffice'
    if (fs.existsSync(p)) return p
  }
  if (process.platform === 'win32') {
    for (const p of [
      'C:\\Program Files\\LibreOffice\\program\\soffice.com',
      'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
      'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.com'
    ]) {
      if (fs.existsSync(p)) return p
    }
  }
  const which = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['soffice'], {
    encoding: 'utf8'
  })
  const first = which.stdout?.trim()?.split(/\r?\n/)?.[0]?.trim()
  if (first && fs.existsSync(first)) return first
  return null
}

function convertDocxToPdf(soffice, docxPath, outDir) {
  const r = spawnSync(
    soffice,
    ['--headless', '--nologo', '--nofirststartwizard', '--convert-to', 'pdf', '--outdir', outDir, docxPath],
    { encoding: 'utf8' }
  )
  if (r.error) return { ok: false, msg: r.error.message }
  if (r.status !== 0) return { ok: false, msg: r.stderr || r.stdout || `exit ${r.status}` }
  const base = path.basename(docxPath, path.extname(docxPath))
  const produced = path.join(outDir, `${base}.pdf`)
  if (!fs.existsSync(produced)) return { ok: false, msg: '转换完成但未找到输出 PDF' }
  if (produced !== OUT_PDF) {
    try {
      fs.renameSync(produced, OUT_PDF)
    } catch (e) {
      return { ok: false, msg: e?.message || String(e) }
    }
  }
  return { ok: true, msg: '' }
}

function runPdfKitFallback() {
  const script = path.join(ROOT, 'scripts', 'generate-copyright-documentation-pdf.mjs')
  const r = spawnSync(process.execPath, [script], { cwd: ROOT, stdio: 'inherit', env: process.env })
  return r.status === 0
}

async function main() {
  const meta = resolveCopyrightMeta(ROOT)
  const lines = buildContinuousDocumentationLines(meta, ROOT)
  if (lines.length === 0) {
    console.error('未生成任何文档正文，请检查模板与 README 等源文件。')
    process.exit(1)
  }

  const selected = selectIdentificationBody(lines)
  const { lines: bodyLines } = padToFullPages(selected.bodyLines, selected.lineNoStart)
  const pages = Math.ceil(bodyLines.length / LINES_PER_PAGE)

  const headerText = `${meta.softwareName}  V${meta.version}`
  const headerDefault = new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [new TextRun({ text: headerText, font: bodyFont(), size: 20, color: '404040' })]
      })
    ]
  })

  const footerParas = []
  if (meta.rightsholder?.trim()) {
    footerParas.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [
          new TextRun({
            text: `权利人：${meta.rightsholder.trim()}`,
            font: bodyFont(),
            size: 18,
            color: '404040'
          })
        ]
      })
    )
  }
  footerParas.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: '第 ', font: bodyFont(), size: 18, color: '404040' }),
        new TextRun({ children: [PageNumber.CURRENT], font: bodyFont(), size: 18 }),
        new TextRun({ text: ' 页 / 共 ', font: bodyFont(), size: 18, color: '404040' }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], font: bodyFont(), size: 18 }),
        new TextRun({ text: ' 页', font: bodyFont(), size: 18, color: '404040' })
      ]
    })
  )
  const footerDefault = new Footer({ children: footerParas })

  const doc = new Document({
    creator: meta.rightsholder || meta.softwareName,
    title: `${meta.softwareName} 文档鉴别材料`,
    description: '计算机软件著作权登记 文档鉴别材料',
    styles: {
      default: {
        document: {
          run: { font: bodyFont(), size: 22 },
          paragraph: { spacing: { line: 276, lineRule: LineRuleType.AUTO } }
        }
      }
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: PageOrientation.PORTRAIT,
              width: 11906,
              height: 16838
            },
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 1440,
              header: 708,
              footer: 708,
              gutter: 0
            }
          }
        },
        headers: { default: headerDefault },
        footers: { default: footerDefault },
        children: buildDocxChildren(bodyLines)
      }
    ]
  })

  fs.mkdirSync(OUT_DIR, { recursive: true })
  const buf = await Packer.toBuffer(doc)
  fs.writeFileSync(OUT_DOCX, buf)

  console.log('')
  console.log('已生成 Word:', OUT_DOCX)

  const soffice = resolveSoffice()
  if (soffice) {
    console.log('使用 LibreOffice:', soffice)
    const conv = convertDocxToPdf(soffice, OUT_DOCX, OUT_DIR)
    if (conv.ok) {
      console.log('已生成 PDF:', OUT_PDF)
    } else {
      console.warn('LibreOffice 转 PDF 失败:', conv.msg)
      if (process.env.COPYRIGHT_DOC_WORD_FALLBACK_PDFKIT === '1') {
        console.log('尝试 pdfkit 回退…')
        if (runPdfKitFallback()) console.log('已生成 PDF（pdfkit）:', OUT_PDF)
        else console.warn('pdfkit 回退失败。')
      }
    }
  } else {
    console.warn('未找到 LibreOffice（soffice）。已跳过 PDF；请安装后重跑本脚本，或手动从 Word 另存为 PDF。')
    if (process.env.COPYRIGHT_DOC_WORD_FALLBACK_PDFKIT === '1') {
      console.log('尝试 pdfkit 回退…')
      if (runPdfKitFallback()) console.log('已生成 PDF（pdfkit）:', OUT_PDF)
      else console.warn('pdfkit 回退失败。')
    }
  }

  const modeDesc =
    selected.mode === 'all'
      ? `全文（不足 ${THRESHOLD_ALL} 行，按页全部提交）`
      : `前 ${LINES_FRONT} 行 + 后 ${LINES_BACK} 行`
  console.log(`连续正文行数: ${lines.length}；鉴别模式: ${modeDesc}；按 ${LINES_PER_PAGE} 行/页计约 ${pages} 页`)
  if (!meta.rightsholder) {
    console.warn('\n建议配置 COPYRIGHT_RIGHTSHOLDER 或 copyright-meta.json 中的「权利人」，与申请表完全一致。\n')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
