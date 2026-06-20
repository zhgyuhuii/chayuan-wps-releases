#!/usr/bin/env node
/**
 * 程序鉴别材料 PDF：仅摘录「关键路径」源码（非整文件复制）。
 *
 * 选取原则（与本软件核心功能对应）：
 * 1. 宿主集成：App 将 ribbon 挂到 window，供 WPS ribbon.xml 回调。
 * 2. Ribbon：加载项入口 OnAddinLoad、模型下拉、动态 CustomUI（助手类菜单）、助手任务入口、OnAction 分发、window.ribbon 导出。
 *    不摘录：翻译语种大表、GetTranslationMenuContent、上下文翻译/文本分析菜单中的静态 id 枚举等配置型数据。
 * 3. 模型请求：从设置解析 API 与 compositeId；OpenAI 兼容流式/非流式 chat/completions。不摘录 RIBBON_MODEL_TO_PROVIDER 巨型字面量映射表。
 * 4. 批注：智能批注任务（分段、chatCompletion、解析 JSON、写入 WPS Comments）；addCommentAtText；applyDocumentAction 中批注类分支。
 * 5. 任务编排：startAssistantTask 创建占位任务并执行助手流水线。
 *
 * 版式：每页不少于 LINES_PER_PAGE 行；总页数随摘录行数变化（末页用 // 垫行对齐）。
 *
 * 与申请表一致（页眉中的权利人、软件全称、版本号）可通过环境变量或仓库根目录
 * copyright-meta.json 配置（该文件已加入 .gitignore）。环境变量优先于 JSON。
 *   COPYRIGHT_RIGHTSHOLDER  权利人（著作权人）全称，须与申请表一致
 *   COPYRIGHT_SOFTWARE_NAME  登记用软件全称，须与申请表一致
 *   COPYRIGHT_SOFTWARE_VERSION  登记用版本号，须与申请表一致（默认取 package.json version）
 *   COPYRIGHT_META_FILE  可选，指向 JSON 路径（默认 ./copyright-meta.json）
 *
 * 用法：npm run generate:copyright-program-pdf
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import PDFDocument from 'pdfkit'
import { resolveCopyrightMeta, COPYRIGHT_REPO_ROOT } from './lib/copyrightMeta.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = COPYRIGHT_REPO_ROOT
const OUT_DIR = path.join(ROOT, 'artifacts')
const OUT_PDF = path.join(OUT_DIR, 'copyright-program-identification-key-excerpts.pdf')

const LINES_PER_PAGE = 50

function readFileLines(relPath) {
  const abs = path.join(ROOT, relPath)
  const raw = fs.readFileSync(abs, 'utf8')
  return raw.split(/\r?\n/)
}

function sliceLines(relPath, startLine, endLineInclusive) {
  const lines = readFileLines(relPath)
  const start = Math.max(0, startLine - 1)
  const end = endLineInclusive == null ? lines.length : Math.min(lines.length, endLineInclusive)
  return lines.slice(start, end)
}

function resolveFontPath() {
  const env = process.env.COPYRIGHT_PDF_FONT
  if (env && fs.existsSync(env)) return env
  if (process.platform === 'darwin') {
    const candidates = [
      '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
      '/Library/Fonts/Arial Unicode.ttf'
    ]
    for (const p of candidates) {
      if (fs.existsSync(p)) return p
    }
  }
  if (process.platform === 'win32') {
    const p = 'C:\\Windows\\Fonts\\msyh.ttc'
    if (fs.existsSync(p)) return p
  }
  return null
}

/**
 * 关键摘录：每项为独立语义块，带简短说明，避免整文件照搬。
 * 行号 1-based，与仓库当前文件一致；若上游大改需同步调整。
 */
function buildKeyExcerptSegments() {
  return [
    { label: 'Vue 根组件挂载 ribbon（WPS 回调入口）', file: 'src/App.vue', from: 7, to: 40 },
    { label: 'Ribbon 加载项初始化、模型列表与下拉菜单', file: 'src/components/ribbon.js', from: 51, to: 291 },
    {
      label: '全文处理确认、拼写检查入口、executeConfiguredAssistant 调助手',
      file: 'src/components/ribbon.js',
      from: 547,
      to: 594
    },
    {
      label: 'Ribbon 动态 CustomUI XML（助手「更多」与右键更多；不含翻译语种表/文本分析 id 枚举）',
      file: 'src/components/ribbon.js',
      from: 604,
      to: 640
    },
    { label: 'executeAssistantFromRibbon：创建任务并打开进度对话框', file: 'src/components/ribbon.js', from: 681, to: 706 },
    { label: 'Ribbon OnAction：助手/任务/表格与脱密等入口分发（节选）', file: 'src/components/ribbon.js', from: 3155, to: 3365 },
    { label: 'ribbon 对象导出供宿主 XML 调用', file: 'src/components/ribbon.js', from: 4218, to: 4272 },
    { label: '模型 API 地址拼装与 ribbon 模型解析', file: 'src/utils/chatApi.js', from: 98, to: 149 },
    { label: '流式 chat/completions（fetch + SSE 解析）', file: 'src/utils/chatApi.js', from: 162, to: 253 },
    { label: '从响应 JSON 抽取文本', file: 'src/utils/chatApi.js', from: 260, to: 276 },
    { label: '非流式 chat/completions', file: 'src/utils/chatApi.js', from: 322, to: 383 },
    { label: '模型配置读取与已启用 provider 集合（不含 ribbon id 大表）', file: 'src/utils/modelSettings.js', from: 20, to: 78 },
    { label: 'Ribbon 模型 id 是否在设置中启用', file: 'src/utils/modelSettings.js', from: 126, to: 133 },
    { label: 'compositeId（providerId|modelId）解析', file: 'src/utils/modelSettings.js', from: 445, to: 454 },
    { label: '智能批注：系统提示、用户提示、分段与模型调用循环', file: 'src/utils/documentCommentService.js', from: 146, to: 385 },
    { label: '按锚点写入 WPS 批注', file: 'src/utils/spellCheckService.js', from: 873, to: 905 },
    { label: 'addCommentToRange 与 applyDocumentAction 批注/替换写回', file: 'src/utils/documentActions.js', from: 159, to: 165 },
    { label: 'applyDocumentAction 批注类动作与降级逻辑（节选）', file: 'src/utils/documentActions.js', from: 1567, to: 1810 },
    { label: '助手任务：占位任务与异步执行入口', file: 'src/utils/assistantTaskRunner.js', from: 2462, to: 2518 }
  ]
}

