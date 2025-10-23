#!/bin/sh
git pull
node --env-file=.env --experimental-strip-types src/index.ts
