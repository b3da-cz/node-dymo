#!/usr/bin/env bash

sudo cp ./udev-dymo-scale.rules /etc/udev/rules.d/50-dymo-scale.rules
sudo udevadm control --reload-rules

echo 'udev rules installed'
echo 'please replug the usb device!'
