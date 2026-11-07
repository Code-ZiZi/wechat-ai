<h1 align="center">爱聊(WeChat.ai)</h1>

<p align="center"><strong>把豆包和 DeepSeek 拉进同一个“微信群聊”，让两个 AI 自己聊起来。</strong></p>

<p align="center">
  <a href="https://github.com/shen136/WeChat.ai/blob/main/WeChat-ai.js"><img src="https://img.shields.io/badge/Deepseek-blue?style=for-the-badge" alt="Deepseek"></a>
  <a href="https://github.com/shen136/WeChat.ai/blob/main/WeChat-ai.js"><img src="https://img.shields.io/badge/豆包-white?style=for-the-badge" alt="豆包"></a>
  <a href="https://github.com/shen136/WeChat.ai/blob/main/WeChat-ai.js"><img src="https://img.shields.io/badge/Userscript-.js-yellow?style=for-the-badge" alt="Userscript"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License"></a>
  <img src="https://img.shields.io/badge/Server-None-brightgreen?style=for-the-badge" alt="No Server">
  <img src="https://img.shields.io/badge/API%20Key-Not%20Required-lightgrey?style=for-the-badge" alt="No API Key">
</p>

<p align="center">
  <a href="#快速开始">快速开始</a> ·
  <a href="#安装">安装</a> ·
  <a href="#功能">功能</a> ·
  <a href="#配置">配置</a> ·
  <a href="#贡献">贡献</a> ·
  <a href="#许可证">许可证</a>
</p>

---

> 一个纯前端用户脚本：不调 API、不依赖官方 SDK、不需要服务器。它做的只是在豆包和 DeepSeek 的网页输入框里“打字 → 点发送 → 读回复 → 转发给另一边”。

> **注意：Via 浏览器不支持 `.crx` 扩展。**  
> 本项目以 `.js` 文件分发，必须通过 Via 内置的脚本管理器导入，不能当作 Chrome 扩展安装。

---

## 快速开始

### 前置条件

- 已登录 [豆包](https://www.doubao.com) 和 [DeepSeek](https://chat.deepseek.com) 账号
- **两个标签页同时保持打开**（每一边各自负责自己的半轮循环）
- PC 端：Windows Edge 浏览器，并安装 Tampermonkey（篡改猴）
- 移动端：Android 设备，并安装 [Via 浏览器](https://viayoo.com/)

### 跑通

打开豆包和 DeepSeek 两个标签页，右下角会出现浮动聊天窗口。输入一条消息并发送，两个 AI 就会按设定的轮次和长度自动交替对话。

---

## 安装

> **提示：** 安装完成后，请同时打开豆包和 DeepSeek 两个标签页，右下角出现浮动聊天窗口即表示脚本已生效。

### <img src="https://img.shields.io/badge/Edge-0078D7?style=flat-square&logo=microsoftedge&logoColor=white" height="22" alt="Microsoft Edge"> PC 端（Windows Edge）

1. 打开 Edge 浏览器，进入扩展商店安装 **[Tampermonkey（篡改猴）](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)** 插件。也可以访问 [Tampermonkey 官网](https://www.tampermonkey.net) 查看其他安装方式。
2. 点击浏览器右上角的 Tampermonkey 图标，选择 **管理面板（Dashboard）**。
3. 点击 `+` 号新建脚本，清空编辑器里的默认代码。
4. 将本项目的全部代码粘贴进去，按 `Ctrl + S` 保存并启用。
5. 确保脚本的 `@match` 规则包含：
   - `https://www.doubao.com/*`
   - `https://chat.deepseek.com/*`

> **注意：** 两个 `@match` 缺一不可，否则对应网站的聊天窗口不会出现。

### <img src="https://img.shields.io/badge/Android-3DDC84?style=flat-square&logo=android&logoColor=white" height="22" alt="Android"> 移动端（Android Via）

1. 将脚本保存为 `WeChat-ai.js`。
2. 打开 Via 浏览器 → `≡` 菜单 → **设置** → **脚本** → `+` → **导入脚本**。
3. 选择 `WeChat-ai.js` 文件，确认 `@match` 包含：
   - `https://www.doubao.com/*`
   - `https://chat.deepseek.com/*`
4. 保存并启用。

> **注意：** Via 不支持 `.crx` 扩展，请务必通过 Via 内置的脚本管理器导入 `.user.js` / `.js` 脚本，不要当作 Chrome 扩展安装。

> **安装完成！** 打开豆包和 DeepSeek 两个标签页，输入一条消息，就可以看两个 AI 在“微信群聊”里自动聊起来了。

---

## 功能

| 功能 | 说明 |
|---|---|
| **微信群聊 UI** | 左右气泡、头像、可拖拽、可缩放，还原微信聊天体验 |
| **双 AI 自动循环** | 用户消息 → 豆包 → 豆包回复转发 DeepSeek → DeepSeek 回复转发回豆包 |
| **轮次与长度控制** | `maxRounds` 控制往返轮数，`maxChars` 限制每条回复的软性长度，防止 AI 互相“刷屏” |
| **图片互通** | 提取豆包生成的图片并渲染；用户也可通过 `+` 按钮上传图片 |
| **完全可移动窗口** | 拖标题栏移动，右下角缩放，支持最大化 / 最小化 / 吸附为半透明侧边条 |
| **自定义背景与头像** | 长按空白区更换聊天背景；点击头像上传自定义头像（自动裁剪为 64×64 JPEG） |
| **下拉刷新** | 消息区滚动到顶部后下拉，重新加载页面 |
| **持久化历史** | 消息通过 `GM_setValue` 存储，刷新或重启浏览器后不丢失 |

---

## 配置

配置位于脚本顶部：

```javascript
const DEFAULT_MAX_ROUNDS = 1;   // 每条用户消息触发的豆包 ↔ DeepSeek 往返轮数
const DEFAULT_MAX_CHARS  = 100; // 追加到每条 AI prompt 的软性字数提示（0 = 不限）
```

---

## 贡献

欢迎提交 Issue 或 Pull Request。贡献时请尽量保持本项目“纯前端、无服务器、无需 API Key”的设计。

---

## 许可证

本项目采用 **MIT 许可证**。具有法律效力的英文原文请参阅 [LICENSE](./LICENSE)。

以下译文仅供参考：

- [简体中文](./LICENSE.zh-CN.md)
- [日本語](./LICENSE.ja.md)
- [한국어](./LICENSE.ko.md)

如各语言版本之间存在歧义，**以英文版本为准**。

版权所有 (c) 2026 shen136 lin-drv-game
