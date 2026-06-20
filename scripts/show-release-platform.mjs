#!/usr/bin/env node
/** 打印当前机构建对应的平台/架构 ID（与安装包文件名一致）。 */
import { currentReleaseTriple, installHint } from './lib/release-platform.mjs'

const t = currentReleaseTriple()
console.log(JSON.stringify({ ...t, installSummary: installHint(t.platform, t.arch) }, null, 2))
