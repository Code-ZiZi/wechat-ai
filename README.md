<div align="center">

# 爱聊 WeChat.ai

**将豆包与 DeepSeek 请进同一会话，让两个大模型自然地对话下去。**

<h4>
  <a href="#概览">概览</a> ·
  <a href="#快速开始">快速开始</a> ·
  <a href="#安装">安装</a> ·
  <a href="#功能">功能</a> ·
  <a href="#配置">配置</a> ·
  <a href="#工作原理">工作原理</a> ·
  <a href="#兼容性">兼容性</a> ·
  <a href="#许可证">许可证</a>
</h4>

[![DeepSeek Web][deepseek-shield]][project-link]
[![Doubao Web][doubao-shield]][project-link]
[![Userscript][userscript-shield]][project-link]
[![License][license-shield]][license-link]
[![No Server][server-shield]][project-link]
[![No API Key][apikey-shield]][project-link]

</div>

---

## 概览

爱聊是一个纯前端的用户脚本。

不调用任何官方 API，不依赖 SDK，也不需要服务器。脚本运行在豆包与 DeepSeek 的网页端，通过模拟「输入 → 发送 → 读取回复 → 转发给对方」的流程，让两个大模型在同一会话中交替对话。

所有交互均在浏览器本地完成。账号鉴权、内容生成与网络请求，依旧由各自的官方网页负责。

> **重要提示：** 本项目以 `.js` 用户脚本形式分发，必须通过 Tampermonkey 或 Via 内置的脚本管理器导入，不能作为 Chrome 扩展（`.crx`）安装。

---

## 快速开始

### 前置条件

