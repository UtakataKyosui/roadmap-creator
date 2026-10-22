#!/bin/sh
# scripts/og-image.svg から public/og-image.png（1200x630）を生成する。macOS の qlmanage と sips を使う。
# qlmanage は正方形に描画し、SVG が 768px 四方のとき 1200px の出力で viewBox が 1200 単位幅に等倍になる。
# 630px 高のデザインを縦中央に置き、sips の中央切り出しで 1200x630 にする。
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
work=$(mktemp -d)
sed 's/width="1200" height="630" viewBox="0 0 1200 630"/width="768" height="768" viewBox="0 -285 1200 1200"/' "$root/scripts/og-image.svg" > "$work/og.svg"
qlmanage -t -s 1200 -o "$work" "$work/og.svg" > /dev/null 2>&1
sips -c 630 1200 "$work/og.svg.png" --out "$root/public/og-image.png" > /dev/null
