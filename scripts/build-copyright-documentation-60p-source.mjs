#!/usr/bin/env node
/**
 * 生成《软件设计说明与源码结构》长文档（≥3000 行，对应 A4、每页 50 行时不少于 60 页），
 * 供文档鉴别材料截取「前 30 页 + 后 30 页」使用。内容包含：登记信息、总体架构、目录树、
 * 各源文件路径/行数/作用简述及少量代码摘录。
 *
 * 输出：artifacts/copyright-design-document-60p.zh.md
 *
 * 用法：node scripts/build-copyright-documentation-60p-source.mjs
 * 或与 PDF 一并：npm run generate:copyright-documentation-60p
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveCopyrightMeta, COPYRIGHT_REPO_ROOT } from './lib/copyrightMeta.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = COPYRIGHT_REPO_ROOT
const OUT_REL = 'artifacts/copyright-design-document-60p.zh.md'
const OUT_ABS = path.join(ROOT, OUT_REL)
const MIN_LINES = 3000

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

const KEY_SOURCE_FILES_REL = [
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

function collectOrderedSourceFiles(repoRoot) {
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
  for (const rel of KEY_SOURCE_FILES_REL) {
    const abs = path.resolve(repoRoot, rel)
    if (set.has(abs) && !seen.has(abs)) {
      ordered.push(abs)
      seen.add(abs)
    }
  }
  ordered.push(
    ...[...set]
      .filter((abs) => !seen.has(abs))
      .sort((a, b) => relPosix(repoRoot, a).localeCompare(relPosix(repoRoot, b)))
  )
  return ordered
}

function stripVueStyleBlocks(source) {
  return String(source || '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
}

function extractLeadingCommentSummary(source, maxLines = 10) {
  const lines = source.split(/\r?\n/)
  const out = []
  let inBlock = false
  for (const line of lines) {
    const t = line.trim()
    if (out.length >= maxLines) break
    if (t.startsWith('/**') || t.startsWith('/*')) inBlock = true
    if (inBlock || t.startsWith('//') || t.startsWith('*')) {
      if (t && !t.startsWith('import ') && !t.startsWith('export default')) out.push(t)
      if (t.includes('*/')) {
        inBlock = false
        if (out.length) break
      }
    } else if (t && !t.startsWith('<') && !t.startsWith('import ') && out.length === 0) {
      out.push(t)
      break
    }
    if (!inBlock && out.length && !t.startsWith('//') && !t.startsWith('*') && t) break
  }
  return out.slice(0, maxLines).join('；').replace(/\s+/g, ' ').trim() || '（见源码内注释与命名）'
}

