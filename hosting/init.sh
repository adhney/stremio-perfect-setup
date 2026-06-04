#!/usr/bin/env bash

# Download the set of scripts needed for the automated hosting setup.
# Make the script executable with `chmod +x init.sh` and run it with `./init.sh`.
# Begin here and after the scripts are downloaded, execute `./hosting/main.sh` to start the setup.

set -Eeuo pipefail

TEMP_REPO="$(mktemp -d ./temp-repo.XXXXXX)"
trap 'rm -rf "${TEMP_REPO}"' EXIT

git clone --filter=blob:none --sparse https://github.com/luckynumb3rs/stremio-perfect-setup.git "${TEMP_REPO}"
(
  cd "${TEMP_REPO}"
  git sparse-checkout set hosting
)

# Only remove the old copy and put the new one in place once the clone succeeded.
rm -rf hosting/
cp -r "${TEMP_REPO}/hosting" ./hosting
