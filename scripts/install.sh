#!/usr/bin/env bash

echo 'we need privileges to install into /opt/dymo'
sudo mkdir /opt/dymo
sudo chmod -R 0777 /opt/dymo
cp ./dymo-scale /opt/dymo/dymo-scale
cp ./usb_bindings.node /opt/dymo/usb_bindings.node
echo 'binary copied'
echo 'installing udev rules'
sh ./udev-rules.sh
echo 'done'
