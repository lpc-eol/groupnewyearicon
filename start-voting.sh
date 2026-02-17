#!/bin/bash
# QQ Voting System Startup Script
# 启动投票系统和 Cloudflare 隧道

echo "🚀 启动 QQ 投票系统..."

# 1. 启动后端
echo "📡 启动后端服务..."
cd /Users/leochoizero/Desktop/code_folder/website_new_year_icon/backend

# 检查是否已在运行
if lsof -i:3000 > /dev/null 2>&1; then
    echo "   ✅ 后端已在运行"
else
    nohup node server.js > /tmp/voting-server.log 2>&1 &
    sleep 3
    if lsof -i:3000 > /dev/null 2>&1; then
        echo "   ✅ 后端启动成功 (PID: $!)"
    else
        echo "   ❌ 后端启动失败"
        exit 1
    fi
fi

# 2. 启动 Named Tunnel（固定地址，DNS生效后可用）
echo "🌐 启动 Named Tunnel（固定地址）..."
if pgrep -f "cloudflared tunnel run qq-voting-app" > /dev/null; then
    echo "   ✅ Named Tunnel 已在运行"
else
    nohup cloudflared tunnel run qq-voting-app > /tmp/named-tunnel.log 2>&1 &
    sleep 3
    echo "   ✅ Named Tunnel 已启动 (PID: $!)"
fi

# 3. 启动 Quick Tunnel（立即可用）
echo "⚡ 启动 Quick Tunnel（临时地址）..."
if pgrep -f "cloudflared tunnel --url http://localhost:3000" > /dev/null; then
    echo "   ✅ Quick Tunnel 已在运行"
else
    nohup cloudflared tunnel --url http://localhost:3000 > /tmp/quick-tunnel.log 2>&1 &
    sleep 5
fi

# 4. 获取当前地址
echo ""
echo "═══════════════════════════════════════════════════"
echo "🎉 投票系统已启动！"
echo "═══════════════════════════════════════════════════"
echo ""

# 获取 Quick Tunnel URL
QUICK_URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' /tmp/quick-tunnel.log 2>/dev/null | head -1)

if [ -n "$QUICK_URL" ]; then
    echo "【当前可用地址】（立即可用）："
    echo "  🔗 主页:     $QUICK_URL"
    echo "  🔐 管理后台: $QUICK_URL/admin.html"
    echo ""
fi

echo "【固定地址】（DNS 修复后永久可用）："
echo "  🔗 主页:     https://qq-voting-app-432f2647.groupnewyearicon.com"
echo "  🔐 管理后台: https://qq-voting-admin-432f2647.groupnewyearicon.com/admin.html"
echo ""
echo "═══════════════════════════════════════════════════"
echo ""
echo "🔑 管理后台密码: cs1002A5662qq"
echo ""
echo "Named Tunnel ID: 432f2647-fde7-4849-9f54-6af56276a139"
echo ""
echo "⚠️  注意："
echo "   - Quick Tunnel 地址每次重启会变"
echo "   - Named Tunnel 地址永久固定（需修复 groupnewyearicon.com DNS）"
echo ""
echo "═══════════════════════════════════════════════════"
