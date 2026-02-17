# 🆓 完全免费部署方案（无需购买域名）

使用 **Render** 免费托管，送你永久免费的子域名如：`your-app.onrender.com`

---

## 方案对比

| 平台 | 费用 | 子域名 | 适合场景 |
|------|------|--------|----------|
| **Render** ⭐ | 免费 | `xxx.onrender.com` | ✅ **推荐！** Node.js 支持好 |
| **Railway** | 免费额度 | `xxx.up.railway.app` | 也可以，但有使用限制 |
| **Cloudflare Pages** | 免费 | `xxx.pages.dev` | ❌ 只适合静态网站，不支持 Node.js |

---

## 🚀 Render 部署步骤（推荐）

### 步骤 1：创建 GitHub 仓库

把你的代码推送到 GitHub：

```bash
# 1. 在项目根目录初始化 git
cd /Users/leochoizero/Desktop/code_folder/website_new_year_icon
git init

# 2. 创建 .gitignore（避免提交 node_modules）
echo "node_modules/
.env
.DS_Store
*.log" > .gitignore

# 3. 添加所有文件
git add .

# 4. 提交
git commit -m "Initial commit"

# 5. 在 GitHub 创建新仓库（去 https://github.com/new）
# 然后推送
git remote add origin https://github.com/你的用户名/仓库名.git
git branch -M main
git push -u origin main
```

### 步骤 2：注册 Render

1. 访问 https://render.com
2. 点击 **Get Started for Free**
3. 选择 **Continue with GitHub**（用 GitHub 账号登录）

### 步骤 3：创建 Web Service

1. 登录后点击 **New +** → **Web Service**
2. 选择你刚才推送的 GitHub 仓库
3. 填写配置：

| 配置项 | 值 |
|--------|-----|
| **Name** | `groupnewyearicon` （任意，会作为子域名） |
| **Runtime** | Node |
| **Build Command** | `cd backend && npm install` |
| **Start Command** | `cd backend && npm start` |
| **Plan** | Free |

4. 点击 **Create Web Service**
5. 等待部署完成（约 2-3 分钟）

### 步骤 4：访问你的网站

部署完成后，你会得到一个永久免费的域名：

```
https://groupnewyearicon.onrender.com
```

**所有页面：**

| 页面 | 地址 |
|------|------|
| 🗳️ 投票首页 | `https://groupnewyearicon.onrender.com/` |
| 🔐 管理后台 | `https://groupnewyearicon.onrender.com/admin.html` |
| 📊 数据统计 | `https://groupnewyearicon.onrender.com/api/stats` |
| 💓 健康检查 | `https://groupnewyearicon.onrender.com/health` |

**管理员密码**：`csl002A5662qq`（可以在 `backend/.env` 修改）

---

## ⚠️ 免费版限制

| 项目 | 限制 |
|------|------|
| 域名 | ✅ 永久免费 |
| 流量 | 100GB/月 |
| 休眠 | 15 分钟无访问会休眠 |
| 唤醒时间 | 首次访问需等待 10-30 秒 |
| 运行时间 | 每月 750 小时 |

**💡 避免休眠的技巧**：用 UptimeRobot 每 10 分钟 ping 一次你的网站

---

## 🔄 如何更新网站

修改代码后，只需要：

```bash
git add .
git commit -m "Update something"
git push origin main
```

Render 会自动重新部署！

---

## 🆘 遇到问题？

### 部署失败？

检查 Render 的 Logs 页面，常见错误：

1. **Build failed** → 检查 Build Command 是否正确
2. **Port 错误** → 确保代码使用 `process.env.PORT || 3000`
3. **模块缺失** → 检查 package.json 的 dependencies

### 网站打开慢？

这是正常的，免费版会休眠。等待 10-30 秒后就快了。

### 想换域名？

在 Render 面板 → Settings → Custom Domain 可以修改，但免费子域名改不了，只能重建服务。

---

## 🎯 其他免费方案

### 方案 2：Railway

类似 Render，步骤差不多：
1. 访问 https://railway.app
2. 用 GitHub 登录
3. New Project → Deploy from GitHub repo
4. 添加变量 `PORT=3000`

域名格式：`xxx.up.railway.app`

### 方案 3：本地 + 临时隧道（你现在的方案）

如果只是临时用，可以继续用 Cloudflare 临时隧道：

```bash
cd /Users/leochoizero/Desktop/code_folder/website_new_year_icon/backend
node server.js &
cloudflared tunnel --url http://localhost:3000
```

**缺点**：每次重启域名会变

---

## ✅ 推荐方案总结

| 你的需求 | 推荐方案 |
|----------|----------|
| **想要固定免费域名** | 用 **Render**（按上面步骤）|
| **只是临时用几天** | 继续用现在的临时隧道 |
| **想要国内访问快** | 免费方案都做不到，需购买国内服务器 |

---

## 🎉 完成后记得

1. 把 `https://xxx.onrender.com` 发给朋友
2. 登录管理后台设置投票截止时间
3. 把喜欢的头像添加到投票列表

需要我帮你检查代码是否准备好了部署吗？
