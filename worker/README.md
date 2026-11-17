# 献辞审核服务（Cloudflare Worker）

访客在“点亮一颗星”里写的献辞，先进入待审核队列；只有在审核后台点“通过”的，才会以星星的形式出现在 masteryau.com 的星空里（鼠标悬停或点按星星可读，星空中也会轮流飘出）。

- 公开接口：`https://api.masteryau.com/api/dedications`（GET 已通过列表，POST 提交）
- 审核后台：`https://api.masteryau.com/admin`（输入审核密码）
- 网站会自动检测这个接口：接口可用时开启审核流程；接口不可用时，星空保持原样（献辞只在访客自己的屏幕上飘过，不会保存）。

## 自动初筛

所有献辞都要人工审核。系统会额外给可疑内容打上红色标记，方便你优先处理：

- 含链接
- 含代码或标签
- 疑似广告或联系方式（长数字、微信、QQ 等）
- 疑似辱骂

同一访客一分钟内最多提交 3 条。只保存 IP 的哈希值，一分钟后自动过期，不保存访客的 IP 地址本身。

## 首次部署（约 10 分钟）

前提：masteryau.com 的 DNS 托管在你的 Cloudflare 账号下（Cloudflare 后台 → Add a site）。

```bash
cd worker
npm install
npx wrangler login                              # 浏览器里登录你的 Cloudflare 账号
npx wrangler kv namespace create DEDICATIONS    # 把输出里的 id 填进 wrangler.toml 的 REPLACE_WITH_KV_NAMESPACE_ID
npx wrangler secret put ADMIN_TOKEN             # 设置审核密码（建议 16 位以上随机字符）
npx wrangler deploy                             # 部署，并自动绑定 api.masteryau.com
```

部署后打开 `https://api.masteryau.com/admin`，输入密码即可审核。网站不用改代码，刷新后会自动启用审核流程。

## 日常使用

- **通过**：可以先在文本框里改错字再点“通过”。
- **删除**：直接丢弃，不会公开。
- **撤下**：已展示的献辞可以随时撤下。
- 公开列表有 60 秒缓存，通过或撤下后最多一分钟内生效。

## 修改密码

```bash
npx wrangler secret put ADMIN_TOKEN
```