function buildProgramLines() {
  const out = []
  for (const seg of buildKeyExcerptSegments()) {
    const range = `${seg.from}-${seg.to}`
    // 单行标注文件与行号，便于对照仓库；不插入空行以免鉴别材料版面稀疏
    out.push(`// ${seg.file}:${range}`)
    out.push(...sliceLines(seg.file, seg.from, seg.to))
  }

  while (out.length % LINES_PER_PAGE !== 0) {
    out.push('')
  }
  return out
}

function fitLine(line, maxChars) {
  const s = String(line ?? '').replace(/\t/g, '  ')
  if (s.length <= maxChars) return s
  return s.slice(0, Math.max(0, maxChars - 1)) + '…'
}

function writePdf(lines, fontPath, pages, meta) {
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const doc = new PDFDocument({
    size: 'A4',
    margin: 40,
    autoFirstPage: false,
    info: {
      Title: `${meta.softwareName} V${meta.version} 程序鉴别材料`,
      Author: meta.rightsholder || meta.softwareName,
      Subject: '计算机软件著作权登记 程序鉴别材料'
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
  const headerBlockTop = top - 4
  const contentTop = top + (hasRightsholderLine ? 36 : 26)
  const contentBottom = pageHeight - margin - 8
  const usableHeight = contentBottom - contentTop

  const fontSize = fontPath ? 6.6 : 7.2
  const lineHeight = Math.min(14.2, usableHeight / LINES_PER_PAGE)
  const maxChars = Math.max(72, Math.floor(textWidth / (fontSize * 0.52)))

  function applyBodyFont() {
    if (fontPath) {
      try {
        doc.font(fontPath)
        return
      } catch (e) {
        console.warn('嵌入字体失败，改用 Courier:', e?.message || e)
      }
    }
    doc.font('Courier')
  }
  applyBodyFont()

  for (let pageIndex = 0; pageIndex < pages; pageIndex++) {
    doc.addPage()
    doc.fillColor('#222222')
    applyBodyFont()
    if (hasRightsholderLine) {
      doc.fontSize(7).text(`权利人：${meta.rightsholder}`, left, headerBlockTop, {
        width: textWidth,
        align: 'center'
      })
    }
    const titleLine = `${meta.softwareName}  V${meta.version}    程序鉴别材料（源代码摘录）    第 ${pageIndex + 1} 页 / 共 ${pages} 页`
    doc.fontSize(7.5).text(titleLine, left, headerBlockTop + (hasRightsholderLine ? 12 : 0), {
      width: textWidth,
      align: 'center'
    })

    doc.fontSize(fontSize).fillColor('#000000')
    applyBodyFont()

    let y = contentTop
    const offset = pageIndex * LINES_PER_PAGE
    for (let i = 0; i < LINES_PER_PAGE; i++) {
      const line = fitLine(lines[offset + i] ?? '', maxChars)
      doc.text(line, left, y, { width: textWidth, lineBreak: false, ellipsis: false })
      y += lineHeight
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
  const lines = buildProgramLines()
  const pages = Math.ceil(lines.length / LINES_PER_PAGE)
  if (lines.length === 0) {
    console.error('摘录为空')
    process.exit(1)
  }

  const fontPath = resolveFontPath()
  if (!fontPath) {
    console.warn('未找到可嵌入中文字体，已使用 Courier（中文可能无法显示）。可设置 COPYRIGHT_PDF_FONT 指向 .ttf')
  } else {
    console.log('使用字体:', fontPath)
  }

  await writePdf(lines, fontPath, pages, meta)
  console.log('已生成:', OUT_PDF)
  console.log(`摘录行数: ${lines.length}, 每页: ${LINES_PER_PAGE} 行, 页数: ${pages}`)
  console.log('页眉与 PDF 属性已使用（请与申请表、文档鉴别材料逐项一致）：')
  console.log(`  软件名称: ${meta.softwareName}`)
  console.log(`  版本号:   ${meta.version}`)
  console.log(
    `  权利人:   ${meta.rightsholder || '（未设置 — 请设置 COPYRIGHT_RIGHTSHOLDER 或在 copyright-meta.json 填写权利人，与申请表一致）'}`
  )
  if (!meta.rightsholder) {
    console.warn(
      '提示：登记机关要求程序/文档鉴别材料中的权利人署名、软件名称、版本号与其他申请文件一致；请务必配置权利人。'
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
