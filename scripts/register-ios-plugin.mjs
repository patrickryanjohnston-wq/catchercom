// Re-register app-local native iOS plugins after `npx cap sync`.
//
// Capacitor regenerates ios/App/App/capacitor.config.json's `packageClassList` from the
// INSTALLED packages each sync, dropping our app-local AudioSessionPlugin (the §5 mic
// passthrough). Capacitor only instantiates classes in that list, so without this the
// plugin reports "not implemented on ios". Run this after every cap sync (see the
// `sync:ios` npm script). The plugin's Swift file is in the Xcode project and AppDelegate
// keeps a reference to it so the Release linker doesn't strip it.

import { readFileSync, writeFileSync } from 'node:fs'

const CONFIG = 'ios/App/App/capacitor.config.json'
const APP_LOCAL_PLUGINS = ['AudioSessionPlugin']

const cfg = JSON.parse(readFileSync(CONFIG, 'utf8'))
cfg.packageClassList ??= []
let added = false
for (const cls of APP_LOCAL_PLUGINS) {
  if (!cfg.packageClassList.includes(cls)) {
    cfg.packageClassList.push(cls)
    added = true
  }
}
if (added) writeFileSync(CONFIG, JSON.stringify(cfg, null, 2) + '\n')
console.log('iOS app-local plugins registered:', cfg.packageClassList.join(', '))
