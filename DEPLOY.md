# 安全部署指南 - 隐藏源站IP

## 方案一：Cloudflare Tunnel（推荐 ⭐⭐⭐⭐⭐）

**优点：**
- ✅ 完全隐藏源站IP（用户只能看到 Cloudflare 的IP）
- ✅ 免费SSL证书（HTTPS）
- ✅ DDoS防护
- ✅ 无需开放本地端口到公网
- ✅ 支持自定义域名

### 步骤：

#### 1. 安装 cloudflared
```bash
# macOS
brew install cloudflared

# Linux
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb && sudo dpkg -i cloudflared.deb

# Windows (使用 PowerShell)
winget install --id Cloudflare.cloudflared
```

#### 2. 登录 Cloudflare
```bash
cloudflared tunnel login
```
这会打开浏览器让你授权，选择一个域名。

#### 3. 创建隧道
```bash
cloudflared tunnel create voting-site
```
记住输出的 **Tunnel ID**（格式如：xxxxx-xxxxx-xxxxx-xxxxx）

#### 4. 配置隧道
编辑配置文件（路径会显示在创建后的输出中，通常在 `~/.cloudflared/`）：

```yaml
# ~/.cloudflared/config.yml
tunnel: <你的 Tunnel ID>
credentials-file: /Users/<用户名>/.cloudflared/<Tunnel ID>.json

ingress:
  - hostname: vote.yourdomain.com  # 你的子域名
    service: http://localhost:3000
  - service: http_status:404
```

#### 5. 添加 DNS 记录
```bash
cloudflared tunnel route dns voting-site vote.yourdomain.com
```

#### 6. 启动隧道
```bash
cloudflared tunnel run voting-site
```

#### 7. 后台运行（Mac/Linux）
```bash
# 安装为服务
sudo cloudflared service install
sudo cloudflared service start
```

---

## 方案二：部署到 Railway（推荐 ⭐⭐⭐⭐）

**优点：** 无需本机运行，完全隐藏你的网络信息

### 步骤：

1. 准备 Dockerfile（在项目根目录）
2. 推送到 GitHub
3. 在 Railway 上连接 GitHub 仓库部署

---

## 方案三：Ngrok（临时测试 ⭐⭐）

**注意：** Ngrok 免费版会暴露 ngrok.io 域名，且每小时需要重启。

```bash
# 安装
brew install ngrok

# 配置 token（从 ngrok.com 获取）
ngrok config add-authtoken YOUR_TOKEN

# 启动
ngrok http 3000
```

---

## 安全建议

### 1. 修改默认密码
```bash
# 编辑 backend/.env
ADMIN_PASSWORD=你的强密码
JWT_SECRET=随机长字符串
```

### 2. 启用 HTTPS（Cloudflare 自动处理）

### 3. 限制管理员访问（可选）
在 Cloudflare 可以设置：
- IP 白名单
- 国家/地区限制
- 验证码保护

### 4. 检查没有泄露真实IP
```bash
# 部署后，从外网服务器测试
nslookup vote.yourdomain.com
# 应该返回 Cloudflare 的IP，不是你的真实IP
```

---

## 快速检查清单

- [ ] 修改了默认管理员密码
- [ ] 配置了强 JWT_SECRET
- [ ] 使用了 HTTPS
- [ ] 验证 DNS 解析到 Cloudflare 而不是源站
- [ ] 防火墙没有开放 3000 端口到公网
