#!/bin/sh

curdir="$(dirname "$0")"

root="$(
    cd "$curdir/../.."
    pwd
)"

(
    cd "$root"
    echo "Building an app..."
    node build
    echo "Done"
)

exec "$root/node_modules/.bin/qode" "$@"
