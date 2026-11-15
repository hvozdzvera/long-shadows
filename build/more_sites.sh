#!/bin/bash
# plan and rover data for more sites (Expert mode). Usage: bash more_sites.sh gerlache shackleton
cd "$(dirname "$0")"
for S in "$@"; do
  export LS_SITE=$S; echo "=== $S $(date +%H:%M:%S)"
  python3 plan_v4.py && python3 plan_contours.py && python3 lightmap.py | tail -2
  python3 rover_data.py part 0 2 > rover_${S}_p0.log 2>&1 &
  python3 rover_data.py part 1 2 > rover_${S}_p1.log 2>&1
  wait
  python3 rover_data.py join 2
  echo "=== $S done $(date +%H:%M:%S)"
done
