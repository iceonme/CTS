#!/bin/bash
# CryptoPulse AI 健康检查脚本

URL="http://localhost:3000"
LOG_FILE="/home/iceonme/CTS/my-app/logs/healthcheck.log"
PID_FILE="/tmp/cryptopulse-healthcheck.pid"

# 防止重复运行
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    if ps -p "$OLD_PID" > /dev/null 2>&1; then
        echo "[$$(date)] 健康检查已在运行 (PID: $OLD_PID)" >> "$LOG_FILE"
        exit 0
    fi
fi
echo $$ > "$PID_FILE"

# 确保日志目录存在
mkdir -p "$(dirname "$LOG_FILE")"

# 检查服务状态
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$URL" 2>/dev/null)

if [ "$HTTP_CODE" = "200" ]; then
    echo "[$$(date)] ✅ 服务正常 (HTTP $HTTP_CODE)" >> "$LOG_FILE"
    # 保留最近100行日志
    tail -n 100 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
else
    echo "[$$(date)] ❌ 服务异常 (HTTP: ${HTTP_CODE:-无响应})" >> "$LOG_FILE"
    
    # 检查 Next.js 进程
    if ! pgrep -f "next-server" > /dev/null; then
        echo "[$$(date)] 🔄 Next.js 未运行，尝试重启..." >> "$LOG_FILE"
        cd /home/iceonme/CTS/my-app
        nohup npm run dev > /tmp/next-dev.log 2>&1 &
        sleep 5
        
        # 验证重启
        NEW_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$URL" 2>/dev/null)
        if [ "$NEW_CODE" = "200" ]; then
            echo "[$$(date)] ✅ 重启成功" >> "$LOG_FILE"
        else
            echo "[$$(date)] ❌ 重启失败，请手动检查" >> "$LOG_FILE"
        fi
    fi
fi

rm -f "$PID_FILE"
