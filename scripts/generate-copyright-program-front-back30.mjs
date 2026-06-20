#!/usr/bin/env node
/**
 * 计算机软件著作权登记 — 程序鉴别材料（常见提交版式）
 *
 * 依据《计算机软件著作权登记办法》等配套实践中广泛采用的格式：
 * - 源程序连续的前 30 页与连续的后 30 页（按 A4、每页不少于 50 行排版时，即前/后各约 1500 行）；
 * - 若源程序整体不足约 60 页（总有效行数 ≤ 3000 行），则提交全部源程序（仍按每页 50 行排版）；
 * - 页眉中的软件全称与版本号、页脚中的页码及（可选）权利人，须与申请表及其他材料一致（见 copyright-meta.json / 环境变量）。
 *
 * 实务说明（非法律意见）：鉴别材料正文是否加「全局行号」在多数情况下为可选，以版权中心或代理当次要求为准；
 * 本脚本默认不加行号（纯代码排版）；需要时设 COPYRIGHT_LINE_NUMBERS=1。
 *
 * 页眉/页脚：页眉居中印「软件全称 + 版本号」（与申请表一致）；页脚居中仅印「第 n 页 / 共 m 页」；
 * 配置权利人时「权利人：…」印在页脚、页码上方一行。正文在页眉之下排满。
 *
 * 源程序范围：默认仅 `src/` 下 `.vue/.js/.mjs/.ts/.tsx`（不含 `.d.ts`、不含 `*.test.*` / `*.spec.*`）。
 * 拼接顺序：先按「关键文件」列表（入口、路由、Ribbon、模型与文档写回、助手与任务等），再将其余文件按路径字典序接上；
 *   避免仅靠字典序把大量与核心逻辑无关的文件排在最前。
 * 排除：`src/assets/**` 下脚本（如 base64 导出的 logo 数据）、生成型 DataUrl 等；`.vue` 中 `<style>` 整块不纳入鉴别材料正文。
 * 可通过 COPYRIGHT_SRC_ROOT 指定其他根目录（相对仓库根）。
 *
 * 默认不输出行首序号；若需要可设置 COPYRIGHT_LINE_NUMBERS=1。
 *
 * 用法：npm run generate:copyright-program-submit
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import PDFDocument from 'pdfkit'
import { resolveCopyrightMeta, COPYRIGHT_REPO_ROOT } from './lib/copyrightMeta.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = COPYRIGHT_REPO_ROOT
const OUT_DIR = path.join(ROOT, 'artifacts')
const OUT_PDF = path.join(OUT_DIR, 'copyright-program-identification-front30-back30.pdf')

const LINES_PER_PAGE = 50
const PAGES_FRONT = 30
const PAGES_BACK = 30
const LINES_FRONT = PAGES_FRONT * LINES_PER_PAGE
const LINES_BACK = PAGES_BACK * LINES_PER_PAGE
const THRESHOLD_ALL = LINES_FRONT + LINES_BACK

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

function relPosix(fromRoot, absPath) {
  return path.relative(fromRoot, absPath).split(path.sep).join('/')
}

function shouldSkipFile(rel) {
  if (rel.includes('/__tests__/') || rel.includes('/node_modules/')) return true
  if (/\.(test|spec)\.(js|mjs|ts|tsx)$/.test(rel)) return true
  if (/\.stories\.(js|ts|tsx|vue)$/.test(rel)) return true
  if (/\/assets\//.test(rel) && /\.(js|mjs|ts)$/.test(rel)) return true
  if (/logoAvatarDataUrl\.js$/i.test(rel) || /DataUrl\.js$/i.test(rel)) return true
  return false
}

/** 与申请表无关：从 .vue 单文件组件中去掉样式块，鉴别材料只保留 script/template 等逻辑与结构 */
function stripVueStyleBlocks(source) {
  return String(source || '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
}

/**
 * 关键源文件顺序（相对仓库根）。排在最前，体现 WPS 加载项从入口到 Ribbon、模型、文档与助手的主链路。
 * 其后自动接上其余 src 下源文件（字典序、已去重）。
 */
function getKeySourceFilesRel() {
  return [
    'src/main.js',
    'src/utils/publicAssetUrl.js',
    'src/utils/spellCheckTaskBridge.js',
    'src/utils/globalErrorLogger.js',
    'src/utils/dialogTextDisplay.js',
    'src/App.vue',
    'src/router/index.js',
    'src/components/Root.vue',
    'src/components/js/util.js',
    'src/components/js/systemdemo.js',
    'src/components/ribbon.js',
    'src/utils/chatApi.js',
    'src/utils/modelSettings.js',
    'src/utils/globalSettings.js',
    'src/utils/defaultModelGroups.js',
    'src/utils/documentContext.js',
    'src/utils/documentChunker.js',
    'src/utils/documentActions.js',
    'src/utils/documentCommentService.js',
    'src/utils/spellCheckService.js',
    'src/utils/assistantRegistry.js',
    'src/utils/assistantSettings.js',
    'src/utils/assistantIcons.js',
    'src/utils/assistantTaskRunner.js',
    'src/utils/taskListStore.js',
    'src/utils/aiAssistantWindowManager.js',
    'src/components/AIAssistantDialog.vue',
    'src/components/SettingsDialog.vue'
  ]
}

function collectSourceFiles(repoRoot) {
  const srcRoot = path.resolve(repoRoot, process.env.COPYRIGHT_SRC_ROOT || 'src')
  const files = []
  function walk(dir) {
    if (!fs.existsSync(dir)) return
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name)
      if (ent.isDirectory()) {
        if (ent.name === 'node_modules' || ent.name === '.git' || ent.name === 'dist') continue
        walk(full)
      } else if (/\.(vue|js|mjs|ts|tsx)$/.test(ent.name) && !/\.d\.ts$/.test(ent.name)) {
        const rel = relPosix(repoRoot, full)
        if (!shouldSkipFile(rel)) files.push(full)
      }
    }
  }
  walk(srcRoot)
  const set = new Set(files)
  const ordered = []
  const seen = new Set()
  for (const rel of getKeySourceFilesRel()) {
    const abs = path.resolve(repoRoot, rel)
    if (set.has(abs) && !seen.has(abs)) {
      ordered.push(abs)
      seen.add(abs)
    }
  }
  const rest = [...set]
    .filter((abs) => !seen.has(abs))
    .sort((a, b) => relPosix(repoRoot, a).localeCompare(relPosix(repoRoot, b)))
  ordered.push(...rest)
  return { ordered, srcRoot }
}

