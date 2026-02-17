#!/bin/bash

# 安全部署脚本 - 使用 Cloudflare Tunnel
# 完全隐藏源站IP

set -e

echo "🛡️  安全部署脚本 - 隐藏源站IP"
echo "=============================="

# 检查 cloudflared 是否安装
if ! command -v cloudflared &> /dev/null; then
    echo "❌ cloudflared 未安装"
    echo ""
    echo "请根据你的系统安装："
    echo "  macOS:    brew install cloudflared"
    echo "  Linux:    https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
    echo "  Windows:  winget install --id Cloudflare.cloudflared"
    echo ""
    exit 1
fi

echo "✅ cloudflared 已安装"

# 检查后端是否在运行
if ! lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  后端服务未在端口 3000 运行"
    echo "请先启动后端: cd backend && node server.js"
    echo ""
    read -p "是否现在启动后端? (y/n): " start_backend
    if [[ $start_backend == "y" || $start_backend == "Y" ]]; then
        cd backend && node server.js &
        cd ..
        echo "⏳ 等待后端启动..."
        sleep 3
    else
        exit 1
    fi
fi

echo "✅ 后端服务运行中"

# 检查是否已登录
if [ ! -f "$HOME/.cloudflared/cert.pem" ]; then
    echo ""
    echo "🔑 需要登录 Cloudflare"
    echo "请按回车键开始登录..."
    read
    cloudflared tunnel login
fi

# 列出已有隧道
echo ""
echo "📋 检查已有隧道..."
cloudflared tunnel list 2>/dev/null || echo "暂无隧道"

# 创建或选择隧道
echo ""
echo "请选择操作："
echo "1) 创建新隧道"
echo "2) 使用已有隧道"
read -p "选择 (1/2): " choice

if [ "$choice" == "1" ]; then
    read -p "输入隧道名称 (如: voting-site): " tunnel_name
    echo "🔧 创建隧道: $tunnel_name"
    cloudflared tunnel create "$tunnel_name"
    
    # 获取隧道ID
    tunnel_id=$(cloudflared tunnel list | grep "$tunnel_name" | awk '{print $1}')
    
    read -p "输入你的域名 (如: vote.example.com): " domain
    
    # 创建配置文件
    config_dir="$HOME/.cloudflared"
    config_file="$config_dir/config.yml"
    cred_file="$config_dir/${tunnel_id}.json"
    
    echo "📝 创建配置文件..."
    cat > "$config_file" << EOF
tunnel: ${tunnel_id}
credentials-file: ${cred_file}

ingress:
  - hostname: ${domain}
    service: http://localhost:3000
    originRequest:
      connectTimeout: 30s
      tlsTimeout: 30s
      tcpKeepAlive: 30s
  - service: http_status:404
EOF
    
    # 添加 DNS 记录
    echo "🌐 添加 DNS 记录..."
    cloudflared tunnel route dns "$tunnel_name" "$domain"
    
    echo ""
    echo "✅ 隧道配置完成!"
    echo "   域名: https://$domain"
    echo ""
    
else
    # 使用已有隧道
    echo ""
    echo "可用隧道："
    cloudflared tunnel list
    echo ""
    read -p "输入要使用的隧道名称: " tunnel_name
fi

# 启动隧道
echo ""
echo "🚀 启动 Cloudflare Tunnel..."
echo "   你的源站IP将被完全隐藏!"
echo ""
echo "按 Ctrl+C 停止隧道"
echo "=============================="

cloudflared tunnel run "$tunnel_name"
