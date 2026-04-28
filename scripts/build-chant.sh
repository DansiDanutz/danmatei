#!/usr/bin/env bash
# =============================================================================
# build-chant.sh — bake a "crowd of kids shouting Unu, Doi, Trei, Dan Matei!"
# audio track and mux it onto the supplied football hero video.
#
# Inputs (in client/public, already in the repo from a prior pass):
#   chant-part1.wav   — single voice "Unu"      (~0.41s)
#   chant-part2.wav   — single voice "Doi"      (~0.41s)
#   chant-part3.wav   — single voice "Trei"     (~0.40s)
#   chant-part4.wav   — single voice "Dan Matei"(~0.84s)
#   crowd-base.wav    — 8s ambient crowd bed
#   crowd-roar.wav    — 3s peak cheer
#
# Trick to fake "many kids":
#   For each phrase we layer 5 copies of the source voice, each pitched up by
#   a different number of semitones (asetrate-based shift makes voices sound
#   younger AND faster — perfect for short shouts) with millisecond-level
#   time jitter so they don't sound like one voice with chorus, but a real
#   crowd. Then we glue the four phrases together with cadence pauses, drop
#   crowd-base under the whole thing, and hit crowd-roar after the name.
#
# Usage:
#   ./scripts/build-chant.sh path/to/source-video.mp4
# =============================================================================
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 <source-video.mp4>" >&2; exit 1
fi
SRC_VIDEO="$1"
if [[ ! -f "$SRC_VIDEO" ]]; then
  echo "video not found: $SRC_VIDEO" >&2; exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PUB="$ROOT/client/public"
OUT="$PUB/hero-chant.mp4"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

P1="$PUB/chant-part1.wav"   # Unu
P2="$PUB/chant-part2.wav"   # Doi
P3="$PUB/chant-part3.wav"   # Trei
P4="$PUB/chant-part4.wav"   # Dan Matei
BED="$PUB/crowd-base.wav"
ROAR="$PUB/crowd-roar.wav"
for f in "$P1" "$P2" "$P3" "$P4" "$BED" "$ROAR"; do
  [[ -f "$f" ]] || { echo "missing $f" >&2; exit 1; }
done

# ── 1. Build a "crowd-of-kids" version of each phrase ──────────────────────
# Five layers of the same source: pitched up 4/6/7/9/11 semitones (the
# higher shifts get quieter to keep the mix natural). Tiny time delays so
# the shouts don't lock into one voice. Final compressor smooths peaks.
make_kids () {
  local IN="$1" OUT_FILE="$2"
  ffmpeg -y -loglevel error \
    -i "$IN" -i "$IN" -i "$IN" -i "$IN" -i "$IN" \
    -filter_complex "
      [0]asetrate=44100*1.260,aresample=44100,adelay=0|0[v1];
      [1]asetrate=44100*1.414,aresample=44100,adelay=18|22[v2];
      [2]asetrate=44100*1.498,aresample=44100,adelay=42|36[v3];
      [3]asetrate=44100*1.682,aresample=44100,adelay=58|71[v4];
      [4]asetrate=44100*1.888,aresample=44100,adelay=86|74[v5];
      [v1][v2][v3][v4][v5]amix=inputs=5:weights='1 1 0.85 0.65 0.5':normalize=0,
      acompressor=threshold=-18dB:ratio=4:attack=8:release=80,
      volume=2.6,
      aformat=channel_layouts=stereo:sample_rates=44100
    " "$OUT_FILE"
}

echo "▸ building crowd-kids stems…"
make_kids "$P1" "$TMP/kids-unu.wav"
make_kids "$P2" "$TMP/kids-doi.wav"
make_kids "$P3" "$TMP/kids-trei.wav"

# Phrase 4 (the name) gets a heavier treatment: 7 layers + a reverb tail
# so it lands like a stadium chant.
ffmpeg -y -loglevel error \
  -i "$P4" -i "$P4" -i "$P4" -i "$P4" -i "$P4" -i "$P4" -i "$P4" \
  -filter_complex "
    [0]asetrate=44100*1.180,aresample=44100,adelay=0|0[a1];
    [1]asetrate=44100*1.300,aresample=44100,adelay=22|34[a2];
    [2]asetrate=44100*1.414,aresample=44100,adelay=46|60[a3];
    [3]asetrate=44100*1.498,aresample=44100,adelay=72|88[a4];
    [4]asetrate=44100*1.620,aresample=44100,adelay=104|118[a5];
    [5]asetrate=44100*1.781,aresample=44100,adelay=140|158[a6];
    [6]asetrate=44100*1.122,aresample=44100,adelay=12|6[a7];
    [a1][a2][a3][a4][a5][a6][a7]amix=inputs=7:weights='1 1 1 0.9 0.7 0.55 0.85':normalize=0,
    aecho=0.7:0.85:140|260|420:0.45|0.30|0.18,
    acompressor=threshold=-16dB:ratio=4.5:attack=6:release=120,
    volume=3.0,
    aformat=channel_layouts=stereo:sample_rates=44100
  " "$TMP/kids-name.wav"

