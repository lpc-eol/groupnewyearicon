# 投票系统 + Nanobot QQ 群集成指南

## 功能

- ✅ 实时推送投票通知到 QQ 群
- ✅ Admin 面板显示实时投票记录
- ✅ 用户投票后才显示排行榜和票数

## 架构

```
用户投票
   ↓
投票后端 (Node.js)
   ├── 保存数据到 data.json
   ├── 发送 Socket.IO 事件给 Admin 面板
   └── 发送 HTTP Webhook 给 Nanobot
       ↓
   Nanobot Voting Skill (Python)
       ↓
   QQ 频道 → QQ 群通知
```

## 配置步骤

### 1. 配置投票后端 Webhook

在 `backend/.env` 文件中添加：

```bash
# Nanobot Webhook 配置
NANOBOT_ENABLED=true
NANOBOT_WEBHOOK_URL=http://localhost:8765/webhook
```

### 2. 启动 Nanobot Webhook 接收器

运行简单的 webhook 接收器（将 HTTP 请求转发给 Nanobot）：

```bash
# 在 nanobot_research 目录下
python3 nanobot/skills/voting_notifier/webhook_server.py
```

或者使用 ngrok 暴露到公网：

```bash
ngrok http 8765
```

### 3. 配置 Nanobot

在 `nanobot.toml` 中添加：

```toml
[qq]
enabled = true
app_id = "your_app_id"
secret = "your_secret"

[voting_notifier]
enabled = true
data_file = "/path/to/voting/backend/data.json"
qq_group_id = "your_qq_group_openid"
poll_interval = 5
```

### 4. 获取 QQ 群 OpenID

1. 在 QQ 开放平台创建机器人
2. 将机器人添加到群聊
3. 群成员发一条消息，查看日志获取 openid

### 5. 启动服务

```bash
# 1. 启动投票后端
cd backend
npm start

# 2. 启动 Nanobot webhook 接收器
python3 nanobot_research/nanobot/skills/voting_notifier/webhook_server.py

# 3. 启动 Nanobot
cd nanobot_research
python3 -m nanobot
```

## QQ 群消息格式

```
🗳️ 新投票
用户 v_abc123... 投给了「新年烟花」
当前票数: 12 票 | 排名: 第 2 名
```

## Admin 面板

访问 `http://localhost:3000/admin.html`

- 实时查看投票记录
- 包含：时间、用户、投票图片、票数、排名
- 最多显示最近 1000 条记录

## 前端行为

- **未投票用户**：图片随机排序，票数显示 "🔒 投票后可见"
- **已投票用户**：按票数排序，显示完整票数和进度条
