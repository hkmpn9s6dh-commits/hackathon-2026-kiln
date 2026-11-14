# 06 · 你要做的三步（照抄）

> 这三步要 Reddit 登录态，只能由账号持有人做。每一步写清「看到什么算成功」。
> 预计 20 分钟。做完把链接发我，我封包并回流。

## 0. 准备（一次性）

```bash
cd "C:/Users/张一/WorkBuddy/spaces/2026_11_12_22-57-34/kiln"
export PATH="/c/Users/张一/tools/node24:$PATH"   # Devvit Web 要 Node >= 24
npm ci
```

**本机能直连 Reddit 吗？** 不能（`reddit.com` 直连 000）。开代理后再跑：

```bash
export https_proxy=http://127.0.0.1:7897 http_proxy=http://127.0.0.1:7897
```

## 1. 登录 + 跑一次（约 5 分钟）

```bash
npx devvit login
```

浏览器弹出 Reddit 授权页 → 点 **Authorize**。终端出现 `Your Devvit authentication token has been saved`.

```bash
npm run dev          # = devvit playtest
```

✅ 成功的标志：终端最后出现
```
┌ ✓ Playtest ready
│ ➜ URL: https://www.reddit.com/r/<你的测试sub>/?playtest=kiln-day
```
浏览器打开这个 URL，能看到卡片和窑。

## 2. 上传，拿 App 链接（约 3 分钟）

```bash
npx devvit upload
```

✅ 成功：终端打印 `Version 0.0.0.x uploaded` 和
`https://developers.reddit.com/apps/kiln-day`
**这个 URL 就是提交表的 App listing 栏。**

> 官方明说**不要 publish**。upload + playtest 就够，private 也算数。

## 3. 建公开测试 sub + 发一帖（约 10 分钟）

1. reddit.com → Create Community → 名字随意，**Public**，人数 < 200。
2. 进这个 sub → Mod Tools → Apps → 搜 `kiln-day` → Install。
   装完 `onAppInstall` 会自动发一帖。
3. 打开那帖，点 **Load your piece**，玩一次。
4. 复制两个链接：
   - sub：`https://www.reddit.com/r/<你的测试sub>/`
   - 帖：`https://www.reddit.com/r/<你的测试sub>/comments/<postid>/`

✅ 成功的标志：帖子里能玩完整一局（选器 → 选窑位 → 三次投柴 → 开窑 → 窑厂）。

## 把这四样发我

1. App listing 链接
2. demo sub 链接
3. demo 帖链接
4. 一张玩到「出窑」的手机截图（如果有问题，截图比描述快）

我收到后：填 Devpost 的栏（`docs/05-SUBMISSION.md` 已逐栏写好）、把影片和封面挂上、回流三样、主单置 in_review。

## 如果卡住

| 现象 | 原因 | 怎么办 |
| --- | --- | --- |
| `devvit login` 打不开浏览器 | 需要代理 | 先 `export https_proxy=...` 再跑 |
| `Playtest ready` 之后打开是 404 | app 还没装到那个 sub | 回 Mod Tools → Apps 手动装一次 |
| 帖子里白屏 | webview 里报错 | 把浏览器控制台的红字截图给我 |
| 上传报 `workflow scope` | token 权限 | 不用管，仓库已去掉 GitHub Actions |
