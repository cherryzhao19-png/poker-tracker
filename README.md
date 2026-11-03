# Poker Tracker / 个人账本：GitHub → Vercel → Supabase

这是新的可移植版本，保留黑金界面和英文名言。不要使用此前的 Sites 云端工程压缩包执行以下步骤。

GitHub 保存代码，Vercel 提供网站网址，Supabase 提供邮箱登录和云端数据库。GitHub 私有仓库不等于私人网站；网站可显示登录页，但记录由数据库的账户隔离策略保护。

## 1. 创建 Supabase 云端项目

1. 打开 https://supabase.com/dashboard ，注册或登录，创建一个新项目（New project）。
2. 项目名可填 `poker-tracker`，设置并保管数据库密码，等待项目就绪。数据库密码不用填写到网页文件里。
3. 进入 SQL Editor → New query，用记事本打开本包 `database.sql`，复制全部内容到编辑器，点击 Run。应显示执行成功；报错时先停止，不要跳过。
4. 在项目的 Connect 面板或 Settings → API Keys 找到 Project URL 与 Publishable key（`sb_publishable_` 开头）。界面名称可能随版本调整。
5. 用记事本打开本包 `config.js`，只替换两个 `PASTE_…` 占位值，保留引号与逗号。例如：

```js
window.POKER_CONFIG = {
  supabaseUrl: 'https://你的项目编号.supabase.co',
  supabasePublishableKey: 'sb_publishable_你的公开密钥'
};
```

这里只能使用公开 publishable key；不要填写 secret、service_role、数据库密码或 GitHub token。公开密钥可放在浏览器中，数据保护依赖 SQL 中已经开启的 RLS，不依赖隐藏该密钥。

若项目设置中关闭了 Data API，先开启 Data API 并确保 `public` schema 可访问。此代码使用 RPC 函数读取/写入记录。

## 2. 把解压后的文件上传到 GitHub

1. 登录 https://github.com ，点击右上角 + → New repository。
2. 仓库名填 `poker-tracker`，选择 Private，勾选 Add a README，点击 Create repository。
3. 点击 Add file → Upload files。
4. 上传本目录内的 `index.html`、`app.js`、`config.js`、`vercel.json`、`database.sql`、`README.md` 六个文件。不要直接上传 ZIP，也不要把整个父文件夹套进去。
5. 点击 Commit changes。仓库首页应能直接看到 `index.html`。

本包额外的 `auth-adapter.js` 是可读的开发辅助源码，实际页面只运行 `app.js`，可以不上传。

GitHub 网页登录如果要求双重验证，仍需完成账户验证。这条流程省去的是把 GitHub 连接到当前聊天，不会绕过 GitHub 的安全要求。

## 3. 用 Vercel 发布网站

1. 打开 https://vercel.com ，登录或注册。
2. 选择 Add New → Project → Import Git Repository，连接 GitHub，授权访问刚创建的仓库。
3. 导入 `poker-tracker`，Framework Preset 选 Other。
4. Root Directory 保持仓库根目录，Build Command 留空（如有 Override，开启后留空），Output Directory 填 `.`。本包无需安装或构建。
5. 点击 Deploy。部署成功后复制正式生产网址，例如 `https://你的项目.vercel.app`。

后续修改 GitHub 文件并提交，Vercel 的 Git 集成会触发新部署。不要将输赢备份文件上传 GitHub。

## 4. 设置邮件链接返回你的网站

回到 Supabase → Authentication → URL Configuration：

- Site URL：填上一步的正式 HTTPS 网站地址。
- Redirect URLs：添加同一地址的根路径，例如 `https://你的项目.vercel.app/`。
- 保存设置，使用正式生产网址访问网站，避免以临时预览网址注册。

Authentication 的 Email 登录方式需要开启。保留邮箱确认功能。
Supabase 默认邮件服务仅向项目组织成员邮箱发信；个人试用先用你注册 Supabase 的邮箱注册账本账户。要给其他邮箱提供注册/找回密码，需要配置自己的 SMTP，默认邮件服务也有发送限额。
账本的邮箱登录账户和管理 Supabase 项目的账户是不同系统，需要在账本网页上注册一次。

## 5. 验收与迁移旧数据

1. 打开正式网址，输入邮箱、至少 8 位密码，点击注册，收到邮件后点击确认，然后返回登录。
2. 新增一条小额测试记录，等到页面显示“已保存到云端”。
3. 关闭网页重新打开；再用手机打开同一网址、登录同一邮箱，确认记录存在。
4. 测试编辑和删除、金额统计、导出备份。记录变更后在另一台设备点击“刷新云端记录”。
5. 有条件时使用第二个账户确认看不到第一个账户的记录（向其他邮箱发信前需配置 SMTP）。
6. 在旧本地网页点击“导出完整备份”，再在新网站点击“导入旧版 / 云端备份”。先导出留底，不要删除旧文件。

每次最多导入 1000 条。相同编号跳过，不覆盖云端较新修改，也不恢复已删除记录。误删需要人工恢复时请保留原备份并另行处理。

## 常见问题

- 页面提示未配置：检查 `config.js` 的两个占位值是否替换，文件是否提交并完成新部署。
- 提示找不到 `poker_tracker_snapshot`：检查是否在同一个 Supabase 项目运行了整个 `database.sql`，并且 Data API 已开启。
- 注册提示邮箱不允许或收不到邮件：先用 Supabase 项目成员邮箱试用；检查 SMTP、垃圾邮件和发送频率。
- 邮件打开错误网址：检查 Site URL 和 Redirect URLs 是否为正式网址。
- 网站打不开或登录脚本无法加载：该版本需要浏览器能访问 Vercel、Supabase 和 jsDelivr，先确认你的手机与电脑网络都能访问。
- GitHub 要验证码：这仍属于你的 GitHub 账户验证，需要恢复验证器或使用恢复方式；聊天插件不是必需的。

## 可靠性与验证边界

本版保存记录到 Supabase 数据库，浏览器只保存登录会话。换设备后同一账户可读取记录，仍需实际完成上面的验收。
云端不保证绝对零丢失；请定期导出 JSON 到独立云盘。本项目没有实现自动异地备份或一键恢复，不要将登录成功误认为备份已经完成。
托管服务的额度、暂停规则、备份能力及费用以你的控制台套餐为准。

本次已检查浏览器脚本语法、云端请求适配和账户切换防护；没有在你的 Supabase 项目执行 SQL，也未完成真实登录/部署测试。`config.js` 仍是占位配置，需要你填写。

## 官方操作说明

- GitHub 文件上传：https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository
- Vercel Git 导入：https://vercel.com/docs/git
- Vercel 静态站点配置：https://vercel.com/docs/builds/configure-a-build
- Supabase 公开密钥：https://supabase.com/docs/guides/getting-started/api-keys
- Supabase 数据隔离：https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase 登录返回网址：https://supabase.com/docs/guides/auth/redirect-urls
- Supabase 邮件限制：https://supabase.com/docs/guides/auth/auth-smtp