function inferRoleFromPath(rel) {
  const r = rel.replace(/^src\//, '')
  if (r.includes('router')) return 'Vue Router 路由定义，负责各对话框与功能页入口路径。'
  if (r.includes('ribbon.js')) return 'WPS 功能区与右键菜单回调、模型菜单、OnAction 分发及 ribbon 导出。'
  if (r.includes('chatApi')) return 'OpenAI 兼容 Chat Completions 流式/非流式请求与错误归一化。'
  if (r.includes('modelSettings')) return '模型与供应商配置读写、Ribbon 模型启用判断、compositeId 解析。'
  if (r.includes('documentActions')) return '文档写回：插入、替换、批注及与 WPS 文档对象模型交互。'
  if (r.includes('documentComment')) return '智能批注任务：分段、调用模型、解析 JSON、写入批注。'
  if (r.includes('spellCheck')) return '拼写检查与按锚点添加批注等辅助逻辑。'
  if (r.includes('assistantTaskRunner')) return '助手任务创建、执行与任务状态更新。'
  if (r.includes('AIAssistantDialog')) return 'AI 助手主对话框界面与对话、写回交互。'
  if (r.includes('SettingsDialog')) return '综合设置（模型、助手、路径等）对话框。'
  if (r.endsWith('main.js')) return '应用入口：挂载 Vue、注册路由与全局桥接。'
  if (r.endsWith('App.vue')) return '根组件与路由出口、Ribbon 挂载到 window。'
  if (r.includes('components/') && r.endsWith('.vue')) return 'Vue 单文件组件：界面与业务片段。'
  if (r.includes('utils/')) return '工具与业务子模块。'
  return '源代码文件，承担具体界面或业务实现。'
}

function buildFileSection(repoRoot, absPath) {
  const rel = relPosix(repoRoot, absPath)
  let raw = fs.readFileSync(absPath, 'utf8')
  if (absPath.endsWith('.vue')) raw = stripVueStyleBlocks(raw)
  const allLines = raw.split(/\r?\n/)
  const lineCount = allLines.length
  let summary = extractLeadingCommentSummary(raw)
  if (absPath.endsWith('.vue') && (summary.startsWith('<') || summary.length < 8)) {
    summary = inferRoleFromPath(rel)
  } else {
    summary = `${summary} ${inferRoleFromPath(rel)}`.trim()
  }
  const excerptLines = allLines.slice(0, Math.min(22, allLines.length)).map((l) => `    ${l}`)

  const block = []
  block.push('')
  block.push('-'.repeat(76))
  block.push(`文件路径：${rel}`)
  block.push(`物理行数：${lineCount}（生成时统计，不含已剔除的 <style> 块行）`)
  block.push('作用与职责简述：')
  block.push(summary)
  block.push('以下为该文件开头的若干行：')
  block.push(...excerptLines)
  block.push('-'.repeat(76))
  return block
}

function buildDirectoryTreeLines(repoRoot) {
  const srcRoot = path.join(repoRoot, 'src')
  const lines = ['', '## 附录 A：src 目录树（一级与二级）', '']
  if (!fs.existsSync(srcRoot)) return lines
  for (const ent of fs.readdirSync(srcRoot, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.join(srcRoot, ent.name)
    const rel = `src/${ent.name}`
    if (ent.isDirectory()) {
      lines.push(`${rel}/`)
      try {
        const sub = fs.readdirSync(p, { withFileTypes: true }).slice(0, 40)
        for (const s of sub.sort((a, b) => a.name.localeCompare(b.name))) {
          lines.push(`  ${rel}/${s.name}${s.isDirectory() ? '/' : ''}`)
        }
        if (fs.readdirSync(p).length > 40) lines.push(`  …（其余条目已省略）`)
      } catch {
        lines.push(`  （无法列出子项）`)
      }
    } else {
      lines.push(rel)
    }
  }
  lines.push('')
  return lines
}

function padToMinLines(lines, meta, orderedFiles, repoRoot) {
  let n = 1
  while (lines.length < MIN_LINES) {
    lines.push('')
    lines.push(`## 附录 C：补充索引（自动补页至不少于 ${MIN_LINES} 行）第 ${n} 段`)
    lines.push(
      `本段为自动补页；软件名称 ${meta.softwareName}、版本 ${meta.version}、著作权人 ${meta.rightsholder || '见申请表'} 须与申请表一致。`
    )
    for (const abs of orderedFiles) {
      if (lines.length >= MIN_LINES) break
      lines.push(`- ${relPosix(repoRoot, abs)}`)
    }
    lines.push('')
    n += 1
    if (n > 200) break
  }
}

function main() {
  const meta = resolveCopyrightMeta(ROOT)
  const ordered = collectOrderedSourceFiles(ROOT)
  const lines = []

  lines.push('# 软件设计说明与源码结构')
  lines.push('')
  lines.push(`**软件全称**：${meta.softwareName}`)
  lines.push(`**版本号**：${meta.version}`)
  lines.push(`**著作权人**：${meta.rightsholder || '（请填写并与申请表一致）'}`)
  lines.push('')
  lines.push('## 一、编写目的与范围')
  lines.push(
    '本文档介绍本软件的总体结构、主要目录与各源文件职责，并列出各文件开头的若干行源码，便于对照程序组成与模块位置。文档不替代完整用户手册；操作说明请参阅产品内帮助与 README。'
  )
  lines.push('')
  lines.push('## 二、技术栈与运行形态')
  lines.push(
    '本软件为 WPS 文字加载项：前端采用 Vue 3 与 Vite 构建；通过 WPS JSAPI 与宿主文档交互；通过 HTTP 调用 OpenAI 兼容的大模型接口。源码主要位于 `src/` 目录。'
  )
  lines.push('')
  lines.push('## 三、总体架构（逻辑分层）')
  lines.push('1. 入口层：`main.js` 创建应用、安装路由与全局桥接。')
  lines.push('2. 壳层：`App.vue`、`router` 管理多路由对话框与页面。')
  lines.push('3. 宿主集成层：`ribbon.js` 等，对接 WPS Ribbon/右键与窗口 API。')
  lines.push('4. 业务能力层：`utils/*` 与各业务 `*.vue`，实现模型请求、文档写回、助手任务等。')
  lines.push('5. 资源层：`public/`、`assets/` 中静态资源（本说明正文不展开二进制资源）。')
  lines.push('')
  lines.push(...buildDirectoryTreeLines(ROOT))
  lines.push('## 四、源文件逐文件说明与摘录')
  lines.push('')
  lines.push('以下按「关键路径优先、其余字典序」排列；每节给出路径、行数、职责简述及文件开头的若干行源码。')

  for (const abs of ordered) {
    try {
      lines.push(...buildFileSection(ROOT, abs))
    } catch (e) {
      lines.push('', `（读取失败：${relPosix(ROOT, abs)}：${e.message || e}）`, '')
    }
  }

  padToMinLines(lines, meta, ordered, ROOT)

  fs.mkdirSync(path.dirname(OUT_ABS), { recursive: true })
  fs.writeFileSync(OUT_ABS, lines.join('\n'), 'utf8')
  const lc = lines.length
  console.log('已写入:', OUT_REL)
  console.log(`总行数: ${lc}（目标 ≥ ${MIN_LINES}）${lc >= MIN_LINES ? '，满足不少于 60 页（按每页 50 行计）' : '，未达标请检查源码树'}`)
}

main()
