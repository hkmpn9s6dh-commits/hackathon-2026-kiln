# 05 · 提交（照抄单）

Devpost 的栏位、App listing、demo 贴文，逐栏给现成英文。按顺序做，30 分钟内能交完。

---

## 0. 用户要做的事（三步，缺一不可）

> 这三步要 Reddit 登录态，只能由账号持有人做。每一步都写清"看到什么算成功"。

### 第一步：登录并跑一次

```bash
cd kiln
npm ci
npx devvit login        # 浏览器会弹出来，点 Authorize
npm run dev             # = devvit playtest，会在你的测试 subreddit 里装一个私有版本
```

成功的样子：终端最后出现 `✓ Playtest ready` 和一个 `https://www.reddit.com/r/<你的测试sub>/...` 链接；浏览器打开那个链接能看到卡片和游戏。

### 第二步：上传，拿 App 链接

```bash
npx devvit upload
```

成功的样子：终端打印 `Version 0.0.0.x uploaded`，并给出
`https://developers.reddit.com/apps/kiln-day` —— **这就是提交表里的 App listing 链接**。

（官方明说：**不要 publish**。upload + playtest 就够，private 也算数。）

### 第三步：建公开测试 subreddit 并发一帖

1. 建一个公开 subreddit（人数 < 200，规则要求）。
2. 装 app：在该 sub 的 mod tools → Apps → 安装 `kiln-day`；装完会自动发一帖（`onAppInstall` 触发器）。
3. 打开那帖，确认能玩。
4. 复制 sub 链接 + 帖子链接 —— **这两个是提交表里的 demo 链接**。

---

## 1. Devpost 表单

| 栏位 | 填什么 |
| --- | --- |
| **Project name** | `KILN` |
| **Elevator pitch** | `One wood kiln a day. Everyone in the subreddit fires it together — and there is only one shelf each.` |
| **Thumbnail** | `submission/cover-1500x1000.png`（1500×1000，画廊封面） |
| **Video demo link** | `submission/kiln-demo.webm`（29 秒，1280×720）——先传 YouTube（YouTube 收 WebM），再把链接贴这里 |
| **App listing URL** | `https://developers.reddit.com/apps/kiln-day` |
| **Demo subreddit** | `https://www.reddit.com/r/<你的测试sub>/` |
| **Demo post** | `https://www.reddit.com/r/<你的测试sub>/comments/<postid>/` |
| **Repo**（可选） | `https://github.com/hkmpn9s6dh-commits/hackathon-2026-kiln` |
| **Built with** | `devvit` `typescript` `react` `vite` `hono` `redis` `canvas` `webaudio` |
| **Subcategory** | If asked: **not a port** — the firing mechanic is adapted from our own earlier game 《把桩》 (MIT), but KILN is a new 60-second daily built for Reddit. 若要投 **Best Ported Daily Game**，就在这里写清"ported from our own 《把桩》"。**建议先按主奖（Best Daily Game）报，port 只在确实想双投时勾。** |

## 2. About the project（整段英文，直接贴）

### Inspiration

Every wood kiln is fired once, together, and nobody can see inside it. In Jingdezhen the person in charge — the *ba zhuang* — has no thermometer: they hook a shard out of the fire hole and read the glaze. We wanted to turn that one act into something a subreddit could do in sixty seconds a day.

### What it does

KILN is one kiln, one day, one piece each.

The kiln has nine shelves in three chambers: the fire mouth (hot), the body, and the tail (cold). Every day brings a different load: three wares, a weather note (a wet night runs 14° cold), and a fresh set of temperatures. You pick a ware, tap a shelf, and stoke three times — stop the needle inside the band and you add heat, miss it and you lose heat.

Then the door opens and the piece is graded against the temperature its glaze wanted: kiln transmutation, fine, sound, underfired, overfired.

The part that makes it a Reddit game: **every piece already in a chamber pulls that chamber down by 7°C.** If everybody crowds the fire mouth, everybody overfires. If the finished load is spread evenly, the whole kiln gets 窑火顺 — a shared bonus for everyone who fired that day. The only way to win it is to talk to each other in the comments.

