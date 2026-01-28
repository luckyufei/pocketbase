# 生产环境部署

### 部署策略

##### 最小设置

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

> 注意在上面的示例中，我们以 **root** 身份登录，这允许我们绑定到**特权 80 和 443 端口**。
>
> 对于**非 root** 用户，通常需要特殊权限才能这样做。根据你的操作系统，有多种选择 - `authbind`、`setcap`、`iptables`、`sysctl` 等。以下是使用 `setcap` 的示例：
>
> ```bash
> [myuser@dev ~]$ sudo setcap 'cap_net_bind_service=+ep' /root/pb/pocketbase
> ```

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

> 你可以在 `/root/pb/std.log` 中找到 Web UI 安装程序的链接，但你也可以通过 `superuser` PocketBase 命令显式创建第一个超级用户：
>
> ```bash
> [root@dev ~]$ /root/pb/pocketbase superuser create EMAIL PASS
> ```

##### 使用反向代理

如果你计划在单个服务器上托管多个应用程序或需要更精细的网络控制，你可以始终将 PocketBase 放在反向代理后面，如 *NGINX*、*Apache*、*Caddy* 等。

*注意，使用反向代理时，你可能需要在 PocketBase 设置中设置"用户 IP 代理头"，以便应用程序可以提取和记录实际的访问者/客户端 IP（头通常是 `X-Real-IP`、`X-Forwarded-For`）。*

以下是最小的 *NGINX* 示例配置：

```nginx
server {
    listen 80;
    server_name example.com;
    client_max_body_size 10M;

    location / {
        # 参见 http://nginx.org/en/docs/http/ngx_http_upstream_module.html#keepalive
        proxy_set_header Connection '';
        proxy_http_version 1.1;
        proxy_read_timeout 360s;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 如果在子路径下提供服务，请启用此选项
        #
        # 注意，尽可能使用子域名，因为 localStorage 和其他资源的同源隔离
        # rewrite /yourSubpath/(.*) /$1 break;

        proxy_pass http://127.0.0.1:8090;
    }
}
```

对应的 *Caddy* 配置：

```
example.com {
    request_body {
        max_size 10MB
    }
    reverse_proxy 127.0.0.1:8090 {
        transport http {
            read_timeout 360s
        }
    }
}
```

##### 使用 Docker

