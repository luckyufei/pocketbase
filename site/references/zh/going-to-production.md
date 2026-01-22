# 生产环境部署

## 部署策略

### 最小设置

PocketBase 最好的特性之一是它完全可移植。这意味着它不需要任何外部依赖，**只需将可执行文件上传到服务器即可部署**。

以下是在干净的 Ubuntu 22.04 安装上启动生产 HTTPS 服务器（使用 Let's Encrypt 自动管理 TLS）的示例。

0. 考虑以下应用目录结构：

```
myapp/
    pb_migrations/
    pb_hooks/
    pocketbase
```

1. 将二进制文件和应用程序所需的其他任何内容上传到远程服务器，例如使用 **rsync**：

```bash
rsync -avz -e ssh /local/path/to/myapp root@YOUR_SERVER_IP:/root/pb
```

2. 与服务器建立 SSH 会话：

```bash
ssh root@YOUR_SERVER_IP
```

3. 启动可执行文件（指定域名将为其颁发 Let's encrypt 证书）：

```bash
[root@dev ~]$ /root/pb/pocketbase serve yourdomain.com
```

::: tip
注意在上面的示例中，我们以 **root** 身份登录，这允许我们绑定到**特权 80 和 443 端口**。

对于**非 root** 用户，通常需要特殊权限才能这样做。根据你的操作系统，有多种选择 - `authbind`、`setcap`、`iptables`、`sysctl` 等。以下是使用 `setcap` 的示例：

```bash
[myuser@dev ~]$ sudo setcap 'cap_net_bind_service=+ep' /root/pb/pocketbase
```
:::

4. (可选) Systemd 服务

你可以跳过步骤 3 并创建一个 **Systemd 服务**，允许你的应用程序自动启动/重启。

以下是一个示例服务文件（通常在 `/lib/systemd/system/pocketbase.service` 创建）：

```ini
[Unit]
Description = pocketbase

[Service]
Type             = simple
User             = root
Group            = root
LimitNOFILE      = 4096
Restart          = always
RestartSec       = 5s
StandardOutput   = append:/root/pb/std.log
StandardError    = append:/root/pb/std.log
WorkingDirectory = /root/pb
ExecStart        = /root/pb/pocketbase serve yourdomain.com

[Install]
WantedBy = multi-user.target
```

之后我们只需要使用 `systemctl` 启用并启动服务：

```bash
[root@dev ~]$ systemctl enable pocketbase.service
[root@dev ~]$ systemctl start pocketbase
```

::: tip
你可以在 `/root/pb/std.log` 中找到 Web UI 安装程序的链接，但你也可以通过 `superuser` PocketBase 命令显式创建第一个超级用户：

```bash
[root@dev ~]$ /root/pb/pocketbase superuser create EMAIL PASS
```
:::

### 使用反向代理

如果你计划在单个服务器上托管多个应用程序或需要更精细的网络控制，你可以始终将 PocketBase 放在反向代理后面，如 *NGINX*、*Apache*、*Caddy* 等。

::: tip
请注意，使用反向代理时，你可能需要在 PocketBase 设置中设置"用户 IP 代理头"，以便应用程序可以提取和记录实际的访问者/客户端 IP（头通常是 `X-Real-IP`、`X-Forwarded-For`）。
:::

以下是最小的 NGINX 示例配置：

```nginx
server {
    listen 80;
    server_name example.com;
    
    location / {
        proxy_pass http://127.0.0.1:8090;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 备份

PocketBase 内置备份支持。你可以从仪表板配置自动备份或通过 API 手动触发。

::: warning
强烈建议将备份存储在外部存储（S3 等）上，而不是与 PocketBase 实例相同的服务器上。
:::

## 性能提示

1. **使用索引** - 为过滤器和排序中经常使用的字段添加数据库索引。

2. **限制展开深度** - 深度关联展开可能很昂贵。如果你需要多层展开，考虑扁平化你的数据模型。

3. **使用分页** - 始终使用 `page` 和 `perPage` 参数对大型结果集进行分页。

4. **缓存静态资源** - 如果通过 PocketBase 提供静态文件，考虑使用 CDN 或反向代理缓存。

5. **监控日志** - 定期检查日志以查找慢查询和错误。
