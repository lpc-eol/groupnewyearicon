# 🚀 快速部署步驟

## 步驟 1: 登錄 Cloudflare

在終端運行：
```bash
cloudflared tunnel login
```

這會打開瀏覽器，請：
1. 選擇一個域名（如 `yourdomain.com`）
2. 點擊授權
3. 回到終端，會看到 "Successfully fetched your user information"

---

## 步驟 2: 創建隧道

```bash
# 創建隧道（名稱可以自訂）
cloudflared tunnel create voting-site

# 會輸出類似：
# Tunnel credentials written to /Users/xxx/.cloudflared/xxxxx-xxxxx-xxxxx.json
# 記住這個 Tunnel ID（xxxxx-xxxxx-xxxxx 那串）
```

---

## 步驟 3: 創建配置文件

```bash
# 編輯配置文件
nano ~/.cloudflared/config.yml
```

貼入以下內容（替換 `<你的Tunnel ID>`）：

```yaml
tunnel: <你的Tunnel ID>
credentials-file: /Users/leochoizero/.cloudflared/<你的Tunnel ID>.json

ingress:
  - hostname: vote.yourdomain.com  # 改為你的子域名
    service: http://localhost:3000
    originRequest:
      connectTimeout: 30s
  - service: http_status:404
```

按 `Ctrl+O` 保存，`Ctrl+X` 退出

---

## 步驟 4: 添加 DNS 記錄

```bash
# 替換 yourdomain.com 為你的域名
cloudflared tunnel route dns voting-site vote.yourdomain.com
```

---

## 步驟 5: 啟動隧道

```bash
# 前台運行（測試用）
cloudflared tunnel run voting-site

# 看到 "Registered tunnel connection" 就成功了！
# 訪問 https://vote.yourdomain.com
```

---

## 步驟 6: 後台運行（可選）

```bash
# 安裝為系統服務
sudo cloudflared service install
sudo cloudflared service start

# 查看狀態
sudo cloudflared service status
```

---

## ✅ 部署驗證

部署完成後，驗證 IP 是否隱藏：

```bash
# 應該返回 Cloudflare 的 IP，不是你的真實 IP
nslookup vote.yourdomain.com
```

預期結果：
```
Address: 104.21.x.x  # 或 172.67.x.x（Cloudflare IP）
```

---

## 🆘 常見問題

**Q: 沒有域名怎麼辦？**
A: 可以在 Cloudflare 註冊免費域名，或使用免費的 `*.workers.dev` 子域名

**Q: 如何停止服務？**
```bash
# 停止隧道
cloudflared tunnel stop voting-site

# 停止後端
kill $(pgrep -f "node server.js")
```

**Q: 如何查看隧道狀態？**
```bash
cloudflared tunnel list
cloudflared tunnel info voting-site
```

---

## 🎯 快速複製命令

如果懶得手動輸入，直接複製運行：

```bash
# 1. 登錄（會打開瀏覽器）
cloudflared tunnel login

# 2. 創建隧道
cloudflared tunnel create voting-site

# 3. 查看 Tunnel ID
cloudflared tunnel list

# 4. 創建配置（手動編輯 ~/.cloudflared/config.yml）
# 5. 添加 DNS
cloudflared tunnel route dns voting-site vote.你的域名.com

# 6. 啟動
cloudflared tunnel run voting-site
```