function concatenateSourceLines(repoRoot) {
  const { ordered, srcRoot } = collectSourceFiles(repoRoot)
  const lines = []
  /** @type {{ path: string, startGlobal: number, lineCount: number }[]} */
  const ranges = []
  let globalIndex = 0
  for (const abs of ordered) {
    let raw = fs.readFileSync(abs, 'utf8')
    if (abs.endsWith('.vue')) raw = stripVueStyleBlocks(raw)
    const fileLines = raw.split(/\r?\n/)
    const rel = relPosix(repoRoot, abs)
    const start = globalIndex + 1
    for (const line of fileLines) {
      lines.push(line)
      globalIndex += 1
    }
    ranges.push({ path: rel, startGlobal: start, lineCount: fileLines.length })
  }
  return { lines, ranges, srcRoot, fileCount: ordered.length }
}

/**
 * @returns {{ mode: 'all' | 'front-back', bodyLines: string[], lineNoStart: number[], totalSourceLines: number }}
 */
function selectIdentificationBody(allLines) {
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

function padToFullPages(bodyLines, lineNoStart) {
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

function fitLine(line, maxChars) {
  const s = String(line ?? '').replace(/\t/g, '  ')
  if (s.length <= maxChars) return s
  return s.slice(0, Math.max(0, maxChars - 1)) + '…'
}

function writePdf(bodyLines, lineNoStart, fontPath, meta) {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const pages = Math.ceil(bodyLines.length / LINES_PER_PAGE)
  const useLineNo = process.env.COPYRIGHT_LINE_NUMBERS === '1'

  const doc = new PDFDocument({
    size: 'A4',
    margin: 40,
    autoFirstPage: false,
    info: {
      Title: `${meta.softwareName} V${meta.version} 源程序鉴别材料`,
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
  /** 页眉：软件名 + 版本一行 */
  const headerReserve = 22
  /** 页脚：可选权利人一行 + 页码一行 */
  const footerReserve = hasRightsholderLine ? 36 : 22
  const contentTop = top + headerReserve
  const contentBottom = pageHeight - margin - footerReserve
  const usableHeight = contentBottom - contentTop

  const fontSize = fontPath ? 6.2 : 6.8
  const lineHeight = Math.min(14.05, usableHeight / LINES_PER_PAGE)
  const numWidth = useLineNo ? 7 : 0
  const maxChars = Math.max(56, Math.floor((textWidth - numWidth * (fontSize * 0.52)) / (fontSize * 0.52)))

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
      const g = lineNoStart[offset + i] ?? offset + i + 1
      const text = useLineNo ? `${String(g).padStart(6, '0')} ${fitLine(rawLine, maxChars - 8)}` : fitLine(rawLine, maxChars)
      doc.text(text, left, y, { width: textWidth, lineBreak: false, ellipsis: false })
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
  const { lines, ranges, srcRoot, fileCount } = concatenateSourceLines(ROOT)
  if (lines.length === 0) {
    console.error('未找到可拼接的源文件，请检查 src 目录。')
    process.exit(1)
  }

  const selected = selectIdentificationBody(lines)
  const { lines: bodyLines, lineNoStart } = padToFullPages(selected.bodyLines, selected.lineNoStart)

  const fontPath = resolveFontPath()
  if (!fontPath) {
    console.warn('未找到中文字体，中文可能显示为空白。可设置 COPYRIGHT_PDF_FONT。')
  } else {
    console.log('使用字体:', fontPath)
  }

  await writePdf(bodyLines, lineNoStart, fontPath, meta)

  console.log('')
  console.log('已生成:', OUT_PDF)
  console.log(`源根目录: ${relPosix(ROOT, srcRoot)}/  参与文件数: ${fileCount}  连续总行数: ${lines.length}`)
  console.log(
    `鉴别模式: ${selected.mode === 'all' ? `全部提交（总页数 ${bodyLines.length / LINES_PER_PAGE}，因不足 ${THRESHOLD_ALL} 行）` : `前 ${LINES_FRONT} 行 + 后 ${LINES_BACK} 行（共 60 页）`}`
  )
  console.log('页眉已印：', meta.softwareName, 'V' + meta.version, '| 页脚：页码', meta.rightsholder ? `| 权利人: ${meta.rightsholder}` : '| （权利人未设置，仅页脚无权利人行）')
  console.log('')
  console.log('连续源程序起止文件（供核对第 1 行与最后若干行来源）：')
  if (ranges.length) {
    const head = ranges.slice(0, 3)
    const tail = ranges.slice(-3)
    for (const r of head) {
      console.log(`  ${r.startGlobal}: ${r.path} (${r.lineCount} 行)`)
    }
    if (ranges.length > 6) console.log('  …')
    for (const r of tail) {
      console.log(`  ${r.startGlobal}: ${r.path} (${r.lineCount} 行)`)
    }
  }
  if (!meta.rightsholder) {
    console.warn('\n请务必配置 COPYRIGHT_RIGHTSHOLDER 或 copyright-meta.json 中的「权利人」，与申请表完全一致。\n')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
