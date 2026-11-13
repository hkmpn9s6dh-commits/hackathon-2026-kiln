# 00 · SPEC — KILN

闸 A 的交付物。写于 2026-11-14，开第一行游戏代码之前。
范围锁：过了这一页，只删不加。

比赛：**Reddit's Game of the Day Hackathon**（Devvit Web）
截止：2026-12-08 18:00 PT ＝ **北京 2026-12-09 10:00**
交付：`developers.reddit.com/apps/kiln-day` 的 App 链接 + 一个公开 demo 贴文（测试 subreddit 里跑着游戏的帖子）+ README

## 1. 官方评分表（原文，四項等權 25%）

> **Delightful UX** — Experiences should be built with exciting layouts and themes. While apps do not need to be perfect, it should be easy and fun to uncover what the app has to offer.
>
> **Polish** — Your submission should be as close to publishable as possible and compliant with Devvit Rules. Judges should be able to understand everything we need to know by interacting with example posts. The closer to launch quality, the higher the score here.
>
> **Reddit-y** — Reddit is all about community and embracing topics people care about, no matter how weird. We want apps to have their own identity, be community-minded, and bring something fresh to the platform. The best apps will bring a community together.
>
> **Daily Content** — Does your app create recurring content, challenges, and intrigue? While content does not have to strictly be *daily*, it should make smart use of fresh content.

官方另外点名的加分项：直觉 onboarding、视觉工艺、校准过的每日内容、聚焦玩法、清楚的结束状态与回流回路、**Devvit Journeys 埋点**。
官方点名的扣分项：一眼 AI slop、硬套 Reddit 梗（Snoo／karma）、烂大街题材（太空射击、换皮、简单平台跳跃、协作讲故事、trivia）、没真的跑在 Reddit 上。

## 2. 演示脚本（先写这一节，再写代码）

评委只看一次，60 秒。这条路径必须**每一屏都成立**：

| 秒 | 画面 | 观众应该看懂什么 |
| --- | --- | --- |
| 0–6 | 信息流里的卡片：砖窑剪影、`KILN`、一行字「One wood kiln. One piece each. The whole subreddit fires it together.」、`4 pieces loaded · closes in 15h` | 这是每天一次、大家一起玩的东西 |
| 6–14 | 点进游戏：三间窑室横在眼前，砖、火、烟全是画出来的；左上角一行小字「Tap a shelf to place your piece」 | 不用读说明书就知道要点屏幕 |
| 14–26 | 点一件器（青瓷碗／青花罐／影青瓶），窑位格子亮起，底部一行「This shelf can land it, if you stoke well.」 | 选择有后果，而且现在就能看见 |
| 26–40 | 投柴：一根针在槽里来回，橙带是窗口；按空格三次，每按一次下方多一格记号 | 唯一需要手上的功夫，三下就结束 |
| 40–52 | 开窑：窑门亮起、窑内热浪推上来；出窑一枚印章——`Fine piece` / `Sound piece` / `Underfired`，旁边三个数字：`Saw 1318°C` `Wanted 1300°C` `Off by +18°C` | 输赢是算得出来的，不是随机的 |
| 52–60 | 窑厂：今天所有人的器按序排在架子上，三种颜色分档；如果全窑均匀，横幅写「窑火顺 — everyone who fired today gains 80 points」 | 你和别人共用一座窑；明天还有一座 |

## 3. 黄金路径（实现顺序）

1. 纯函数内核：日种子 → 窑（9 窑位／3 件器／天气变体）→ 投柴 → 判定 → 计分。先写测试。
2. 本地 harness：一个不依赖 Reddit 的 dev server，把同一份内核跑起来，浏览器里能玩。
3. 画布：一间砖窑横截面，三室九架，器是剪影 + 釉色，火与烟是粒子。
4. 服务端：Redis 存当天那一窑（一人一件、按室计数、当日榜），Hono 三个接口。
5. Devvit 外壳：`devvit.json` 两个入口（信息流卡片 / 展开游戏）、菜单建贴、每日 00:05 自动点新窑。
6. 埋点：Devvit Journeys 五个事件。

## 4. 可判定的验收条件

每条都有一条能跑的命令或一次能看到的画面。`bash scripts/verify.sh` 一次跑完 1–9。

| # | 条件 | 怎么判 |
| --- | --- | --- |
| AC-1 | 类型零错误 | `npx tsc --build` 退出 0 |
| AC-2 | 规则有测试，且测试能抓住回归 | `npx vitest run` 全绿；删掉 `CROWD_PENALTY` 一行应立刻变红（人工抽查一次） |
| AC-3 | **每一天都可解**：365 天 × 每件器 × 空窑／同室已有 3 件，都存在一个窑位与投柴落在精品带 | 单测 `solvability` 遍历 365 天，失败会打印具体日期与偏差 |
| AC-4 | 提示不撒谎：界面说「能精品」当且仅当真的能 | 单测 `never promises a fine piece it cannot deliver`（120 天 × 全部组合） |
| AC-5 | 一人一天一件：重复提交返回同一件，不重复计数 | 单测 + e2e 各一次 |
| AC-6 | 服务端不信客户端：温度、判定、计分全部服务端重算 | `submitPiece` 只接受 `wareId/slotId/taps`，`taps` 逐项 clamp 到 [0,1] |
| AC-7 | 浏览器里能从卡片玩到结果再到窑厂，零控制台报错 | `node scripts/e2e.mjs` 11 项全过 |
| AC-8 | 构建产物符合 Devvit 要求：两个入口 HTML、服务端 CJS、资源相对可达 | `node scripts/preflight.mjs` |
| AC-9 | 不用 `eval`、不联网、不加载外部字体或图片 | preflight 扫 `dist/client`：无 `http(s)://` 外链资源、无 `eval(` |
| AC-10 | 声音可关、默认不打扰；`prefers-reduced-motion` 下不动 | 手点一次静音按钮；系统开减少动态后截图比对 |
| AC-11 | 手机宽度 390px 下不横向溢出、主按钮可点 | `node scripts/shot.mjs` 出 390×844 截图并断言 `scrollWidth <= clientWidth` |
| AC-12 | 每日内容真的每天不同：连续 7 天窑位与器不同 | 单测 `changes from one day to the next` 已有；`scripts/shot.mjs --week` 出七张图 |

## 5. 不做什么（范围锁）

- 不做账号系统、不做商店、不做多人实时对战。
- 不做 UGC（Reddit 已经有很多 UGC 游戏，这一场要的是「一天一次」的仪式感）。
- 不碰 IP 争议：图形全部程序化绘制，不用任何第三方素材、不用 Snoo、不用 Reddit 商标做视觉主体。
- 不为了「看起来像 Reddit」贴 karma／upvote 的梗——官方明确说这不是 Reddit-y。

## 6. 风险与已知边界

| 风险 | 处理 |
| --- | --- |
| 本机 `reddit.com` 直连不通（需代理 127.0.0.1:7897） | 开发与文档走代理；平台三步（login／upload／demo 贴）留给用户 |
| 没有 Reddit 登录态 → upload／playtest／demo 贴无法在本机验证 | 只用官方文档列出的 API；本地 harness 用同一份 store 与内核；preflight 静态核对配置 |
| Devvit Web 要 Node ≥ 24 | 本机装 24.11.0 到 `C:\Users\张一\tools\node24`，`verify.sh` 里写死检查 |
| 中国大区资格 | 规则排除名单未点名中国大陆，与已参赛的 Kiroween／QNX 同口径 |
| 「AI slop」观感 | 全部手绘程序化图形；不用渐变糊、不用通用组件库；文案按陶工口吻写 |
