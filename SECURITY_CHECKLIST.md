# 🛡️ 安全部署检查清单

## 部署前必须完成

### 1. 修改默认密码 ⚠️ 重要

```bash
cd backend
# 编辑 .env 文件
nano .env
```

修改为强密码：
```
ADMIN_PASSWORD=你的强密码（至少12位，包含大小写+数字+符号）
```

### 2. 验证 JWT_SECRET 已设置为随机值

```bash
# 检查当前值
cat backend/.env | grep JWT_SECRET
```

如果不是随机字符串，请生成新的：
```bash
openssl rand -base64 32
```

### 3. 确认本地防火墙设置

确保 **没有** 将 3000 端口开放到公网：

```bash
# macOS - 检查防火墙状态
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate

# Linux
sudo iptables -L | grep 3000
```

### 4. 部署后验证IP隐藏

部署完成后，从外部验证：

```bash
# 在你的域名上运行
nslookup your-domain.com
# 应该返回 Cloudflare 的IP (如: 104.21.x.x, 172.67.x.x)
# 不应该显示你的真实公网IP
```

## 部署方案对比

| 方案 | 隐藏IP | 免费HTTPS | DDoS防护 | 难度 | 推荐 |
|------|--------|-----------|----------|------|------|
| Cloudflare Tunnel | ✅ 完全 | ✅ | ✅ | 低 | ⭐⭐⭐⭐⭐ |
| Railway | ✅ 完全 | ✅ | ✅ | 中 | ⭐⭐⭐⭐ |
| Ngrok免费版 | ⚠️ 部分 | ✅ | ❌ | 低 | ⭐⭐ |
| 直连+公网IP | ❌ 暴露 | 需配置 | ❌ | 高 | ❌ |

## 部署步骤（推荐 Cloudflare Tunnel）

### 第一步：安装 cloudflared

```bash
brew install cloudflared
```

### 第二步：运行一键部署脚本

```bash
./secure-deploy.sh
```

按照提示操作即可。

### 第三步：验证安全性

1. 访问 `https://你的域名`
2. 确认网站正常运行
3. 运行安全验证：
   ```bash
   nslookup 你的域名
   ```
   确认返回的是 Cloudflare IP 段

## 常见问题

### Q: 为什么不用 ngrok?
A: ngrok 免费版会显示 ngrok.io 域名，且每小时需要重启。Cloudflare Tunnel 更稳定且支持自定义域名。

### Q: 我的真实IP会被日志记录吗？
A: 使用 Cloudflare Tunnel 时：
- 访问者看到的IP是 Cloudflare 的
- 你的源站IP不会出现在任何公开DNS记录中
- 只有 Cloudflare 知道你的隧道端点

### Q: 如何停止服务？
A: 
- 停止隧道：`Ctrl+C` 或 `cloudflared tunnel stop 隧道名`
- 停止后端：`killall node` 或 `pkill -f "node server.js"`

### Q: 可以多人同时管理吗？
A: 可以分享管理员密码，但建议：
- 使用密码管理器分享
- 投票结束后修改密码
- 或使用 Cloudflare Access 添加额外的身份验证

## 紧急停用

如果需要立即下线：

```bash
# 停止隧道
cloudflared tunnel stop 隧道名

# 或删除DNS记录
cloudflared tunnel route dns delete 隧道名 域名

# 停止后端
pkill -f "node server.js"
```
