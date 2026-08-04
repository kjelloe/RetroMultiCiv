#!/usr/bin/env bash
# Verify the published container image WITHOUT a Docker daemon (release
# checklist step 4b, Path B — see docker-enable.md).
#
#   debugging/ghcr-verify.sh [owner/image]        # default kjelloe/retromulticiv
#
# Talks to the GHCR registry API as an ANONYMOUS client, which is the point:
# if the anonymous token is refused, the package is missing or still PRIVATE,
# and a private package is the silent failure mode of this whole step (it pulls
# fine for you because you are authenticated, and for nobody else).
#
# What this proves:      the image exists, its tags are there, an unauthenticated
#                        client can fetch it, and the manifest is well-formed.
# What it does NOT prove: that the container boots. Only the docker smoke does
#                        that. Report a Path-B-only verification as PARTIAL.
set -uo pipefail

IMAGE="${1:-kjelloe/retromulticiv}"
API="https://ghcr.io/v2/${IMAGE}"

say() { printf '%s\n' "$*"; }

resp=$(curl -s --max-time 20 "https://ghcr.io/token?scope=repository:${IMAGE}:pull" || echo '{}')
case "$resp" in
  *'"token"'*) ;;
  *)
    say "NOT VERIFIABLE — anonymous pull token refused for ${IMAGE}"
    say "  registry said: $(printf '%s' "$resp" | head -c 200)"
    say
    say "  Either the image has never been published (is PUBLISH_GHCR set, and did"
    say "  the publish job RUN rather than skip?), or the package exists but is"
    say "  still PRIVATE — GHCR packages pushed by Actions are private by default."
    say "  Fix: profile -> Packages -> ${IMAGE##*/} -> Package settings -> Public."
    exit 1
    ;;
esac
TOKEN=$(printf '%s' "$resp" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
[ -n "$TOKEN" ] || { say "token present but unparseable"; exit 1; }
say "anonymous pull token: OK (the package is public)"

tags=$(curl -s --max-time 20 -H "Authorization: Bearer $TOKEN" "${API}/tags/list")
say "tags: $(printf '%s' "$tags" | tr -d ' \n' | sed -n 's/.*"tags":\[\([^]]*\)\].*/\1/p')"

hdrs='-H Accept:application/vnd.oci.image.index.v1+json
      -H Accept:application/vnd.docker.distribution.manifest.list.v2+json
      -H Accept:application/vnd.oci.image.manifest.v1+json
      -H Accept:application/vnd.docker.distribution.manifest.v2+json'
# shellcheck disable=SC2086
man=$(curl -s --max-time 20 -H "Authorization: Bearer $TOKEN" $hdrs "${API}/manifests/latest")
code=$(curl -s --max-time 20 -o /dev/null -w '%{http_code}' \
       -H "Authorization: Bearer $TOKEN" $hdrs "${API}/manifests/latest")

say "manifest HTTP: $code"
[ "$code" = "200" ] || { say "manifest not fetchable — see the body:"; printf '%s\n' "$man" | head -c 400; exit 1; }

# `latest` may be an image manifest (layers inline) or an index pointing at
# per-arch manifests. Report what it IS rather than summing sizes blindly — an
# index's sizes are its child manifests, not the image, and summing them prints
# a misleading "0 MB".
digests=$(printf '%s' "$man" | grep -o '"digest"' | wc -l | tr -d ' ')
case "$man" in
  *'"manifests"'*) kind="index (multi-arch), ${digests} child manifest(s)" ;;
  *)              kind="image manifest, ${digests} blob digest(s)" ;;
esac
say "manifest: $kind"
say
say "VERIFIED (PARTIAL): published, public, manifest well-formed."
say "  NOT verified: that the container boots. Run the docker smoke for that —"
say "  docker-enable.md Path A."
