# 01 · 來源

凡是写进游戏里的数、规则、文案依据，都列在这里。抓取日期 2026-11-14。

## 官方规则

| 内容 | 原文 | 出处 |
| --- | --- | --- |
| 四个评分项，各 25% | Delightful UX / Polish / Reddit-y / Daily Content | https://redditgameofday2026.devpost.com/ |
| 提交期 | 2026-11-11 12:00 PT → **2026-12-08 18:00 PT**（北京 12-09 10:00） | 同上 + `/rules` |
| 资格 | 成年；All countries/territories, excluding standard exceptions（排除 Brazil / Quebec / Russia / Crimea / Cuba / Iran / NK / Syria + OFAC，**未点名中国大陆**） | https://redditgameofday2026.devpost.com/rules |
| 不用发布 | “Please do not submit your app for publishing … uploading and playtesting your app” | 同上 |
| 必须交付 | App listing 链接（developers.reddit.com/apps/…）+ 公开 demo 贴文 + README；可选 ≤1 分钟影片、可选公开仓库、可选反馈问卷 | 同上 |
| 官方点名加分 | 直觉 onboarding、视觉工艺、校准的每日内容、聚焦玩法、清楚结束状态与回流、**Devvit Journeys 埋点** | https://redditgameofday2026.devpost.com/ |
| 官方点名减分 | AI slop、硬套 Reddit 梗（Snoo/karma）、烂大街题材（太空射击、换皮、平台跳跃、协作讲故事、trivia）、没跑在 Reddit 上 | 同上 |
| Best Ported Daily Game | 搬自己的 IP 或从别的平台搬，须自己拥有原 IP，提交时注明是 port | 同上 |

## 平台文档（开发依据）

| 文档 | 用途 | 链接 |
| --- | --- | --- |
| Quickstart（Node ≥ 24、`devvit login`、`npm run dev` = playtest） | 工具链 | https://developers.reddit.com/docs/quickstart |
| Devvit Web | 标准 web 栈 + 服务器端点 | https://developers.reddit.com/docs/capabilities/devvit-web/devvit_web_overview |
| devvit.json 配置 | 入口、权限、菜单、触发、定时任务 | https://developers.reddit.com/docs/capabilities/devvit-web/devvit_web_configuration |
| Redis（字符串／哈希／有序集合、`hSetNX`、事务 5 秒超时） | 共用那一窑 | https://developers.reddit.com/docs/capabilities/server/redis |
| Creating a Custom Post（`submitCustomPost`、`styles`） | 每日贴与新贴 | https://developers.reddit.com/docs/capabilities/creating_custom_post |
| Scheduler（cron + `/internal/…`） | 每天 00:05 点新窑 | https://developers.reddit.com/docs/capabilities/server/scheduler |
| Devvit Journeys（`App.Ready` / `Journey.Start` / `Progress` / `Interaction` / `End`） | 埋点 | https://developers.reddit.com/docs/capabilities/analytics/devvit-journeys |
| Template `reddit/devvit-template-react`（React 19 + Hono + Vite，Node ≥ 24） | 工程骨架 | https://github.com/reddit/devvit-template-react |

## 参考作品（闸 D 的尺子，也是「什么算好」的依据）

| 作品 | 成绩 | 来源 |
| --- | --- | --- |
| **Hexaword**（u/another_moose） | **Best Daily Game App**，Fun & Games with Devvit Web Hackathon | https://devpost.com/software/hexaword ｜ https://developers.reddit.com/docs/blog |
| **Cattack!**（u/derppherppp） | **Best Use of Phaser $5,000**，Games with a Hook 2026（700+ 参赛、$40,000 奖池） | https://www.phaser.io/news/2026/08/games-with-a-hook-hackathon-phaser-winners |
| **Myndrot**（u/SaintFlow + u/External-Morning-973） | Honorable Mention，同上 | 同上 |
| **Hearthvale**（u/Romario--_--） | Honorable Mention，同上 | 同上 |
| **Chook**（u/thejohnnyr） | 早期 Devvit 黑客松第一名；作者后来做出 30 万订阅的 **Honk** | https://developers.reddit.com/docs/blog |

## 题材考据（游戏里没有一句术语是编的）

| 游戏里 | 真实工艺 | 出处 |
| --- | --- | --- |
| 窑头／窑身／窑尾温度递减 | 柴窑沿长度方向有温差，同一窑不同窑位火候不同 | 景德镇柴窑工艺通行说法；另见本项目前作《把桩》`docs/05-SUBMISSION.md` §3 的考据表 |
| 满窑分火位 | 不同釉、不同器型要放进不同火位的匣钵柱 | 同上 |
| 火照子 | 从火眼钩出瓷片看釉的熔融程度，判断停火时机 | 同上 |
| 窑变 | 还原气氛与温度共同作用下的偶发呈色 | 同上 |
| 青花／影青／霁红 的烧成温度带 | 釉种不同，成熟温度不同；本作的数是公开资料里的常见区间，为可玩性做了压缩 | 同上 |

> 本作把《把桩》的**烧成机制**（窑位温度、拥挤降温、投柴窗口、判定带）抽出来，重做成 60 秒一天的公共窑；叙事、地图、二十夜流程都不沿用。原作 MIT，本作同许可。