# ── 2. Concat phrases with cadence pauses ──────────────────────────────────
# Cadence: short pause (260ms) between Unu/Doi/Trei, longer (420ms) before
# the name to land it like a chant. Single filter_complex, all sources
# fed via -i so the graph is well-connected.
ffmpeg -y -loglevel error \
  -i "$TMP/kids-unu.wav" \
  -i "$TMP/kids-doi.wav" \
  -i "$TMP/kids-trei.wav" \
  -i "$TMP/kids-name.wav" \
  -f lavfi -t 0.150 -i "anullsrc=r=44100:cl=stereo" \
  -f lavfi -t 0.260 -i "anullsrc=r=44100:cl=stereo" \
  -f lavfi -t 0.260 -i "anullsrc=r=44100:cl=stereo" \
  -f lavfi -t 0.420 -i "anullsrc=r=44100:cl=stereo" \
  -filter_complex "
    [0:a]aformat=channel_layouts=stereo:sample_rates=44100[u];
    [1:a]aformat=channel_layouts=stereo:sample_rates=44100[d];
    [2:a]aformat=channel_layouts=stereo:sample_rates=44100[t];
    [3:a]aformat=channel_layouts=stereo:sample_rates=44100[n];
    [4:a]aformat=channel_layouts=stereo:sample_rates=44100[lead];
    [5:a]aformat=channel_layouts=stereo:sample_rates=44100[g1];
    [6:a]aformat=channel_layouts=stereo:sample_rates=44100[g2];
    [7:a]aformat=channel_layouts=stereo:sample_rates=44100[g3];
    [lead][u][g1][d][g2][t][g3][n]concat=n=8:v=0:a=1[chant]
  " -map "[chant]" "$TMP/chant-dry.wav"

# ── 3. Bed + roar mix, locked to 6s video duration ─────────────────────────
# We trim the bed to 6s, drop it -10dB under the chant, fade in/out, and
# kick in the roar 3.6s in (right when the name hits) so it crests with
# the chant peak.
VID_DUR=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$SRC_VIDEO")
# Round down to 2 decimals so ffmpeg doesn't choke
VID_DUR=$(python3 -c "print(f'{float(\"$VID_DUR\"):.2f}')")
echo "▸ source video duration: ${VID_DUR}s"

ffmpeg -y -loglevel error \
  -i "$TMP/chant-dry.wav" \
  -i "$BED" \
  -i "$ROAR" \
  -filter_complex "
    [0:a]volume=1.0,aformat=channel_layouts=stereo:sample_rates=44100[chant];
    [1:a]aformat=channel_layouts=stereo:sample_rates=44100,
         atrim=0:${VID_DUR},asetpts=PTS-STARTPTS,
         volume=0.35,afade=t=in:st=0:d=0.4,afade=t=out:st=$(python3 -c "print(round(float('${VID_DUR}')-0.5,2))"):d=0.5[bed];
    [2:a]aformat=channel_layouts=stereo:sample_rates=44100,
         adelay=3600|3600,volume=0.55,afade=t=in:st=3.6:d=0.4,afade=t=out:st=$(python3 -c "print(round(float('${VID_DUR}')-0.4,2))"):d=0.4[roar];
    [chant][bed][roar]amix=inputs=3:weights='1 0.55 0.7':normalize=0,
    aformat=channel_layouts=stereo:sample_rates=44100,
    alimiter=limit=0.95,
    atrim=0:${VID_DUR},asetpts=PTS-STARTPTS
  " "$TMP/audio-final.wav"

# ── 4. Mix (NOT replace) the chant under the source video's own audio ──────
# The original Grok-generated clip has its own ambient/music track. We keep
# it (ducked slightly) and layer the kid-chant + crowd on top so the result
# is "full video as-is, plus the chant cheer".
echo "▸ muxing onto $SRC_VIDEO"
ffmpeg -y -loglevel error \
  -i "$SRC_VIDEO" \
  -i "$TMP/audio-final.wav" \
  -filter_complex "
    [0:a]aformat=channel_layouts=stereo:sample_rates=44100,
         volume=0.85[orig];
    [1:a]aformat=channel_layouts=stereo:sample_rates=44100,
         volume=1.10[chant];
    [orig][chant]amix=inputs=2:weights='1 1.2':normalize=0,
                 alimiter=limit=0.97,
                 aformat=channel_layouts=stereo:sample_rates=44100[final]
  " \
  -map 0:v:0 -map "[final]" \
  -c:v copy -c:a aac -b:a 192k -shortest \
  -movflags +faststart \
  "$OUT"

ls -lh "$OUT"
echo "✓ wrote $OUT"
