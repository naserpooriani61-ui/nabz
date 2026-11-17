#!/bin/bash
cd /sdcard/Download/nabz || exit 1
for f in core/state-machine.js core/permissions.js modules/emergency.js modules/emergency_full.js core/domain/ed-esi.js core/config/ed-config.json tools/push-files.sh; do
  [ -f "$f.bak-28a" ] && cp "$f.bak-28a" "$f" && echo "restored $f"
done
