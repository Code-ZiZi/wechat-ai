<div align="center">
  <h1>爱聊 (WeChat.ai)</h1>
  <p><b>将豆包与 DeepSeek 网页版接入同一群聊，通过纯前端脚本实现双 AI 自动往返对话。</b></p>
</div>

<br>

<div align="center">
  <img src="https://img.shields.io/badge/DeepSeek-Web-4D6BFE?style=flat-square&logo=deepseek&logoColor=white" alt="DeepSeek">
  <img src="https://img.shields.io/badge/WeChat-Style-07C160?style=flat-square&logo=wechat&logoColor=white" alt="WeChat">
  <img src="https://img.shields.io/badge/UserScript-JS-F1E05A?style=flat-square&logo=javascript&logoColor=black" alt="Userscript">
  <img src="https://img.shields.io/badge/Platform-Edge%20%7C%20Android-555555?style=flat-square" alt="Platform">
  <br>
  <img src="https://img.shields.io/badge/Server-None-2EA44F?style=flat-square" alt="No Server">
  <img src="https://img.shields.io/badge/API%20Key-Not%20Required-6E7781?style=flat-square" alt="No API Key">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-0969DA?style=flat-square" alt="License"></a>
</div>

<br>

<div align="center">
  <a href="#概述">概述</a> &nbsp;•&nbsp;
  <a href="#快速开始">快速开始</a> &nbsp;•&nbsp;
  <a href="#安装指南">安装指南</a> &nbsp;•&nbsp;
  <a href="#核心功能">核心功能</a> &nbsp;•&nbsp;
  <a href="#配置参数">配置参数</a> &nbsp;•&nbsp;
  <a href="#更新日志">更新日志</a> &nbsp;•&nbsp;
  <a href="#开源协议">开源协议</a>
</div>

<br>

---

## 概述

爱聊是一个纯前端用户脚本。它不调用底层 API、不依赖官方 SDK、不需要配置服务器。脚本仅在豆包与 DeepSeek 网页输入框中完成“输入、发送、读取回复、转发至另一端”的自动化流程，以 PC 微信的交互形态呈现双 AI 群聊体验。

> **提示**：脚本以 `.js` 文件分发，需通过浏览器脚本管理器导入。Via 浏览器不支持 `.crx` 扩展，请勿将本项目作为 Chrome 扩展安装。

---

## 快速开始

### 前置条件

- 已登录 [豆包](https://www.doubao.com) 与 [DeepSeek](https://chat.deepseek.com) 账号。
- 两个标签页需同时保持打开，每端各自负责半轮对话循环。
- **PC 端**：Windows Edge 浏览器，并安装 Tampermonkey。
- **移动端**：Android 设备，并安装 [Via 浏览器](https://viayoo.com/)。

### 运行机制

同时打开豆包与 DeepSeek 标签页，页面右下角出现悬浮聊天窗口。输入一条消息并发送，两个 AI 将按设定的轮次与长度自动交替对话。

---

## 安装指南

> 安装完成后，请同时打开豆包与 DeepSeek 两个标签页。右下角出现浮动聊天窗口，即表示脚本已生效。

### PC 端 (Windows Edge)

| 步骤 | 操作说明 |
| :--- | :--- |
| **1** | 在 Edge 扩展商店安装 [Tampermonkey](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)，或访问 [Tampermonkey 官网](https://www.tampermonkey.net) 查看其他安装方式。 |
| **2** | 点击浏览器右上角的 Tampermonkey 图标，进入“管理面板”。 |
| **3** | 点击“+”新建脚本，清空编辑器内的默认代码。 |
| **4** | 粘贴本项目全部代码，按 `Ctrl + S` 保存并启用。 |
| **5** | 确认脚本 `@match` 包含 `https://www.doubao.com/*` 与 `https://chat.deepseek.com/*`。 |

*注：两个 `@match` 规则缺一不可，否则对应网站的聊天窗口不会出现。*

### 移动端 (Android Via)

| 步骤 | 操作说明 |
| :--- | :--- |
| **1** | 将脚本下载并保存为 `WeChat-ai.js`。 |
| **2** | 打开 Via 浏览器，进入“菜单 -> 设置 -> 脚本 -> + -> 导入脚本”。 |
| **3** | 选择 `WeChat-ai.js` 文件，确认 `@match` 包含两个目标站点。 |
| **4** | 保存并启用。 |

*注：Via 不支持 `.crx` 扩展，请务必通过 Via 内置脚本管理器导入 `.js` 脚本。*

---

## 核心功能

| 模块 | 功能描述 |
| :--- | :--- |
| **沉浸式界面** | PC 微信风格悬浮窗，包含标题栏、消息区、工具栏与输入区。支持拖拽、八向缩放、边缘吸附与分屏布局。 |
| **双 AI 循环** | 用户消息触发豆包回复，豆包回复转发至 DeepSeek，DeepSeek 回复再转发回豆包，实现全自动流转。 |
| **参数控制** | `maxRounds` 控制往返轮数，`maxChars` 限制单条回复的软性字数长度，防止 AI 无限“刷屏”。 |
| **多模态互通** | 自动提取豆包生成的图片并渲染；用户可通过 `+` 按钮上传图片，实现图文混合对话。 |
| **窗口管理** | 支持快捷键 `Alt + W` 召出、双击标题栏最大化、最小化至屏幕边缘或半透明侧边条。 |
| **主题与外观** | 支持亮色、暗色、跟随系统三种主题模式；提供小、中、大三档字号调节；支持 30%-100% 窗口透明度与毛玻璃效果。 |
| **高度自定义** | 支持更换聊天背景、自定义 AI 头像（自动裁剪）、自定义 CSS 样式导入及代码块语法高亮。 |
| **数据持久化** | 消息数据通过 `GM_setValue` 本地存储，刷新页面或重启浏览器不丢失。 |

---

## 配置参数

配置项位于脚本头部（*UserScript Header*）下方：

```javascript
const DEFAULT_MAX_ROUNDS = 1;   // 每条用户消息触发的豆包与 DeepSeek 往返轮数
const DEFAULT_MAX_CHARS  = 100; // 追加到每条 AI prompt 的软性字数提示 (0 表示不限)
