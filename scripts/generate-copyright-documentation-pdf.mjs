#!/usr/bin/env node
/**
 * 计算机软件著作权登记 — 文档鉴别材料 PDF（常见提交版式）
 *
 * - 与申请表一致：权利人、软件全称、版本号（copyright-meta.json / 环境变量，与程序鉴别材料共用）。
 * - 版式：任选一种文档，取「前连续 30 页 + 后连续 30 页」（每页 50 行）；不足约 60 页则提交全文连续页。
 * - 页眉：软件全称 + 版本号；页脚：页码；配置权利人时页脚页码上方印「权利人：…」。
 *
 * 文档来源（优先级）：
 *   1. 若存在 `artifacts/copyright-design-document-60p.zh.md`（由
 *      `npm run generate:copyright-documentation-60p` 或
 *      `node scripts/build-copyright-documentation-60p-source.mjs` 生成），
 *      且未设置 COPYRIGHT_DOC_CONCAT_LEGACY=1，则**仅使用该文件**作为鉴别材料正文。
 *   2. 否则按「旧版」拼接：manual 模板 + README 中文节 + TEMPLATE_FIELDS_SPEC + MODEL_ICONS_README。
 *
 * 可通过 COPYRIGHT_DOC_EXTRA 在旧版拼接模式下追加 UTF-8 文件。
 *
 * 用法：
 *   npm run generate:copyright-documentation-60p   # 先生成 ≥60 页底稿再出 Word+PDF（需 LibreOffice）
 *   npm run generate:copyright-documentation-pdf   # 直接 pdfkit 出 PDF（无底稿可走旧版拼接）
 *
 * Word 版式与 PDF（LibreOffice）管线见 `scripts/generate-copyright-documentation-docx-pdf.mjs`。
 */

import fs from 'node:fs'
import path from 'node:path'
import PDFDocument from 'pdfkit'
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
const OUT_PDF = path.join(OUT_DIR, 'copyright-documentation-identification-front30-back30.pdf')

function resolveFontPath() {
  const env = process.env.COPYRIGHT_PDF_FONT
  if (env && fs.existsSync(env)) return env
  if (process.platform === 'darwin') {
    for (const p of [
      '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
      '/Library/Fonts/Arial Unicode.ttf'
    ]) {
      if (fs.existsSync(p)) return p
    }
  }
  if (process.platform === 'win32') {
    const p = 'C:\\Windows\\Fonts\\msyh.ttc'
    if (fs.existsSync(p)) return p
  }
  return null
}

function fitLine(line, maxChars) {
  const s = String(line ?? '').replace(/\t/g, '  ')
  if (s.length <= maxChars) return s
  return s.slice(0, Math.max(0, maxChars - 1)) + '…'
}

function writeDocumentationPdf(bodyLines, fontPath, meta) {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const pages = Math.ceil(bodyLines.length / LINES_PER_PAGE)

  const doc = new PDFDocument({
    size: 'A4',
    margin: 40,
    autoFirstPage: false,
    info: {
      Title: `${meta.softwareName} V${meta.version} 文档鉴别材料`,
      Author: meta.rightsholder || meta.softwareName,
      Subject: '计算机软件著作权登记 文档鉴别材料'
    }
  })

  const stream = fs.createWriteStream(OUT_PDF)
  doc.pipe(stream)

  const pageWidth = 595.28
  const pageHeight = 841.89
  const margin = 40
  const left = margin
  const top = margin
  const textWidth = pageWidth - margin * 2
  const hasRightsholderLine = Boolean(meta.rightsholder)
  const headerReserve = 22
  const footerReserve = hasRightsholderLine ? 36 : 22
  const contentTop = top + headerReserve
  const contentBottom = pageHeight - margin - footerReserve
  const usableHeight = contentBottom - contentTop

  const fontSize = fontPath ? 8.2 : 8.8
  const lineHeight = Math.min(15.2, usableHeight / LINES_PER_PAGE)
  const maxChars = Math.max(42, Math.floor(textWidth / (fontSize * 0.95)))

  function applyBodyFont() {
    if (fontPath) {
      try {
        doc.font(fontPath)
        return
      } catch (e) {
        console.warn('嵌入字体失败，改用 Helvetica:', e?.message || e)
      }
    }
    doc.font('Helvetica')
  }
  applyBodyFont()

  for (let pageIndex = 0; pageIndex < pages; pageIndex++) {
    doc.addPage()

    doc.fillColor('#222222')
    applyBodyFont()
    doc.fontSize(7.5).text(`${meta.softwareName}  V${meta.version}`, left, top + 2, {
      width: textWidth,
      align: 'center'
    })

    doc.fontSize(fontSize).fillColor('#000000')
    applyBodyFont()

    let y = contentTop
    const offset = pageIndex * LINES_PER_PAGE
    for (let i = 0; i < LINES_PER_PAGE; i++) {
      const rawLine = bodyLines[offset + i] ?? ''
      doc.text(fitLine(rawLine, maxChars), left, y, { width: textWidth, lineBreak: false, ellipsis: false })
      y += lineHeight
    }

    doc.fillColor('#222222')
    applyBodyFont()
    const bottomEdge = pageHeight - margin
    let fy = bottomEdge - 10
    doc.fontSize(7).text(`第 ${pageIndex + 1} 页 / 共 ${pages} 页`, left, fy, {
      width: textWidth,
      align: 'center'
    })
    if (hasRightsholderLine) {
      fy -= 14
      doc.fontSize(6.5).text(`权利人：${meta.rightsholder}`, left, fy, {
        width: textWidth,
        align: 'center'
      })
    }
  }

  doc.end()
  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve())
    stream.on('error', reject)
  })
}

async function main() {
  const meta = resolveCopyrightMeta(ROOT)
  const lines = buildContinuousDocumentationLines(meta, ROOT)
  if (lines.length === 0) {
    console.error('未生成任何文档正文，请检查模板与 README 等源文件。')
    process.exit(1)
  }

  const selected = selectIdentificationBody(lines)
  const { lines: bodyLines, lineNoStart } = padToFullPages(selected.bodyLines, selected.lineNoStart)
  const pages = Math.ceil(bodyLines.length / LINES_PER_PAGE)

  const fontPath = resolveFontPath()
  if (!fontPath) {
    console.warn('未找到中文字体，中文可能显示异常。可设置 COPYRIGHT_PDF_FONT。')
  } else {
    console.log('使用字体:', fontPath)
  }

  await writeDocumentationPdf(bodyLines, fontPath, meta)

  console.log('')
  console.log('已生成:', OUT_PDF)
  const modeDesc =
    selected.mode === 'all'
      ? `全文（不足 ${THRESHOLD_ALL} 行，按页全部提交）`
      : `前 ${LINES_FRONT} 行 + 后 ${LINES_BACK} 行`
  console.log(`连续正文行数: ${lines.length}；鉴别模式: ${modeDesc}；PDF 页数: ${pages}`)
  console.log('页眉：', meta.softwareName, 'V' + meta.version, '| 页脚：页码', meta.rightsholder ? `| 权利人: ${meta.rightsholder}` : '| （权利人未设置）')
  if (!meta.rightsholder) {
    console.warn('\n建议配置 COPYRIGHT_RIGHTSHOLDER 或 copyright-meta.json 中的「权利人」，与申请表完全一致。\n')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
