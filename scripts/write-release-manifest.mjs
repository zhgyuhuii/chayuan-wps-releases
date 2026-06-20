#!/usr/bin/env node
/**
 * 构建完成后写入 release/.chayuan-last-build.json，标明当前产物对应的平台/架构。
 * 用法: node scripts/write-release-manifest.mjs <artifact-relative-path>
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { currentReleaseTriple, installHint } from './lib/release-platform.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readVersion() {
	const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
	return String(pkg.version || '0.0.0')
}

const artifactArg = process.argv[2]
if (!artifactArg) {
	console.error('Usage: node scripts/write-release-manifest.mjs <path-to-artifact>')
	process.exit(1)
}

const artifact = artifactArg.replace(/^\.\//, '')
const abs = path.isAbsolute(artifact) ? artifact : path.join(root, artifact)
if (!fs.existsSync(abs)) {
	console.error(`Artifact not found: ${abs}`)
	process.exit(1)
}

const { platform, arch, suffix } = currentReleaseTriple()
const version = readVersion()
const manifest = {
	version,
	platform,
	arch,
	suffix,
	artifact: artifact.replace(/\\/g, '/'),
	installSummary: installHint(platform, arch),
	builtAt: new Date().toISOString(),
}

const outDir = path.join(root, 'release')
fs.mkdirSync(outDir, { recursive: true })
const outFile = path.join(outDir, '.chayuan-last-build.json')
fs.writeFileSync(outFile, JSON.stringify(manifest, null, 2), 'utf8')
console.log(`Wrote ${path.relative(root, outFile)}`)
console.log(manifest.installSummary)
