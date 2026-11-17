#!/usr/bin/env bash
mkdir -p tools; rm -rf tools/_b; mkdir -p tools/_b/core tools/_b/modules tools/_b/public
cp core/*.js tools/_b/core/ 2>/dev/null
cp modules/emergency*.js modules/emergency_full.js.bak-1794692394 modules/clinical_enhancements_v3.js tools/_b/modules/ 2>/dev/null
cp public/*.js public/index.html tools/_b/public/ 2>/dev/null
cp package.json tools/_b/ 2>/dev/null
tar czf tools/nabz-erf-bundle.tgz -C tools _b && rm -rf tools/_b
ls -lh tools/nabz-erf-bundle.tgz
if [ -d "$HOME/storage/downloads" ]; then cp tools/nabz-erf-bundle.tgz "$HOME/storage/downloads/" && echo "copied to Downloads"; fi