One piece per potter per day. The kiln rolls at 00:00 UTC; a new one is posted at 00:05.

### How we built it

- **Devvit Web** with React 19 + Vite on the client and Hono on Devvit's Node runtime.
- **Redis** holds the day's kiln: one hash for pieces (`hSetNX` = one piece per person per day), one hash of per-chamber counts, one sorted set for the day's board, one JSON per user for streaks.
- **Canvas 2D**, everything drawn in code: brick, fire, smoke, embers, and nine glazes. No images, no sprites, no third-party art.
- **WebAudio**, everything synthesised: the clay tap, the fire, the door, the bell when a piece comes out fine.
- **The kernel is pure functions** (`src/shared/kiln.ts`, zero imports). The client, the server and the tests call the same code — so a piece fired in a test is the piece the server accepts.
- **A 365-day solvability test**: every day, every ware, must be reachable in the fine band even with three pieces already in the chamber. It caught four designs that looked fine and were not.
- **Daily post**: a scheduler task at 00:05 UTC submits a fresh custom post, so the game exists even if nobody scrolls past yesterday's.
- **Devvit Journeys** events on ready / start / stoke / open / result.

### Challenges

The hard part was not the fire, it was the fairness. A shared kiln means your result depends on when you arrive. We fixed it with three rules: the crowd penalty is visible before you commit; the hint can never say "fine" unless a real stoke can land it; and the collective bonus is paid at the end of the day, so arriving late costs you heat but never the shared reward.

Second: keeping the whole thing small. The feed card is one SVG and a fetch; the game is ~23KB of JS plus fonts. It has to open instantly inside a Reddit post.

### Accomplishments

- 34 unit tests, 11 browser checks, one command (`bash scripts/verify.sh`), green from a fresh clone.
- A kiln that is genuinely different every day, and provably solvable every day.
- No image or audio assets at all: 1.7MB of fonts and code, nothing else.

### What we learned

Daily games live or die on the first three seconds, and on whether tomorrow is different for a reason you can feel. A shared object — one kiln — gives people a reason to come back that a leaderboard never does: they want to see what the others did to their fire.

### What's next

More wares, a second chamber layout on weekends, and a "kiln opening" comment thread that the app posts itself when the day rolls over.

---

## 3. 演示影片脚本（≤60 秒，英文旁白）

| 秒 | 画面 | 旁白 |
| --- | --- | --- |
| 0–5 | 卡片 | “One wood kiln. One piece each. The whole subreddit fires it together.” |
| 5–12 | 进入游戏，窑的三室 | “Nine shelves, three chambers. The mouth is hot, the tail is cold.” |
| 12–22 | 选器、点窑位，提示变化 | “Pick a ware, pick a shelf. Every piece already in that chamber pulls the heat down.” |
| 22–34 | 投柴三次 | “Three strokes. Stop the needle in the band — that is the only part that is pure skill.” |
| 34–45 | 开窑、判定与三个数字 | “It saw 1318. It wanted 1300. Fine piece.” |
| 45–55 | 窑厂、窑火顺 | “If the load is spread, everyone gets the shared bonus. That is why people talk in the comments.” |
| 55–60 | 卡片 + 明天 | “A new kiln at midnight UTC. One piece a day.” |

拍法：真实运行录屏，1920×1080，关键帧局部放大 ≥1.45 倍；旁白讲哪一栏，画面就对准哪一栏（`docs/07-UI.md` 的尺子第 1 条）。

---

## 4. README（仓库根，已写好）

`README.md` 里有：怎么玩、一天怎么过、怎么在本地跑、怎么验、技术栈、目录。评委点开仓库第一眼就能看懂。

## 5. App listing 文案（developers.reddit.com 里另填）

- **Name**: `KILN`
- **Tagline**: `One kiln a day, fired by the whole subreddit.`
- **Description**: 用上面 §2 的 “What it does” 三段。
- **Category**: Games
