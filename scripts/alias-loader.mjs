import { fileURLToPath, pathToFileURL } from 'node:url'
import { existsSync, statSync } from 'node:fs'
import { resolve as r, dirname } from 'node:path'

const SRC = fileURLToPath(new URL('../src/', import.meta.url))

function tryExtensions(absBase) {
  const candidates = [absBase, absBase + '.ts', absBase + '.tsx', r(absBase, 'index.ts')]
  for (const c of candidates) {
    if (existsSync(c) && statSync(c).isFile()) return c
  }
  return null
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const found = tryExtensions(r(SRC, specifier.slice(2)))
    if (found) return nextResolve(pathToFileURL(found).href, context)
  }
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL) {
    const parentDir = dirname(fileURLToPath(context.parentURL))
    const found = tryExtensions(r(parentDir, specifier))
    if (found) return nextResolve(pathToFileURL(found).href, context)
  }
  return nextResolve(specifier, context)
}
