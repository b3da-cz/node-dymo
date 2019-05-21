#!/usr/bin/env bash

echo 'last node version supported by pkg is 10! make sure you are running on v10. currently running:'
node -v
mkdir dist
pkg build.js  --targets=node10-linux-x64 -o=dist/dymo-scale
echo 'packaged successfully'
cp node_modules/usb/src/binding/usb_bindings.node dist/usb_bindings.node
cp scripts/install.sh dist/install.sh
chmod +x dist/install.sh
cp scripts/udev-rules.sh dist/udev-rules.sh
chmod +x dist/udev-rules.sh
cp scripts/udev-dymo-scale.rules dist/udev-dymo-scale.rules
echo 'the dist folder is ready to be deployed!'