- 已分别登录 [豆包](https://www.doubao.com) 与 [DeepSeek](https://chat.deepseek.com) 账号
- 两个站点的标签页保持同时打开；每一侧各自负责一半的循环
- 桌面端：Microsoft Edge 浏览器，并已安装 Tampermonkey
- 移动端：Android 设备，并已安装 Via 浏览器

<br>

### 三步跑通

1. 打开豆包与 DeepSeek 的两个标签页
2. 页面右下角出现浮动聊天窗口后，输入一条消息并发送
3. 两个 AI 将按设定的轮次与长度自动交替对话

---

## 安装

> 安装完成后，请同时打开豆包与 DeepSeek 两个标签页。右下角出现浮动聊天窗口，即表示脚本已生效。

### 桌面端 · Microsoft Edge

1. 在 Edge 扩展商店安装 [Tampermonkey](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)；其他平台请参见 [官方站点](https://www.tampermonkey.net)
2. 点击工具栏中的 Tampermonkey 图标，进入「管理面板」
3. 点击 `+` 新建脚本，清空编辑器中的默认内容
4. 粘贴本项目的全部代码，按 `Ctrl + S` 保存并启用
5. 确认脚本的 `@match` 规则包含以下两项：

```text
https://www.doubao.com/*
https://chat.deepseek.com/*
```

> 两个 `@match` 缺一不可。若缺少任意一项，对应站点将不会出现聊天窗口。

<br>

### 移动端 · Android Via

1. 将脚本保存为 `WeChat-ai.js`
2. 打开 Via 浏览器，依次进入：菜单 → 设置 → 脚本 → `+` → 导入脚本
3. 选择 `WeChat-ai.js`，确认 `@match` 规则包含：

```text
https://www.doubao.com/*
https://chat.deepseek.com/*
```

4. 保存并启用

> Via 不支持 `.crx` 扩展。请务必通过 Via 内置的脚本管理器导入 `.js` 用户脚本，不要作为 Chrome 扩展安装。

---

## 功能

| 能力 | 说明 |
| :--- | :--- |
| **微信群聊界面** | 左右分栏气泡、头像、可拖拽与可缩放的窗口，还原微信聊天观感 |
| **双 AI 自动循环** | 用户消息触发豆包回复，豆包回复转发至 DeepSeek，DeepSeek 回复再转发回豆包 |
| **轮次与长度控制** | `maxRounds` 控制往返轮数，`maxChars` 限制单条回复的软性长度 |
| **图片互通** | 自动提取豆包生成的图片并渲染；用户也可通过 `+` 按钮上传图片参与对话 |
| **完全可移动窗口** | 拖动标题栏移动，边角缩放，支持最大化、最小化与边缘吸附 |
| **自定义背景与头像** | 右键空白处更换聊天背景；点击头像上传自定义头像 |
| **下拉刷新** | 消息区滚动至顶部后继续上滑，即可重新加载页面 |
| **持久化历史** | 消息经由 `GM_setValue` 存储，刷新页面或重启浏览器后不丢失 |

---

## 配置

所有配置项均位于脚本顶部，修改后重新保存脚本即可生效：

```javascript
const DEFAULT_MAX_ROUNDS = 1;   // 每条用户消息触发的豆包 ↔ DeepSeek 往返轮数
const DEFAULT_MAX_CHARS  = 100; // 追加至每条 AI prompt 的软性字数提示（0 表示不限制）
```

| 参数 | 默认值 | 说明 |
| :--- | :---: | :--- |
| `DEFAULT_MAX_ROUNDS` | `1` | 往返轮数。设为 `2` 表示豆包 → DeepSeek → 豆包 → DeepSeek 各一轮 |
| `DEFAULT_MAX_CHARS` | `100` | 软性字数上限。仅作为 prompt 提示，不强制截断 |

---

## 工作原理

爱聊在两端各注入一份脚本，双方通过 `GM_setValue` 共享存储作为信箱：

1. 用户在任意一侧输入消息，脚本将消息写入共享存储
2. 本侧 AI 网页被驱动发送 prompt，并读取回复
3. 回复写入共享存储，另一侧轮询到新任务后驱动其 AI 回复
4. 如此往复，直至达到配置的往返轮数

整个过程没有服务器参与，也没有调用任何官方 API。两个 AI 看到的，仍然是各自官方网页的输入框与对话。

---

## 兼容性

| 环境 | 支持 | 备注 |
| :--- | :---: | :--- |
| Microsoft Edge + Tampermonkey | 支持 | 推荐桌面端方案 |
| Chrome + Tampermonkey | 支持 | 与 Edge 表现一致 |
| Android Via | 支持 | 需通过内置脚本管理器导入 |
| iOS 浏览器 | 未测试 | 受 iOS 限制，脚本管理器选择有限 |

> 本项目依赖豆包与 DeepSeek 网页端的 DOM 结构。若官方前端发生重大调整，脚本可能需要相应更新。

---

## 贡献

欢迎提交 Issue 或 Pull Request。贡献时请遵循以下原则：

- 保持「纯前端、无服务器、无需 API Key」的设计
- 优先使用浏览器原生能力，避免引入第三方运行时依赖
- 修改 UI 或交互时，请同步更新本 README

---

## 许可证

本项目采用 **MIT 许可证**。具有法律效力的英文原文请参阅 [LICENSE](./LICENSE)。

以下译文仅供参考：

- [简体中文](./LICENSE.zh-CN.md)
- [日本語](./LICENSE.ja.md)
- [한국어](./LICENSE.ko.md)

如各语言版本之间存在歧义，以英文版本为准。

Copyright &copy; 2026 shen136 lin-drv-game

<br>

---

<br>

<div align="center">

# WeChat.ai

**Bring Doubao and DeepSeek into one conversation — and let the two models talk to each other.**

<h4>
  <a href="#overview">Overview</a> ·
  <a href="#quick-start">Quick Start</a> ·
  <a href="#installation">Installation</a> ·
  <a href="#features">Features</a> ·
  <a href="#configuration">Configuration</a> ·
  <a href="#how-it-works">How It Works</a> ·
  <a href="#compatibility">Compatibility</a> ·
  <a href="#license">License</a>
</h4>

[![DeepSeek Web][deepseek-shield]][project-link]
[![Doubao Web][doubao-shield]][project-link]
[![Userscript][userscript-shield]][project-link]
[![License][license-shield]][license-link]
[![No Server][server-shield]][project-link]
[![No API Key][apikey-shield]][project-link]

</div>

---

## Overview

WeChat.ai is a pure client-side userscript.

It does not call any official API, depend on any SDK, or require a server. It runs on the Doubao and DeepSeek web apps and drives a simple loop: type, send, read, forward. The two models converse turn by turn inside a single shared session.

Everything happens locally in your browser. Authentication, content generation, and network requests are still handled entirely by the official websites.

> **Important:** This project is distributed as a `.js` userscript and must be imported through Tampermonkey or Via's built-in script manager. It cannot be installed as a Chrome extension (`.crx`).

---

## Quick Start

### Prerequisites

- Logged in to both [Doubao](https://www.doubao.com) and [DeepSeek](https://chat.deepseek.com)
- Both tabs kept open simultaneously; each side is responsible for half of the loop
- Desktop: Microsoft Edge with Tampermonkey installed
- Mobile: Android device with Via Browser installed

<br>

### Three steps

1. Open both the Doubao and DeepSeek tabs
2. Once the floating chat window appears in the bottom-right corner, type a message and send
3. The two AIs will converse automatically according to the configured rounds and length

---

## Installation

> After installation, open both the Doubao and DeepSeek tabs. A floating chat window in the bottom-right corner confirms that the script is active.

### Desktop · Microsoft Edge

1. Install [Tampermonkey](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd) from the Edge Add-ons store. For other platforms, see the [official site](https://www.tampermonkey.net)
2. Click the Tampermonkey icon in the toolbar and open the Dashboard
3. Click `+` to create a new script, then clear the default template
4. Paste the full source of this project, then press `Ctrl + S` to save and enable
5. Verify that the `@match` rules include both:

```text
https://www.doubao.com/*
https://chat.deepseek.com/*
```

> Both `@match` rules are required. If either is missing, the chat window will not appear on that site.

<br>

### Mobile · Android Via

1. Save the script as `WeChat-ai.js`
2. Open Via Browser and navigate to: Menu → Settings → Scripts → `+` → Import Script
3. Select `WeChat-ai.js` and confirm that the `@match` rules include:

```text
https://www.doubao.com/*
https://chat.deepseek.com/*
```

4. Save and enable

> Via does not support `.crx` extensions. Import the `.js` userscript through Via's built-in script manager — do not attempt to install it as a Chrome extension.

---

## Features

| Capability | Description |
| :--- | :--- |
| **WeChat-style UI** | Left/right chat bubbles, avatars, and a draggable, resizable window that mirrors WeChat |
| **Two-AI auto loop** | A user message triggers Doubao; its reply is forwarded to DeepSeek, whose reply is forwarded back |
| **Round and length control** | `maxRounds` limits back-and-forth turns; `maxChars` caps per-reply length |
| **Image pass-through** | Images generated by Doubao are captured and rendered; users can also upload images via the `+` button |
| **Fully movable window** | Drag the title bar to move, resize from corners, maximize, minimize, or snap to an edge |
| **Custom background and avatar** | Right-click empty space to change the chat background; click an avatar to upload a custom image |
| **Pull to refresh** | Scroll to the top of the message list and keep scrolling up to reload the page |
| **Persistent history** | Messages are stored via `GM_setValue` and survive page reloads and browser restarts |

---

## Configuration

All configuration lives at the top of the script. Re-save the script after making changes:

```javascript
const DEFAULT_MAX_ROUNDS = 1;   // Number of Doubao ↔ DeepSeek round trips per user message
const DEFAULT_MAX_CHARS  = 100; // Soft character cap appended to each AI prompt (0 = unlimited)
```

| Parameter | Default | Description |
| :--- | :---: | :--- |
| `DEFAULT_MAX_ROUNDS` | `1` | Number of round trips. `2` means Doubao → DeepSeek → Doubao → DeepSeek |
| `DEFAULT_MAX_CHARS` | `100` | Soft character limit. Passed as a prompt hint only; not enforced |

---

## How It Works

WeChat.ai injects one script into each side. Both sides communicate through `GM_setValue`, which acts as a shared mailbox:

1. The user types a message on either side, and the script writes it to shared storage
2. The local AI page is driven to send the prompt and read the reply
3. The reply is written to shared storage; the other side polls for new tasks and drives its AI to respond
4. The loop continues until the configured number of rounds is reached

No server is involved, and no official API is called. Each AI still sees only its own official input field and conversation.

---

## Compatibility

| Environment | Status | Notes |
| :--- | :---: | :--- |
| Microsoft Edge + Tampermonkey | Supported | Recommended desktop setup |
| Chrome + Tampermonkey | Supported | Behaves identically to Edge |
| Android Via | Supported | Import via the built-in script manager |
| iOS browsers | Untested | Limited script-manager availability on iOS |

> This project depends on the DOM structure of the Doubao and DeepSeek web apps. Major front-end changes on either site may require script updates.

---

## Contributing

Issues and Pull Requests are welcome. When contributing, please keep the following principles:

- Preserve the "pure front-end, no server, no API key" design
- Prefer native browser capabilities over third-party runtime dependencies
- Update this README alongside any UI or interaction changes

---

## License

Released under the **MIT License**. See [LICENSE](./LICENSE) for the legally binding English text.

Translations are provided for reference only:

- [简体中文](./LICENSE.zh-CN.md)
- [日本語](./LICENSE.ja.md)
- [한국어](./LICENSE.ko.md)

In case of any ambiguity between translations, the English version prevails.

Copyright &copy; 2026 shen136 lin-drv-game

<br>

---

<div align="center">
  <sub>纯前端 · 无服务器 · 无需 API Key</sub>
  <br>
  <sub>Pure front-end · Serverless · No API key required</sub>
</div>

[project-link]: https://github.com/shen136/WeChat.ai
[license-link]: ./LICENSE
[deepseek-shield]: https://img.shields.io/badge/DeepSeek-Web-4a6cf7?style=flat-square&logo=deepseek&logoColor=white
[doubao-shield]: https://img.shields.io/badge/Doubao-Web-f5a623?style=flat-square
[userscript-shield]: https://img.shields.io/badge/Userscript-JavaScript-f1e05a?style=flat-square&logo=javascript&logoColor=black
[license-shield]: https://img.shields.io/badge/License-MIT-3DA639?style=flat-square
[server-shield]: https://img.shields.io/badge/Server-None-22c55e?style=flat-square
[apikey-shield]: https://img.shields.io/badge/API%20Key-Not%20Required-9ca3af?style=flat-square
