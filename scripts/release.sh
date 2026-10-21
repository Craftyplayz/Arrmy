#!/usr/bin/env bash
# Releases what is on main and deploys it: bash scripts/release.sh [X.Y.Z-rc.N] ["release notes"]
#
# 1. Makes the release commit off main (docker-compose.yml pinned to that image) with a temporary index, so the working
#    tree is never touched, then tags it vX.Y.Z and creates the GitHub release.
# 2. Waits for GitHub Actions to build that image.
# 3. Points the Portainer stack at the tag and redeploys it, keeping the stack's variables.
#
# Needs PORTAINER_URL (e.g. http://192.168.16.3:9000) and PORTAINER_TOKEN (an access token from Portainer → My account)
# in .env; this script is the only thing that reads them. The stack is the one named "arrmy" (STACK_NAME to change).
set -euo pipefail
cd "$(dirname "$0")/.."

envval() { grep -E "^$1=" .env | head -n1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/; s/\r$//'; }
PORTAINER_URL="${PORTAINER_URL:-$(envval PORTAINER_URL)}"
PORTAINER_TOKEN="${PORTAINER_TOKEN:-$(envval PORTAINER_TOKEN)}"
STACK_NAME="${STACK_NAME:-arrmy}"
[ -n "$PORTAINER_URL" ] && [ -n "$PORTAINER_TOKEN" ] || { echo "PORTAINER_URL and PORTAINER_TOKEN must be set in .env" >&2; exit 1; }
PORTAINER_URL="${PORTAINER_URL%/}"

[ "$(git branch --show-current)" = main ] || { echo "Release from main." >&2; exit 1; }
git fetch -q origin main
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || { echo "HEAD isn't what is on origin/main: push (or pull) first." >&2; exit 1; }
git diff --quiet HEAD -- src package.json Dockerfile docker-compose.yml || { echo "Uncommitted changes in the code: commit them first, they would not be in the image." >&2; exit 1; }

# the version: given, or the next rc after the newest tag
if [ -n "${1:-}" ]; then
  VERSION="$1"
else
  LAST="$(git tag -l 'v*-rc.*' --sort=-v:refname | head -n1)"
  [ -n "$LAST" ] || { echo "No rc tag to count on from: give a version." >&2; exit 1; }
  VERSION="${LAST#v}"
  VERSION="${VERSION%.*}.$(( ${VERSION##*.} + 1 ))"
fi
TAG="v$VERSION"
NOTES="${2:-Arrmy $VERSION}"
RESUME=0; git rev-parse -q --verify "refs/tags/$TAG" >/dev/null && RESUME=1 # an interrupted release carries on from its tag
echo "Releasing $TAG from $(git rev-parse --short HEAD)"


if [ "$RESUME" = 0 ]; then
# --- release commit off main, temporary index ---
BASE="$(git rev-parse HEAD)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
export GIT_INDEX_FILE="$TMP/index"
git read-tree "$BASE"
git show "$BASE:docker-compose.yml" | sed "s#craftyplayz/arrmy:latest#craftyplayz/arrmy:$VERSION#" > "$TMP/compose.yml"
grep -q "arrmy:$VERSION" "$TMP/compose.yml" || { echo "docker-compose.yml has no arrmy:latest to pin." >&2; exit 1; }
git update-index --cacheinfo "100644,$(git hash-object -w --path=docker-compose.yml "$TMP/compose.yml"),docker-compose.yml"
COMMIT="$(git commit-tree "$(git write-tree)" -p "$BASE" -m "Release $VERSION

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>")"
unset GIT_INDEX_FILE

git tag -a "$TAG" "$COMMIT" -m "Arrmy $VERSION"
git push -q origin "$TAG"
PRE=(); [[ "$VERSION" == *-* ]] && PRE=(--prerelease)
gh release create "$TAG" --verify-tag "${PRE[@]}" --title "Arrmy $VERSION" --notes "$NOTES"

fi

# --- wait for the image ---
echo "Waiting for GitHub Actions to build arrmy:$VERSION..."
RUN=""
for _ in $(seq 1 30); do
  RUN="$(gh run list --branch "$TAG" --limit 1 --json databaseId --jq '.[0].databaseId // empty')"
  [ -n "$RUN" ] && break
  sleep 10
done
[ -n "$RUN" ] || { echo "No build started for $TAG: check GitHub Actions, then redeploy by hand." >&2; exit 1; }
gh run watch "$RUN" --exit-status >/dev/null || { echo "The image build failed: https://github.com/Craftyplayz/Arrmy/actions/runs/$RUN" >&2; exit 1; }

# --- Portainer ---
api() { curl -fsS -H "X-API-Key: $PORTAINER_TOKEN" -H 'Content-Type: application/json' "$@"; }
STACK="$(api "$PORTAINER_URL/api/stacks" | node -e '
  const stacks = JSON.parse(require("fs").readFileSync(0, "utf8"))
  const s = stacks.find((s) => s.Name === process.argv[1])
  if (!s) { console.error("No Portainer stack named " + process.argv[1]); process.exit(1) }
  // keep the stack'"'"'s variables: a redeploy without them would clear them
  console.log(JSON.stringify({ id: s.Id, endpoint: s.EndpointId, body: { env: s.Env ?? [], prune: false, pullImage: true, repositoryReferenceName: "refs/tags/" + process.argv[2], repositoryAuthentication: false } }))
' "$STACK_NAME" "$TAG")"
ID="$(node -pe 'JSON.parse(process.argv[1]).id' "$STACK")"
ENDPOINT="$(node -pe 'JSON.parse(process.argv[1]).endpoint' "$STACK")"
BODY="$(node -pe 'JSON.stringify(JSON.parse(process.argv[1]).body)' "$STACK")"
api -X PUT "$PORTAINER_URL/api/stacks/$ID/git/redeploy?endpointId=$ENDPOINT" -d "$BODY" >/dev/null
echo "Deployed $TAG: Portainer is pulling arrmy:$VERSION."
