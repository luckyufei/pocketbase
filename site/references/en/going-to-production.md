# Going to Production

## Deployment strategies

### Minimal setup

One of the best PocketBase features is that it's completely portable. This means that it doesn't require any external dependency and **could be deployed by just uploading the executable on your server**.

Here is an example of starting a production HTTPS server (auto managed TLS with Let's Encrypt) on a clean Ubuntu 22.04 installation.

0. Consider the following app directory structure:

```
myapp/
    pb_migrations/
    pb_hooks/
    pocketbase
```

1. Upload the binary and anything else required by your application to your remote server, for example using **rsync**:

```bash
rsync -avz -e ssh /local/path/to/myapp root@YOUR_SERVER_IP:/root/pb
```

2. Start a SSH session with your server:

```bash
ssh root@YOUR_SERVER_IP
```

3. Start the executable (specifying a domain name will issue a Let's encrypt certificate for it):

```bash
[root@dev ~]$ /root/pb/pocketbase serve yourdomain.com
```

::: tip
Notice that in the above example we are logged in as **root** which allows us to bind to the **privileged 80 and 443 ports**.

For **non-root** users usually you'll need special privileges to be able to do that. You have several options depending on your OS - `authbind`, `setcap`, `iptables`, `sysctl`, etc. Here is an example using `setcap`:

```bash
[myuser@dev ~]$ sudo setcap 'cap_net_bind_service=+ep' /root/pb/pocketbase
```
:::

4. (Optional) Systemd service

You can skip step 3 and create a **Systemd service** to allow your application to start/restart on its own.

Here is an example service file (usually created in `/lib/systemd/system/pocketbase.service`):

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

After that we just have to enable it and start the service using `systemctl`:

```bash
[root@dev ~]$ systemctl enable pocketbase.service
[root@dev ~]$ systemctl start pocketbase
```

::: tip
You can find a link to the Web UI installer in the `/root/pb/std.log`, but alternatively you can also create the first superuser explicitly via the `superuser` PocketBase command:

```bash
[root@dev ~]$ /root/pb/pocketbase superuser create EMAIL PASS
```
:::

### Using reverse proxy

If you plan on hosting multiple applications on a single server or need finer network controls, you can always put PocketBase behind a reverse proxy such as *NGINX*, *Apache*, *Caddy*, etc.

::: tip
Just note that when using a reverse proxy you may need to set up the "User IP proxy headers" in the PocketBase settings so that the application can extract and log the actual visitor/client IP (the headers are usually `X-Real-IP`, `X-Forwarded-For`).
:::

Here is a minimal NGINX example configuration:

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

## Backups

PocketBase has built-in backup support. You can configure automatic backups from the Dashboard or trigger them manually via the API.

::: warning
It's highly recommended to store backups on external storage (S3, etc.) rather than on the same server as your PocketBase instance.
:::

## Performance tips

1. **Use indexes** - Add database indexes for fields that are frequently used in filters and sorts.

2. **Limit expand depth** - Deep relation expansions can be expensive. Consider flattening your data model if you need many levels of expansion.

3. **Use pagination** - Always paginate large result sets using `page` and `perPage` parameters.

4. **Cache static assets** - If serving static files through PocketBase, consider using a CDN or reverse proxy caching.

5. **Monitor logs** - Regularly check the logs for slow queries and errors.
