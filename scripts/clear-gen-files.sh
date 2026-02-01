#!/bin/bash

find . -type d -name "dist" -exec rm -rf {} +
find . -type f \( -name "lcov.info.*" -o -name ".lcov.info.*" \) -delete
