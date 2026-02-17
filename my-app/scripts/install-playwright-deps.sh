#!/bin/bash
# Playwright 系统依赖安装脚本

echo "正在安装 Playwright 所需的系统依赖..."

sudo apt-get update

sudo apt-get install -y \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    libatspi2.0-0

echo "依赖安装完成！"
echo ""
echo "现在可以运行 Playwright 截图了:"
echo "  cd /home/iceonme/CTS/my-app \&\& node scripts/screenshot.js"
