/**
 * 软著鉴别材料：权利人、软件全称、版本号（须与申请表及其他材料一致）。
 * 环境变量 > copyright-meta.json > 默认值。
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const COPYRIGHT_REPO_ROOT = path.resolve(__dirname, '../..')

export function readPackageJson(root = COPYRIGHT_REPO_ROOT) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  } catch {
    return {}
  }
}

export function readPackageVersion(root = COPYRIGHT_REPO_ROOT) {
  const v = readPackageJson(root).version
  return v != null && String(v).trim() ? String(v).trim() : '1.0.0'
}

export function resolveCopyrightMeta(root = COPYRIGHT_REPO_ROOT) {
  const defaultVersion = readPackageVersion(root)
  const metaPath = process.env.COPYRIGHT_META_FILE || path.join(root, 'copyright-meta.json')
  let fileMeta = {}
  if (fs.existsSync(metaPath)) {
    try {
      fileMeta = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
    } catch (e) {
      console.warn('读取 copyright-meta.json 失败，已忽略:', e?.message || e)
    }
  }
  const pick = (envKey, ...jsonKeys) => {
    const ev = process.env[envKey]
    if (ev != null && String(ev).trim()) return String(ev).trim()
    for (const k of jsonKeys) {
      if (fileMeta[k] != null && String(fileMeta[k]).trim()) return String(fileMeta[k]).trim()
    }
    return ''
  }
  const rightsholder =
    pick('COPYRIGHT_RIGHTSHOLDER', 'rightsholder', '权利人', '张玉辉') ||
    pick('COPYRIGHT_OWNER', 'owner')
  const softwareName =
    pick('COPYRIGHT_SOFTWARE_NAME', 'softwareName', '软件名称', '软件全称') || '察元 AI 文档助手'
  const version =
    pick('COPYRIGHT_SOFTWARE_VERSION', 'version', '软件版本', '软件版本号') || defaultVersion
  return { rightsholder, softwareName, version, metaPath }
}
