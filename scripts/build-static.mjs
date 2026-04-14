import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const dist = resolve(root, 'dist')

if (existsSync(dist)) {
  rmSync(dist, { recursive: true, force: true })
}

mkdirSync(dist, { recursive: true })
cpSync(resolve(root, 'index.html'), resolve(dist, 'index.html'))
cpSync(resolve(root, 'styles.css'), resolve(dist, 'styles.css'))
cpSync(resolve(root, 'sw.js'), resolve(dist, 'sw.js'))
cpSync(resolve(root, 'src'), resolve(dist, 'src'), { recursive: true })
cpSync(resolve(root, 'public'), dist, { recursive: true })
