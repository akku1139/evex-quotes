#!/bin/sh
cd "$(dirname "$0")"
git pull
node --env-file=.env --experimental-strip-types src/index.ts