一些主机（如 [fly.io](https://fly.io)）使用 Docker 进行部署。PocketBase 没有官方 Docker 镜像，但你可以使用以下最小 Dockerfile 作为示例：

```dockerfile
FROM alpine:latest

ARG PB_VERSION=0.36.1

RUN apk add --no-cache \
    unzip \
    ca-certificates

# 下载并解压 PocketBase
ADD https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip /tmp/pb.zip
RUN unzip /tmp/pb.zip -d /pb/

# 取消注释以将本地 pb_migrations 目录复制到镜像
# COPY ./pb_migrations /pb/pb_migrations

# 取消注释以将本地 pb_hooks 目录复制到镜像
# COPY ./pb_hooks /pb/pb_hooks

EXPOSE 8080

# 启动 PocketBase
CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8080"]
```

**要持久化数据，你需要在 `/pb/pb_data` 挂载一个卷。**

*完整示例可以查看 ["在 Fly.io 上免费托管" 指南](https://github.com/pocketbase/pocketbase/discussions/537)。*

### 备份和恢复

要备份/恢复你的应用程序，只需手动复制/替换 `pb_data` 目录*（为了事务安全，确保应用程序未在运行）*。

为了使事情稍微简单一些，PocketBase v0.16+ 内置备份和恢复 API，可以从仪表板（*设置* > *备份*）访问：

![备份设置截图](/images/screenshots/backups.png)

备份可以存储在本地（默认）或 S3 兼容存储中（*建议仅为备份使用单独的 bucket*）。生成的备份代表 `pb_data` 目录的完整快照 ZIP 归档（包括本地存储的上传文件，但不包括任何本地备份或上传到 S3 的文件）。

::: warning
**在备份 ZIP 生成期间，应用程序将临时设置为只读模式。**

根据你的 `pb_data` 大小，这可能是一个非常慢的操作，建议在大型 `pb_data`（如 2GB+）的情况下考虑不同的备份策略*（参见结合 `sqlite3 .backup` + `rsync` 的[示例 backup.sh 脚本](https://github.com/pocketbase/pocketbase/discussions/4254#backups)）*。
:::

### 建议

<div class="highlighted-title bg-danger-alt">
<span class="label label-primary">强烈推荐</span>

##### 使用 SMTP 邮件服务器
</div>

默认情况下，PocketBase 使用内部 Unix `sendmail` 命令发送邮件。

虽然这对于开发来说没问题，但对于生产来说不太有用，因为你的邮件很可能会被标记为垃圾邮件或甚至无法送达。

为避免送达问题，考虑使用本地 SMTP 服务器或外部邮件服务，如 [MailerSend](https://www.mailersend.com/)、[Brevo](https://www.brevo.com/)、[SendGrid](https://sendgrid.com/)、[Mailgun](https://www.mailgun.com/)、[AWS SES](https://aws.amazon.com/ses/) 等。

确定邮件服务后，你可以从 *仪表板 > 设置 > 邮件设置* 配置 PocketBase SMTP 设置：

![SMTP 设置截图](/images/screenshots/smtp-settings.png)

<div class="highlighted-title bg-danger-alt">
<span class="label label-primary">强烈推荐</span>

##### 为超级用户启用 MFA
</div>

作为额外的安全层，你可以为 `_superusers` 集合启用 MFA 和 OTP 选项，这将在以超级用户身份认证时强制要求额外的一次性密码（邮件验证码）。

如果遇到邮件送达问题，你也可以使用 `./pocketbase superuser otp yoursuperuser@example.com` 命令手动生成 OTP。

![超级用户 MFA 设置截图](/images/screenshots/superusers_mfa.png)

<div class="highlighted-title bg-danger-alt">
<span class="label label-primary">强烈推荐</span>

##### 启用速率限制器
</div>

为了最大限度地降低 API 滥用的风险（例如过多的认证或记录创建请求），建议设置速率限制器。

PocketBase v0.23.0+ 内置了一个简单的速率限制器，应该能覆盖大多数情况，但如果需要更高级的选项，你也可以通过反向代理使用任何外部速率限制器。

你可以从 *仪表板 > 设置 > 应用* 配置内置速率限制器：

![速率限制设置截图](/images/screenshots/rate-limit-settings.png)

<div class="highlighted-title bg-warning-alt">
<span class="label label-primary">可选</span>

##### 增加打开文件描述符限制
</div>

**以下说明适用于 Linux，但其他操作系统有类似的机制。**

Unix 也将"文件描述符"用于网络连接，大多数系统的默认限制约为 1024。

如果你的应用程序有大量并发实时连接，可能会在某个时候收到如下错误：`Too many open files`。

缓解此问题的一种方法是运行 `ulimit -a` 检查当前帐户资源限制，并找到要更改的参数。例如，如果要增加打开文件限制（*-n*），可以在启动 PocketBase 之前运行 `ulimit -n 4096`。

<div class="highlighted-title bg-warning-alt">
<span class="label label-primary">可选</span>

##### 设置 GOMEMLIMIT
</div>

如果你在内存受限的环境中运行，定义 [`GOMEMLIMIT`](https://pkg.go.dev/runtime#hdr-Environment_Variables) 环境变量可以帮助防止进程的内存不足（OOM）终止。这是一个"软限制"，意味着在某些情况下内存使用可能仍然会超过它，但它会指示 GC 更"激进"，并在需要时更频繁地运行。例如：`GOMEMLIMIT=512MiB`。

如果设置 `GOMEMLIMIT` 后仍然遇到 OOM 错误，可以尝试启用交换分区（如果尚未启用），或开启一个 [Q&A 讨论](https://github.com/pocketbase/pocketbase/discussions)，提供一些重现错误的步骤，以防这是 PocketBase 可以改进的地方。

<div class="highlighted-title bg-warning-alt">
<span class="label label-primary">可选</span>

##### 启用设置加密
</div>

**如果你不确定是否需要，可以忽略以下内容。**

默认情况下，PocketBase 将应用程序设置以纯 JSON 文本形式存储在数据库中，包括 SMTP 密码和 S3 存储凭据。

虽然这本身不是安全问题（PocketBase 应用程序完全在单个服务器上运行，预期只有授权用户才能访问你的服务器和应用程序数据），但在某些情况下，如果有人获取了你的数据库文件（例如从外部存储的备份），加密存储设置可能是个好主意。

要加密存储 PocketBase 设置：

1. 创建一个新的环境变量，并**设置一个随机 32 字符**的字符串作为其值。
   
   <span class="txt-hint">例如，在你的 shell 配置文件中添加 `export PB_ENCRYPTION_KEY="YshgYqCbKLH5epCUjf2HpJx9Ik3BwwTI"`</span>

2. 使用 `--encryptionEnv=YOUR_ENV_VAR` 标志启动应用程序。
   
   <span class="txt-hint">例如：`pocketbase serve --encryptionEnv=PB_ENCRYPTION_KEY`</span>
