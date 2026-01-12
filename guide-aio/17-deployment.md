# 生产部署

## Systemd 服务

```ini
# /lib/systemd/system/pocketbase.service
[Unit]
Description = pocketbase

[Service]
Type             = simple
User             = root
Group            = root
LimitNOFILE      = 4096
Restart          = always
RestartSec       = 5s
WorkingDirectory = /root/pb
ExecStart        = /root/pb/pocketbase serve yourdomain.com

[Install]
WantedBy = multi-user.target
```

```bash
# 启用并启动服务
systemctl enable pocketbase
systemctl start pocketbase

# 查看状态
systemctl status pocketbase

# 查看日志
journalctl -u pocketbase -f
```

## Docker

```dockerfile
FROM alpine:latest
ARG PB_VERSION=0.23.0

RUN apk add --no-cache unzip ca-certificates
ADD https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip /tmp/pb.zip
RUN unzip /tmp/pb.zip -d /pb/

EXPOSE 8080
CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8080"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  pocketbase:
    build: .
    ports:
      - "8090:8080"
    volumes:
      - ./pb_data:/pb/pb_data
      - ./pb_public:/pb/pb_public
    restart: unless-stopped
```

## 生产建议

### 1. 使用 SMTP 邮件服务器

配置真实的 SMTP 服务器用于发送验证邮件、密码重置等。

### 2. 启用超级用户 MFA

在管理面板中为超级用户启用多因素认证。

### 3. 启用速率限制

```go
app.OnServe().BindFunc(func(se *core.ServeEvent) error {
    se.Router.Bind(apis.RateLimit(100, time.Minute))
    return se.Next()
})
```

### 4. 增加文件描述符限制

```bash
ulimit -n 4096
```

或在 systemd 中设置 `LimitNOFILE=4096`。

### 5. 设置 GOMEMLIMIT

内存受限环境下防止 OOM：

```bash
GOMEMLIMIT=400MiB ./pocketbase serve
```

### 6. 启用设置加密

```bash
./pocketbase serve --encryptionEnv=PB_ENCRYPTION_KEY
```

### 7. 反向代理配置

```nginx
# nginx.conf
server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        proxy_pass http://127.0.0.1:8090;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 备份策略

```bash
# 手动备份
./pocketbase backup

# 定时备份 (cron)
0 2 * * * /root/pb/pocketbase backup --name=daily_$(date +\%Y\%m\%d).zip
```
