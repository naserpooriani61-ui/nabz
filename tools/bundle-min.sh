#!/usr/bin/env bash
mkdir -p tools/_m
cp public/erf_ui.js public/zz_drawer_v3.js core/kernel.js tools/_m/ 2>/dev/null
ls -l tools/_m
tar czf tools/nabz-min.tgz -C tools _m && rm -rf tools/_m
ls -lh tools/nabz-min.tgz
if [ -d "$HOME/storage/downloads" ]; then cp tools/nabz-min.tgz "$HOME/storage/downloads/" && echo "copied to Downloads"; fi
