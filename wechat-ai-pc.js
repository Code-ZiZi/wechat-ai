// ==UserScript==
// @name         爱聊 (WeChat.ai)
// @namespace    wechat.ai
// @version      2.0.0
// @description  微信风格的多AI群聊 - 豆包 & DeepSeek
// @match        https://www.doubao.com/*
// @match        https://chat.deepseek.com/*
// @require      https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    const VERSION = '2.0.0';
    const isDoubao = location.hostname.includes('doubao.com');
    const myRole = isDoubao ? 'doubao' : 'deepseek';
    const myLabel = isDoubao ? '豆包' : 'DeepSeek';
    const otherLabel = isDoubao ? 'DeepSeek' : '豆包';

    const K = {
        TASK: 'wechat_ai_task_deepseek',
        REPLY: 'wechat_ai_reply_deepseek',
        MSGS: 'wechat_ai_messages',
        USER: 'wechat_ai_user_msg',
        BG: 'wechat_ai_bg',
        SESS: 'wechat_ai_session',
        THINKING: 'wechat_ai_thinking',
        CUSTOM_CSS: 'wechat_ai_custom_css',
        CMD_CLEAR: 'wechat_ai_cmd_clear',
        IMG: 'wechat_ai_img_',
        HB: 'wechat_ai_hb_',
        LAST_OPEN: 'wechat_ai_last_open_',
        FONT: 'wechat_ai_font_size',
        THEME: 'wechat_ai_theme',
        OPACITY: 'wechat_ai_opacity'
    };

    const LEI_JUN_QUOTES = [
        "专注、极致、口碑、快。",
        "站在风口上，猪都能飞起来。",
        "找人不是三顾茅庐，而是三十次顾茅庐。",
        "天下武功，唯快不破。",
        "厚道的人运气不会太差。",
        "为发烧而生。",
        "永远相信美好的事情即将发生。",
        "人因梦想而伟大。",
        "让每个人都能享受到科技带来的乐趣"
    ];

    const DEFAULT_MAX_ROUNDS = 1;
    const DEFAULT_MAX_CHARS = 100;
    const IMG_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/bmp,image/heic,image/heif,image/*';

    const DS_AVATAR_URL = 'https://avatars.githubusercontent.com/u/148330874?v=4';
    const DB_AVATAR_URL = 'https://lf-flow-web-cdn.doubao.com/obj/flow-doubao/doubao/chat/favicon-doubao.png';

    const AVATARS = {
        user: { img: 'https://lh3.googleusercontent.com/a/default-user=s100', text: 'U', bg: '#07c160' },
        doubao: { img: DB_AVATAR_URL, text: '包', bg: '#f5a623' },
        deepseek: { img: DS_AVATAR_URL, text: '鲸', bg: '#4a6cf7' }
    };
    ['user', 'doubao', 'deepseek'].forEach(k => {
        const s = GM_getValue('wechat_ai_avatar_' + k);
        if (s) AVATARS[k].img = s;
    });

    const FONT_SIZES = {
        small: { base: '12px', sm: '11px', xs: '10px' },
        medium: { base: '13px', sm: '12px', xs: '11px' },
        large: { base: '15px', sm: '14px', xs: '12px' }
    };

    let state = 'normal', savedRect = null, rendered = 0, thinkingTimer = null, lastThinkingKey = '';
    let lastMsgJson = '';
    let executing = false, pendingForward = null;
    let lastUserTs = 0, lastTaskTs = 0, lastReplyTs = 0;
    const seen = new Set(); let lastKey = '', stable = 0;
    let ready = false;
    let currentHref = location.href, urlChangeUntil = 0;
    let customCss = GM_getValue(K.CUSTOM_CSS, '');
    let lastReloadCmd = GM_getValue('wechat_ai_cmd_reload', 0);

    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

    const saveImage = (dataUrl) => {
        const id = genId();
        GM_setValue(K.IMG + id, dataUrl);
        return id;
    };
    const loadImage = (id) => id ? GM_getValue(K.IMG + id, '') : '';

    const getSession = () => {
        try { return Object.assign({ round: 0, maxRounds: DEFAULT_MAX_ROUNDS, maxChars: DEFAULT_MAX_CHARS, active: false }, JSON.parse(GM_getValue(K.SESS) || '{}')); }
        catch (e) { return { round: 0, maxRounds: DEFAULT_MAX_ROUNDS, maxChars: DEFAULT_MAX_CHARS, active: false }; }
    };
    const setSession = s => GM_setValue(K.SESS, JSON.stringify(s));
    const resetSession = () => setSession({ round: 0, maxRounds: DEFAULT_MAX_ROUNDS, maxChars: DEFAULT_MAX_CHARS, active: true });

    const getThinking = () => {
        try { return Object.assign({ active: false, startTime: 0, duration: 0 }, JSON.parse(GM_getValue(K.THINKING) || '{}')); }
        catch (e) { return { active: false, startTime: 0, duration: 0 }; }
    };
    const setThinking = t => GM_setValue(K.THINKING, JSON.stringify(t));

    const getMessages = () => {
        try { const a = JSON.parse(GM_getValue(K.MSGS)); return Array.isArray(a) ? a : []; } catch (e) { return []; }
    };

    const pushMessage = (who, text, images, extra) => {
        const msgs = getMessages();
        if (who !== 'user' && who !== 'system' && msgs.length > 0) {
            const last = msgs[msgs.length - 1];
            if (last.who === who && Date.now() - last.ts < 13500) {
                last.text = text || '';
                last.images = images || [];
                last.ts = Date.now() + Math.random();
                if (extra) {
                    if (extra.thinkingMs !== undefined) last.thinkingMs = extra.thinkingMs;
                } else {
                    delete last.thinkingMs;
                }
                GM_setValue(K.MSGS, JSON.stringify(msgs));
                return;
            }
        }
        if (who === 'system' && msgs.length > 0) {
            const last = msgs[msgs.length - 1];
            if (last.who === 'system' && last.text === text && Date.now() - last.ts < 5000) return;
        }
        msgs.push(Object.assign({ who, text: text || '', images: images || [], ts: Date.now() + Math.random() }, extra || {}));
        GM_setValue(K.MSGS, JSON.stringify(msgs));
    };

    function resizeImage(file, maxSide, quality, square) {
        return new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onerror = reject;
            r.onload = () => {
                const img = new Image();
                img.onerror = reject;
                img.onload = () => {
                    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
                    if (square) {
                        const min = Math.min(img.width, img.height);
                        canvas.width = canvas.height = maxSide;
                        ctx.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, maxSide, maxSide);
                    } else {
                        const scale = Math.min(maxSide / img.width, maxSide / img.height, 1);
                        canvas.width = Math.round(img.width * scale);
                        canvas.height = Math.round(img.height * scale);
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    }
                    resolve(canvas.toDataURL('image/jpeg', quality || 0.75));
                };
                img.src = r.result;
            };
            r.readAsDataURL(file);
        });
    }

    function pickFile(accept, cb) {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = accept; input.style.display = 'none';
        document.body.appendChild(input);
        input.onchange = async () => {
            const f = input.files && input.files[0];
            if (f) try { await cb(f); } catch (e) {}
            input.remove();
        };
        input.click();
    }

    function pickAvatar(who, el) {
        pickFile(IMG_ACCEPT, async f => {
            const url = await resizeImage(f, 64, 0.82, true);
            AVATARS[who].img = url;
            GM_setValue('wechat_ai_avatar_' + who, url);
            el.style.backgroundImage = `url("${url}")`;
            el.textContent = '';
            if (who === myRole) {
                const thinkAv = document.querySelector('#wechat-ai-thinking .wechat-ai-avatar');
                if (thinkAv) thinkAv.style.backgroundImage = `url("${url}")`;
            }
        });
    }

    function setChatBg(url) {
        const el = document.getElementById('wechat-ai-messages');
        if (!el) return;
        if (url) el.style.setProperty('--bg-image', `url("${url}")`);
        else el.style.removeProperty('--bg-image');
    }

    function pickUserImage() {
        pickFile(IMG_ACCEPT, async f => {
            const url = await resizeImage(f, 480, 0.7);
            const imgId = saveImage(url);
            resetSession();
            setThinking({ active: false, duration: 0 });
            lastThinkingKey = '';
            stopThinking();
            pushMessage('user', '', [imgId]);
            flush();
            GM_setValue(K.USER, JSON.stringify({ text: '[用户上传了一张图片]', imageId: imgId, ts: Date.now(), source: myRole }));
            markThinkingStart();
        });
    }

    function pickBackground() {
        pickFile(IMG_ACCEPT, async f => {
            const url = await resizeImage(f, 1280, 0.75);
            GM_setValue(K.BG, url);
            setChatBg(url);
        });
    }

    async function setTextarea(el, text) {
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
        setter.call(el, ''); el.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(60);
        setter.call(el, text); el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    async function typeIntoDoubao(text) {
        const editors = [...document.querySelectorAll('div[contenteditable="true"], [role="textbox"]')];
        let editor = null;
        for (const e of editors) {
            const r = e.getBoundingClientRect();
            if (r.width > 100 && r.height > 20 && r.top > 0) { editor = e; break; }
        }
        if (!editor) editor = document.querySelector('div[contenteditable="true"]');

        if (editor) {
            editor.focus();
            const sel = window.getSelection(), range = document.createRange();
            range.selectNodeContents(editor); sel.removeAllRanges(); sel.addRange(range);
            document.execCommand('delete', false, null);
            await sleep(150);

            const dt = new DataTransfer(); dt.setData('text/plain', text);
            editor.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
            await sleep(300);
            if ((editor.innerText || '').trim().length > 0) return true;

            document.execCommand('insertText', false, text);
            await sleep(300);
            if ((editor.innerText || '').trim().length > 0) return true;

            editor.innerHTML = '';
            const p = document.createElement('p');
            p.textContent = text;
            editor.appendChild(p);
            editor.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: text, bubbles: true, cancelable: false }));
            editor.dispatchEvent(new Event('change', { bubbles: true }));
            await sleep(300);
            return !!(editor.innerText || '').trim();
        }

        const ta = document.querySelector('textarea');
        if (ta && ta.offsetParent !== null) { await setTextarea(ta, text); return true; }
        return false;
    }

    async function pasteImageToDoubao(base64) {
        try {
            const blob = await (await fetch(base64)).blob();
            const file = new File([blob], 'image_' + Date.now() + '.jpg', { type: 'image/jpeg' });
            const editor = document.querySelector('div[contenteditable="true"]');
            if (!editor) return false;
            editor.focus(); await sleep(200);
            const dt = new DataTransfer(); dt.items.add(file);
            editor.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
            return true;
        } catch (e) { return false; }
    }

    async function typeIntoDeepseek(text) {
        const ta = document.querySelector('textarea#chat-input') || document.querySelector('textarea');
        if (!ta) return false;
        await setTextarea(ta, text); return true;
    }

    async function pasteImageToDeepseek(base64) {
        try {
            const blob = await (await fetch(base64)).blob();
            const file = new File([blob], 'image_' + Date.now() + '.jpg', { type: 'image/jpeg' });
            const ta = document.querySelector('textarea#chat-input') || document.querySelector('textarea');
            if (!ta) return false;
            ta.focus(); await sleep(200);
            const dt = new DataTransfer(); dt.items.add(file);
            ta.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
            return true;
        } catch (e) { return false; }
    }

    const typeIntoMyAI = text => isDoubao ? typeIntoDoubao(text) : typeIntoDeepseek(text);
    const pressEnter = el => ['keydown', 'keyup'].forEach(t => el.dispatchEvent(new KeyboardEvent(t, { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true, cancelable: true })));
    const isEnabled = el => el && !el.disabled && el.getAttribute('aria-disabled') !== 'true' && el.getClientRects().length > 0;

    function findSendBtn(editorEl) {
        const labeled = [...document.querySelectorAll('[aria-label]')];
        for (const b of labeled) { const l = (b.getAttribute('aria-label') || '').trim(); if ((l === '发送' || l.toLowerCase() === 'send') && isEnabled(b)) return b; }
        for (const b of labeled) { const l = (b.getAttribute('aria-label') || '').trim(); if (/^(发送|send)/i.test(l) && isEnabled(b)) return b; }
        if (editorEl) {
            let p = editorEl.parentElement;
            for (let i = 0; i < 8 && p; i++) {
                const btns = [...p.querySelectorAll('button, div[role="button"], div[class*="send"]')].filter(isEnabled);
                for (const b of btns) {
                    if ((b.getAttribute('aria-label') || '').match(/^(发送|send)/i)) return b;
                }
                p = p.parentElement;
            }
        }
        return [...document.querySelectorAll('button, div[role="button"]')].find(b => (b.innerText || '').trim() === '发送' && isEnabled(b)) || null;
    }

    async function waitAndClickSend(editorEl, timeout = 5000) {
        if (editorEl && editorEl.focus) { try { editorEl.focus(); } catch (e) {} await sleep(300); }
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const btn = findSendBtn(editorEl);
            if (btn) { btn.click(); return true; }
            await sleep(200);
        }
        if (editorEl) { pressEnter(editorEl); return true; }
        return false;
    }

    function readLatest(selectors) {
        for (const sel of selectors) {
            const els = document.querySelectorAll(sel);
            if (!els.length) continue;
            const el = els[els.length - 1];
            const clone = el.cloneNode(true);
            clone.querySelectorAll('button, svg, [class*="copy"], [class*="download"], [class*="banner"], [class*="header"]').forEach(n => n.remove());

            const pres = [...clone.querySelectorAll('pre')];
            pres.forEach(pre => {
                const codeEl = pre.querySelector('code');
                let codeText = codeEl ? codeEl.innerText : pre.innerText;
                let lang = 'text';
                let parent = pre.parentElement;
                if (parent) {
                    const langMatch = parent.innerText.match(/^(python|javascript|java|cpp|c|go|rust|php|sql|html|css|bash|shell|json|typescript|ts|js)\b/i);
                    if (langMatch) lang = langMatch[1].toLowerCase();
                }
                if (lang === 'text') {
                    if (codeText.includes('print(') || codeText.includes('def ') || codeText.includes('import ')) lang = 'python';
                    else if (codeText.includes('function') || codeText.includes('const ') || codeText.includes('let ') || codeText.includes('console.log')) lang = 'javascript';
                    else if (codeText.includes('#include')) lang = 'cpp';
                    else if (codeText.includes('public class') || codeText.includes('public static void')) lang = 'java';
                    else if (codeText.includes('<html>') || codeText.includes('<div>')) lang = 'html';
                }
                const mdCode = `\n\`\`\`${lang}\n${codeText}\n\`\`\`\n`;
                pre.parentNode.replaceChild(document.createTextNode(mdCode), pre);
            });

            let t = (clone.innerText || '').trim()
                .replace(/\n?复制\n?下载\n?/g, '\n').replace(/\n?复制\n?/g, '\n').replace(/\n?下载\n?/g, '\n').replace(/\n{3,}/g, '\n\n');
            if (t) return t;
        }
        return '';
    }

    function extractImages(container) {
        if (!container) return [];
        const candidates = [];
        for (const img of container.querySelectorAll('img')) {
            if (!img.complete || img.naturalWidth < 80 || img.naturalHeight < 80) continue;
            const a = img.closest('a');
            const src = (a ? a.href : null) || img.getAttribute('data-src') || img.getAttribute('data-original') || img.currentSrc || img.src || '';
            if (!src || src.startsWith('blob:')) continue;
            if (src.startsWith('data:') && src.length < 500) continue;
            if (/avatar|icon|emoji|logo|badge|gift|skeleton|placeholder|loading|spinner/i.test(src)) continue;
            if (/avatar|icon|emoji|logo|badge/i.test(img.className || '')) continue;
            const r = img.getBoundingClientRect();
            if (r.width < 30 || r.height < 30) continue;
            candidates.push({ src, area: img.naturalWidth * img.naturalHeight, left: r.left, top: r.top, right: r.right, bottom: r.bottom });
        }
        const groups = [];
        for (const c of candidates) {
            let placed = false;
            for (const g of groups) {
                const ox = Math.max(0, Math.min(c.right, g.right) - Math.max(c.left, g.left));
                const oy = Math.max(0, Math.min(c.bottom, g.bottom) - Math.max(c.top, g.top));
                const minA = Math.min((c.right - c.left) * (c.bottom - c.top), (g.right - g.left) * (g.bottom - g.top));
                if (minA > 0 && ox * oy / minA > 0.5) {
                    if (c.area > g.area) { g.src = c.src; g.area = c.area; }
                    placed = true; break;
                }
            }
            if (!placed) groups.push({ src: c.src, area: c.area, left: c.left, top: c.top, right: c.right, bottom: c.bottom });
        }
        return groups.map(g => g.src);
    }

    function getReplyData() {
        let text = readLatest(isDoubao ? ['[data-testid="message_text_content"]', '[class*="message-content"]', '[class*="markdown-body"]'] : ['div[class*="ds-markdown"]', 'div[class*="markdown"]']);
        if (text && (text.includes('系统提示：当前是一个多AI群聊') || text.includes('User：'))) {
            return { text: '', images: [] };
        }
        let images = [];
        if (isDoubao) {
            const els = document.querySelectorAll('[data-testid="message_text_content"]');
            if (els.length) {
                let c = els[els.length - 1];
                for (let i = 0; i < 6 && c; i++) { images = extractImages(c); if (images.length) break; c = c.parentElement; }
            }
            if (!images.length) {
                const rows = document.querySelectorAll('[class*="message-row"], [class*="chat-message"], [class*="message"]');
                if (rows.length) images = extractImages(rows[rows.length - 1]);
            }
        } else {
            const els = document.querySelectorAll('div[class*="ds-markdown"]');
            if (els.length) images = extractImages(els[els.length - 1]);
        }
        return { text, images };
    }

    const getMyInputBox = () => isDoubao ? document.querySelector('div[contenteditable="true"]') || document.querySelector('textarea') : document.querySelector('textarea#chat-input') || document.querySelector('textarea');
    const GROUP_PROMPT = role => `系统提示：当前是一个多AI群聊，参与者有用户、豆包和DeepSeek。你现在是${role},请简短回复。\n\n`;

    function applyFontSize(size) {
        const el = document.getElementById('wechat-ai-ui');
        if (!el) return;
        const cfg = FONT_SIZES[size] || FONT_SIZES.medium;
        el.style.setProperty('--fs-base', cfg.base);
        el.style.setProperty('--fs-sm', cfg.sm);
        el.style.setProperty('--fs-xs', cfg.xs);
    }

    function applyTheme() {
        const el = document.getElementById('wechat-ai-ui');
        if (!el) return;
        const theme = GM_getValue(K.THEME, 'auto');
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        let isDark = false;
        if (theme === 'dark') isDark = true;
        else if (theme === 'auto') isDark = mq.matches;
        el.classList.toggle('dark', isDark);
        if (getThinking().active) setTimeout(() => startThinking(), 0);
    }

    function applyOpacity(val) {
        const el = document.getElementById('wechat-ai-ui');
        if (!el) return;
        const alpha = Math.max(0.3, Math.min(1, Number(val) / 100));
        el.style.setProperty('--ui-alpha', alpha);
        el.classList.toggle('wechat-ai-translucent', alpha < 1);
    }

    GM_addStyle(`
        #wechat-ai-ui {
            --fs-base: 13px;
            --fs-sm: 12px;
            --fs-xs: 11px;
            --ui-alpha: 1;

            --bg-main: transparent;
            --bg-dragbar: rgba(247,247,247, var(--ui-alpha));
            --bg-msg: rgba(245,245,245, var(--ui-alpha));
            --bg-input-area: rgba(255,255,255, var(--ui-alpha));
            --bg-bubble: #ffffff;
            --bg-bubble-user: #95ec69;
            --bg-bubble-ds: #e0eaff;
            --bg-settings: rgba(255,255,255, calc(0.6 + 0.4 * var(--ui-alpha)));
            --bg-control: rgba(0,0,0,0.045);
            --bg-control-active: #ffffff;
            --bg-hover: rgba(0,0,0,0.06);
            --bg-code-header: #2d2d2d;

            --text-main: #2a2a2a;
            --text-secondary: #666666;
            --text-tertiary: #999999;
            --text-bubble: #2a2a2a;
            --text-bubble-user: #111111;
            --text-bubble-ds: #1a2340;
            --text-placeholder: #c8c8c8;

            --border: rgba(0,0,0,0.055);
            --border-strong: rgba(0,0,0,0.09);

            --accent: #07c160;
            --accent-hover: #06ad56;
            --danger: #ff4d4f;

            --shadow: 0 10px 36px rgba(0,0,0,0.075), 0 2px 8px rgba(0,0,0,0.035);
            --shadow-control-active: 0 1px 3px rgba(0,0,0,0.08);
            --shadow-bubble: 0 1px 2px rgba(0,0,0,0.03);

            --think-light: #cccccc;
            --think-dark: #888888;

            position: fixed; right: 50px; bottom: 50px; width: 700px; height: 500px;
            background: var(--bg-main);
            border-radius: 10px; z-index: 99999; display: flex; flex-direction: column;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            font-size: var(--fs-base); color: var(--text-main);
            box-shadow: var(--shadow); overflow: hidden;
            transform: translateZ(0); border: 1px solid var(--border);
            -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
            isolation: isolate;
        }

        #wechat-ai-ui.wechat-ai-translucent {
            backdrop-filter: blur(24px) saturate(180%);
            -webkit-backdrop-filter: blur(24px) saturate(180%);
        }

        #wechat-ai-ui.dark {
            --bg-dragbar: rgba(28,28,28, var(--ui-alpha));
            --bg-msg: rgba(21,21,21, var(--ui-alpha));
            --bg-input-area: rgba(30,30,30, var(--ui-alpha));
            --bg-bubble: #242424;
            --bg-bubble-user: #07c160;
            --bg-bubble-ds: #2a3a55;
            --bg-settings: rgba(26,26,26, calc(0.6 + 0.4 * var(--ui-alpha)));
            --bg-control: rgba(255,255,255,0.06);
            --bg-control-active: #2e2e2e;
            --bg-hover: rgba(255,255,255,0.08);
            --bg-code-header: #1f1f1f;

            --text-main: #e2e2e2;
            --text-secondary: #9a9a9a;
            --text-tertiary: #666666;
            --text-bubble: #e2e2e2;
            --text-bubble-user: #000000;
            --text-bubble-ds: #c8d4e8;
            --text-placeholder: #555555;

            --border: rgba(255,255,255,0.055);
            --border-strong: rgba(255,255,255,0.1);

            --shadow: 0 10px 36px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.35);
            --shadow-control-active: 0 1px 3px rgba(0,0,0,0.45);
            --shadow-bubble: 0 1px 2px rgba(0,0,0,0.25);

            --think-light: #4d4d4d;
            --think-dark: #b0b0b0;
        }

        #wechat-ai-ui.wechat-ai-anim { transition: left 0.25s cubic-bezier(0.4,0,0.2,1), top 0.25s cubic-bezier(0.4,0,0.2,1), width 0.25s cubic-bezier(0.4,0,0.2,1), height 0.25s cubic-bezier(0.4,0,0.2,1), border-radius 0.25s cubic-bezier(0.4,0,0.2,1), background 0.25s cubic-bezier(0.4,0,0.2,1), box-shadow 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.25s; }
        #wechat-ai-ui.wechat-ai-gesture { will-change: left, top, width, height; }

        #wechat-ai-ui.wechat-ai-edge { overflow: visible !important; }
        #wechat-ai-edge-indicator { display: none; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); flex-direction: column; gap: 3px; align-items: center; justify-content: center; pointer-events: none; }
        #wechat-ai-edge-indicator span { width: 3px; height: 3px; border-radius: 50%; background: rgba(255,255,255,0.9); }

        .wechat-ai-edge .resize-handle { display: none !important; }
        .resize-handle { position: absolute; z-index: 250; }
        .rh-n { top: 0; left: 0; right: 0; height: 6px; cursor: n-resize; }
        .rh-s { bottom: 0; left: 0; right: 0; height: 6px; cursor: s-resize; }
        .rh-e { top: 0; bottom: 0; right: 0; width: 6px; cursor: e-resize; }
        .rh-w { top: 0; bottom: 0; left: 0; width: 6px; cursor: w-resize; }
        .rh-ne { top: 0; right: 0; width: 10px; height: 10px; cursor: ne-resize; }
        .rh-nw { top: 0; left: 0; width: 10px; height: 10px; cursor: nw-resize; }
        .rh-se { bottom: 0; right: 0; width: 10px; height: 10px; cursor: se-resize; }
        .rh-sw { bottom: 0; left: 0; width: 10px; height: 10px; cursor: sw-resize; }

        #wechat-ai-dragbar { height: 38px; background: var(--bg-dragbar); display: flex; align-items: center; justify-content: space-between; padding: 0 12px 0 16px; user-select: none; border-bottom: 1px solid var(--border); flex-shrink: 0; touch-action: none; transition: background 0.2s; position: relative; z-index: 210; }
        #wechat-ai-dragzone { flex: 1; text-align: center; pointer-events: auto; color: var(--text-main); font-weight: 500; position: relative; cursor: pointer; font-size: var(--fs-sm); letter-spacing: 0.3px; }
        #wechat-ai-dragzone::after { content: '爱聊 ${VERSION}'; position: absolute; top: 26px; left: 50%; transform: translateX(-50%) translateY(-10px); background: rgba(28,28,28,0.9); color: #fff; padding: 4px 8px; border-radius: 5px; font-size: var(--fs-xs); white-space: nowrap; pointer-events: none; opacity: 0; transition: all 0.2s ease; z-index: 300; box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
        #wechat-ai-dragzone:hover::after { opacity: 1; transform: translateX(-50%) translateY(0); }

        #wechat-ai-winbtns { display: flex; gap: 2px; position: relative; z-index: 211; }
        .wechat-ai-winbtn { position: relative; width: 36px; height: 28px; border: none; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; border-radius: 4px; transition: background 0.15s; padding: 0; }
        .wechat-ai-winbtn:hover { background: var(--bg-hover); }
        .wechat-ai-winbtn.close:hover { background: #e81123; }
        .wechat-ai-winbtn.close:hover svg { stroke: #fff; }
        .wechat-ai-winbtn svg { width: 12px; height: 12px; stroke: var(--text-secondary); stroke-width: 1.5; fill: none; transition: stroke 0.15s; }
        .wechat-ai-winbtn.close svg { width: 14px; height: 14px; }
        .wechat-ai-winbtn[data-tip]::after { content: attr(data-tip); position: absolute; top: 32px; left: 50%; transform: translateX(-50%) translateY(-10px); background: rgba(28,28,28,0.9); color: #fff; padding: 4px 8px; border-radius: 5px; font-size: var(--fs-xs); white-space: nowrap; pointer-events: none; opacity: 0; transition: all 0.2s ease; z-index: 300; box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
        .wechat-ai-winbtn[data-tip]:hover::after { opacity: 1; transform: translateX(-50%) translateY(0); }

        #wechat-ai-messages { flex: 1; overflow-y: auto; padding: 20px; background-color: var(--bg-msg); -webkit-overflow-scrolling: touch; display: flex; flex-direction: column; gap: 16px; position: relative; transition: background 0.2s; scroll-behavior: smooth; }
        #wechat-ai-messages::before {
            content: '';
            position: absolute;
            inset: 0;
            background-image: var(--bg-image, none);
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
            opacity: var(--ui-alpha);
            pointer-events: none;
            z-index: 0;
            transition: opacity 0.2s;
        }
        #wechat-ai-messages > .wechat-ai-row,
        #wechat-ai-messages > .wechat-ai-system,
        #wechat-ai-messages > #wechat-ai-thinking { position: relative; z-index: 1; }
        #wechat-ai-messages::-webkit-scrollbar { width: 6px; }
        #wechat-ai-messages::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 3px; }
        #wechat-ai-messages::-webkit-scrollbar-thumb:hover { background: var(--text-tertiary); }

        #wechat-ai-pc-refresh-tip { position: absolute; top: 0; left: 50%; transform: translateX(-50%) translateY(-40px); height: 28px; background: var(--accent); color: #fff !important; font-size: var(--fs-sm); display: flex; align-items: center; justify-content: center; padding: 0 16px; border-radius: 0 0 12px 12px; z-index: 15; font-weight: 500; box-shadow: 0 4px 12px rgba(7,193,96,0.28); transition: transform 0.25s cubic-bezier(0.4,0,0.2,1), background 0.2s; }
        #wechat-ai-pc-refresh-tip.show { transform: translateX(-50%) translateY(0); }
        #wechat-ai-pc-refresh-tip.loading { background: var(--bg-bubble); color: var(--accent) !important; border: 1px solid var(--accent); border-top: none; }

        .wechat-ai-row { display: flex; align-items: flex-start; gap: 10px; max-width: 85%; animation: wechat-ai-fadein 0.28s cubic-bezier(0.4,0,0.2,1); }
        @keyframes wechat-ai-fadein { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .wechat-ai-row.wechat-ai-right { flex-direction: row-reverse; align-self: flex-end; }

        .wechat-ai-avatar { width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0; background-size: cover; background-position: center; background-color: #ccc; display: flex; align-items: center; justify-content: center; font-size: var(--fs-base); color: #fff !important; font-weight: bold; cursor: pointer; position: relative; overflow: hidden; transition: transform 0.2s ease; }
        .wechat-ai-avatar:hover { transform: scale(1.05); }

        .wechat-ai-msg-content { display: flex; flex-direction: column; gap: 4px; max-width: calc(100% - 48px); }
        .wechat-ai-row.wechat-ai-right .wechat-ai-msg-content { align-items: flex-end; }

        .wechat-ai-bubble { padding: 10px 14px; border-radius: 8px; word-break: break-word; line-height: 1.55; font-size: var(--fs-base); color: var(--text-bubble); background: var(--bg-bubble); position: relative; box-shadow: var(--shadow-bubble); transition: background 0.2s, color 0.2s; }
        .wechat-ai-bubble > div { color: var(--text-bubble); }
        .wechat-ai-user .wechat-ai-bubble { background: var(--bg-bubble-user); color: var(--text-bubble-user); }
        .wechat-ai-user .wechat-ai-bubble > div { color: var(--text-bubble-user); }
        .wechat-ai-deepseek .wechat-ai-bubble { background: var(--bg-bubble-ds); color: var(--text-bubble-ds); }
        .wechat-ai-deepseek .wechat-ai-bubble > div { color: var(--text-bubble-ds); }

        .wechat-ai-image-only { background: transparent !important; padding: 0 !important; box-shadow: none !important; }
        .wechat-ai-bubble img.wechat-ai-img { display: block; max-width: 100%; max-height: 200px; height: auto; border-radius: 6px; cursor: zoom-in; transition: opacity 0.15s ease; }
        .wechat-ai-bubble img.wechat-ai-img:hover { opacity: 0.92; }
        .wechat-ai-bubble img.wechat-ai-img.wechat-ai-img-small { width: 100px !important; height: 100px !important; object-fit: cover; }

        .wechat-ai-system { text-align: center; font-size: var(--fs-xs); color: var(--text-tertiary); margin: 8px 0; align-self: center; padding: 4px 10px; background: var(--bg-control); border-radius: 10px; }
        .wechat-ai-think-info { font-size: var(--fs-xs); color: var(--text-tertiary); margin-bottom: 4px; padding-left: 2px; }

        #wechat-ai-thinking { display: none; margin-top: 4px; }
        .wechat-ai-thinking-text { font-size: var(--fs-base); font-weight: normal; padding-left: 2px; line-height: 1.55; margin-top: 4px; letter-spacing: 0.5px; display: flex; align-items: center; color: var(--text-secondary); }
        .wechat-ai-thinking-text .dot { margin: 0; transition: color 0.28s ease; }
        .wechat-ai-thinking-text .think-char { transition: color 0.28s ease; color: var(--think-light); }
        .wechat-ai-thinking-text .think-char.hi { color: var(--think-dark); }
        .wechat-ai-thinking-text .think-wave { color: var(--think-light); animation: wechat-ai-think-sweep 1.8s ease-in-out infinite; will-change: color; }
        @keyframes wechat-ai-think-sweep {
            0%, 100% { color: var(--think-light); }
            25%, 55% { color: var(--think-dark); }
        }

        #wechat-ai-input-area { background: var(--bg-input-area); border-top: 1px solid var(--border); display: flex; flex-direction: column; flex-shrink: 0; position: relative; transition: background 0.2s; }
        #wechat-ai-input-resize-handle { height: 6px; cursor: ns-resize; position: absolute; top: 0; left: 0; right: 0; z-index: 10; }
        #wechat-ai-toolbar { height: 40px; display: flex; align-items: center; padding: 0 16px; gap: 16px; border-bottom: 1px solid var(--border); }
        .wechat-ai-tool-btn { background: transparent; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 4px; border-radius: 5px; transition: background 0.15s ease; }
        .wechat-ai-tool-btn:hover { background: var(--bg-hover); }
        .wechat-ai-tool-btn svg { width: 20px; height: 20px; fill: none; stroke: none; }
        .wechat-ai-tool-btn svg path { stroke: var(--text-secondary); transition: stroke 0.15s; }
        .wechat-ai-tool-btn svg circle { transition: fill 0.15s; }
        .wechat-ai-tool-btn:hover svg path { stroke: var(--text-main); }
        .wechat-ai-tool-btn:hover svg circle { fill: var(--text-main); }

        #wechat-ai-input-wrap { flex: none; display: flex; flex-direction: column; padding: 8px 16px; height: 120px; position: relative; box-sizing: border-box; }
        #wechat-ai-input { flex: 1; border: none; outline: none; resize: none; font-size: var(--fs-base); color: var(--text-main); font-family: inherit; line-height: 1.55; background: transparent; width: 100%; overflow-y: auto; transition: color 0.2s; }
        #wechat-ai-input::placeholder { color: var(--text-placeholder); }
        #wechat-ai-input::-webkit-scrollbar { width: 6px; }
        #wechat-ai-input::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 3px; }

        #wechat-ai-send-wrap { display: flex; justify-content: flex-end; padding: 0 16px 12px 16px; }
        #wechat-ai-send { background: var(--bg-control); color: var(--text-tertiary); border: none; padding: 6px 20px; border-radius: 5px; font-size: var(--fs-base); cursor: default; transition: all 0.2s ease; font-family: inherit; }
        #wechat-ai-send.active { background: var(--accent); color: #fff !important; cursor: pointer; box-shadow: 0 2px 8px rgba(7,193,96,0.28); }
        #wechat-ai-send.active:hover { background: var(--accent-hover); }

        #wechat-ai-toggle { position: fixed; right: 20px; bottom: 20px; width: 44px; height: 44px; border-radius: 50%; background: var(--accent); color: #fff !important; border: none; font-size: 18px; z-index: 99999; cursor: pointer; display: none; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }

        #wechat-ai-bg-menu {
            position: fixed;
            background: rgba(255,255,255,0.55);
            backdrop-filter: blur(24px) saturate(180%);
            -webkit-backdrop-filter: blur(24px) saturate(180%);
            border-radius: 10px;
            box-shadow: 0 12px 32px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.06);
            padding: 4px;
            z-index: 100001;
            display: flex;
            flex-direction: column;
            gap: 1px;
            min-width: 100px;
            border: 1px solid rgba(255,255,255,0.55);
            animation: wechat-ai-menu-in 0.15s cubic-bezier(0.4,0,0.2,1);
        }
        #wechat-ai-bg-menu.dark {
            background: rgba(30,30,30,0.55);
            border-color: rgba(255,255,255,0.06);
            box-shadow: 0 12px 32px rgba(0,0,0,0.45), 0 1px 3px rgba(0,0,0,0.3);
        }
        #wechat-ai-bg-menu button { border: none; background: transparent; padding: 6px 10px; font-size: 12px; color: #2a2a2a; cursor: pointer; border-radius: 6px; text-align: left; font-family: inherit; transition: background 0.12s ease; white-space: nowrap; }
        #wechat-ai-bg-menu.dark button { color: #e2e2e2; }
        #wechat-ai-bg-menu button:hover { background: rgba(0,0,0,0.06); }
        #wechat-ai-bg-menu.dark button:hover { background: rgba(255,255,255,0.08); }
        @keyframes wechat-ai-menu-in {
            from { opacity: 0; transform: scale(0.96); }
            to { opacity: 1; transform: scale(1); }
        }
        #wechat-ai-bg-mask { position: fixed; left: 0; top: 0; right: 0; bottom: 0; background: transparent; z-index: 100000; }

        #wechat-ai-tooltip { display: none; position: absolute; background: rgba(28,28,28,0.9); color: #fff; padding: 6px 10px; border-radius: 6px; font-size: var(--fs-xs); white-space: nowrap; pointer-events: none; z-index: 50; top: 50%; transform: translateY(-50%); box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
        #wechat-ai-ui.wechat-ai-edge:hover #wechat-ai-tooltip { display: block; }

        #wechat-ai-snap-layouts { position: fixed; left: 50%; top: 12px; transform: translateX(-50%); background: rgba(28,28,30,0.78); border-radius: 12px; padding: 12px; display: none; gap: 16px; z-index: 999999; box-shadow: 0 12px 48px rgba(0,0,0,0.4); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,0.15); }

        .snap-group-wrap { position: relative; }
        .snap-group { width: 100px; height: 64px; display: flex; gap: 4px; background: rgba(0,0,0,0.2); padding: 4px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); cursor: pointer; transition: all 0.2s ease; }
        .snap-group-wrap:hover .snap-group { background: rgba(0,0,0,0.4); border-color: rgba(255,255,255,0.3); transform: scale(1.05); }

        .snap-zone { background: rgba(255,255,255,0.15); border-radius: 4px; transition: all 0.15s; height: 100%; }
        .snap-zone:hover { background: rgba(7,193,96,0.85); box-shadow: 0 0 12px rgba(7,193,96,0.5); }

        .snap-label { position: absolute; top: 110%; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.85); color: #fff; font-size: var(--fs-xs); padding: 4px 8px; border-radius: 5px; white-space: nowrap; pointer-events: none; opacity: 0; transition: opacity 0.2s; z-index: 10; border: 1px solid rgba(255,255,255,0.1); }
        .snap-group-wrap:hover .snap-label { opacity: 1; }

        .wechat-ai-code-block { margin: 8px 0; border-radius: 6px; overflow: hidden; background: #1e1e1e; border: 1px solid #333; }
        .wechat-ai-code-header { display: flex; justify-content: space-between; align-items: center; background: #2d2d2d; padding: 6px 12px; font-size: var(--fs-xs); color: #aaa !important; user-select: none; }
        .wechat-ai-code-copy { background: transparent; border: 1px solid #555; color: #ccc !important; border-radius: 4px; padding: 2px 8px; cursor: pointer; font-size: var(--fs-xs); font-family: inherit; transition: background 0.15s; }
        .wechat-ai-code-copy:hover { background: rgba(255,255,255,0.1); }
        .wechat-ai-code-block pre { margin: 0; padding: 12px; overflow-x: auto; }
        .wechat-ai-code-block code { font-family: Consolas, Monaco, monospace; font-size: calc(var(--fs-base) - 0.5px); background: transparent !important; padding: 0 !important; color: #d4d4d4 !important; }
        .wechat-ai-code-block .hljs-keyword, .wechat-ai-code-block .hljs-built_in, .wechat-ai-code-block .hljs-type, .wechat-ai-code-block .hljs-literal, .wechat-ai-code-block .hljs-number, .wechat-ai-code-block .hljs-regexp, .wechat-ai-code-block .hljs-symbol, .wechat-ai-code-block .hljs-bullet, .wechat-ai-code-block .hljs-link, .wechat-ai-code-block .hljs-meta { color: #ff7b72 !important; }
        .wechat-ai-code-block .hljs-title, .wechat-ai-code-block .hljs-section, .wechat-ai-code-block .hljs-title.function_, .wechat-ai-code-block .hljs-selector-id { color: #d2a8ff !important; }
        .wechat-ai-code-block .hljs-string, .wechat-ai-code-block .hljs-doctag, .wechat-ai-code-block .hljs-attr, .wechat-ai-code-block .hljs-attribute { color: #a5d6ff !important; }
        .wechat-ai-code-block .hljs-comment, .wechat-ai-code-block .hljs-quote { color: #8b949e !important; }
        .wechat-ai-code-block .hljs-variable, .wechat-ai-code-block .hljs-template-variable, .wechat-ai-code-block .hljs-selector-class, .wechat-ai-code-block .hljs-selector-attr, .wechat-ai-code-block .hljs-selector-pseudo { color: #ffa657 !important; }
        .wechat-ai-code-block .hljs-params { color: #c9d1d9 !important; }

        #wechat-ai-settings { position: absolute; top: 38px; left: 0; right: 0; bottom: 0; background: var(--bg-settings); z-index: 200; display: flex; flex-direction: column; transform: translateX(100%); transition: transform 0.3s cubic-bezier(0.4,0,0.2,1), background 0.2s; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
        #wechat-ai-settings.show { transform: translateX(0); }
        #wechat-ai-settings-header { height: 50px; display: flex; align-items: center; padding: 0 20px; border-bottom: 1px solid var(--border); font-size: var(--fs-base); font-weight: 500; color: var(--text-main); }
        #wechat-ai-settings-close { margin-left: auto; cursor: pointer; color: var(--text-tertiary); font-size: 20px; line-height: 1; transition: color 0.2s; }
        #wechat-ai-settings-close:hover { color: var(--text-main); }
        #wechat-ai-settings-content { flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 20px; }
        .settings-group { display: flex; flex-direction: column; gap: 10px; }
        .settings-group h4 { margin: 0; font-size: var(--fs-sm); color: var(--text-main); font-weight: 600; }
        .settings-group textarea { width: 100%; height: 110px; border: 1px solid var(--border-strong); background: var(--bg-control); border-radius: 6px; padding: 10px; font-family: monospace; font-size: var(--fs-sm); color: var(--text-main); resize: vertical; outline: none; box-sizing: border-box; transition: border 0.2s, background 0.2s; }
        .settings-group textarea:focus { border-color: var(--accent); background: var(--bg-input-area); }

        .segmented-control { display: flex; background: var(--bg-control); border-radius: 8px; padding: 3px; gap: 2px; }
        .segmented-control button { flex: 1; border: none; background: transparent; padding: 7px 10px; font-size: var(--fs-sm); color: var(--text-secondary); border-radius: 6px; cursor: pointer; font-family: inherit; transition: all 0.2s ease; }
        .segmented-control button:hover { color: var(--text-main); }
        .segmented-control button.active { background: var(--bg-control-active); color: var(--accent); box-shadow: var(--shadow-control-active); font-weight: 500; }

        .opacity-row { display: flex; align-items: center; gap: 12px; }
        .opacity-row input[type="range"] {
            flex: 1;
            -webkit-appearance: none;
            appearance: none;
            height: 4px;
            border-radius: 2px;
            background: var(--bg-control);
            outline: none;
            cursor: pointer;
        }
        .opacity-row input[type="range"]::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: var(--accent);
            cursor: pointer;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
            transition: transform 0.15s;
        }
        .opacity-row input[type="range"]::-webkit-slider-thumb:hover { transform: scale(1.15); }
        .opacity-row input[type="range"]::-moz-range-thumb {
            width: 16px; height: 16px; border: none; border-radius: 50%;
            background: var(--accent); cursor: pointer;
        }
        .opacity-row span { min-width: 42px; text-align: right; font-size: var(--fs-sm); color: var(--text-secondary); font-variant-numeric: tabular-nums; }

        .settings-btn { border: 1px solid var(--border-strong); background: var(--bg-control); color: var(--text-main); padding: 8px 16px; border-radius: 5px; font-size: var(--fs-base); cursor: pointer; transition: all 0.2s; font-family: inherit; }
        .settings-btn:hover { background: var(--bg-hover); }
        .settings-btn.primary { background: var(--accent); color: #fff !important; border-color: var(--accent); box-shadow: 0 2px 6px rgba(7,193,96,0.22); }
        .settings-btn.primary:hover { background: var(--accent-hover); }
        .settings-btn.danger { background: var(--danger); color: #fff !important; border-color: var(--danger); }
        .settings-btn.danger:hover { background: #e53935; }
        #wechat-ai-about { padding: 12px; background: var(--bg-control); border: 1px solid var(--border); border-radius: 6px; font-size: var(--fs-sm); color: var(--text-secondary); line-height: 1.6; cursor: pointer; user-select: none; transition: background 0.2s; }
        #wechat-ai-about:hover { background: var(--bg-hover); }

        #wechat-ai-toast { position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%) translateY(20px) scale(0.95); background: rgba(40,40,40,0.92); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); color: #fff; padding: 10px 20px; border-radius: 20px; font-size: var(--fs-sm); white-space: nowrap; opacity: 0; pointer-events: none; transition: all 0.3s cubic-bezier(0.4,0,0.2,1); z-index: 300; box-shadow: 0 4px 12px rgba(0,0,0,0.2); font-family: -apple-system, sans-serif; }
        #wechat-ai-toast.show { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
    `);

    if (!document.getElementById('wechat-ai-custom-style')) {
        const style = document.createElement('style');
        style.id = 'wechat-ai-custom-style';
        style.textContent = customCss;
        document.head.appendChild(style);
    }

    function readRect(el) { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; }
    function applyRect(el, r, animate) {
        if (!r) return;
        if (animate) {
            el.classList.add('wechat-ai-anim');
            setTimeout(() => el.classList.remove('wechat-ai-anim'), 300);
        }
        Object.assign(el.style, { right: 'auto', bottom: 'auto', maxWidth: 'none', maxHeight: 'none', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
        el.style.setProperty('border-radius', '10px', 'important');
    }

    function setInnerVisible(v) {
        const dragbar = document.getElementById('wechat-ai-dragbar');
        if (dragbar) dragbar.style.display = v ? 'flex' : 'none';
        ['wechat-ai-messages', 'wechat-ai-input-area'].forEach(id => {
            const el = document.getElementById(id); if (el) el.style.display = v ? 'flex' : 'none';
        });
    }

    function updateBtns() {
        const min = document.getElementById('btn-min'), max = document.getElementById('btn-max');
        if (!min || !max) return;
        min.setAttribute('data-tip', (state === 'min' || state === 'edge-l' || state === 'edge-r') ? '还原' : '最小化');
        max.setAttribute('data-tip', state === 'max' ? '向下还原' : '最大化');
    }

    const setState = next => { state = next; updateBtns(); };

    function computeSnap(left, width) {
        if (left < 15) return 'left';
        if (left + width > window.innerWidth - 15) return 'right';
        return null;
    }
    const clearSnapHints = el => el.classList.remove('wechat-ai-snap-left', 'wechat-ai-snap-right');

    function snapToEdge(el, side) {
        clearSnapHints(el);
        el.classList.add('wechat-ai-edge');
        el.classList.add(side === 'left' ? 'wechat-ai-snap-left' : 'wechat-ai-snap-right');
        setState(side === 'left' ? 'edge-l' : 'edge-r');

        const vh = window.innerHeight, h = 90, top = Math.max(20, (vh - h) / 2);
        el.classList.add('wechat-ai-anim');
        Object.assign(el.style, {
            width: '12px',
            top: top + 'px',
            height: h + 'px',
            background: '#5e5e5e',
            border: 'none',
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            maxWidth: 'none', maxHeight: 'none',
            cursor: 'pointer', touchAction: 'none', opacity: 1
        });
        el.style.setProperty('border-radius', side === 'left' ? '0 8px 8px 0' : '8px 0 0 8px', 'important');
        el.classList.remove('wechat-ai-translucent');

        if (side === 'left') {
            el.style.left = '0px'; el.style.right = 'auto';
            const tt = document.getElementById('wechat-ai-tooltip');
            if (tt) { tt.style.left = '20px'; tt.style.right = 'auto'; }
        } else {
            el.style.right = '0px'; el.style.left = 'auto';
            const tt = document.getElementById('wechat-ai-tooltip');
            if (tt) { tt.style.right = '20px'; tt.style.left = 'auto'; }
        }

        setInnerVisible(false);
        const indicator = document.getElementById('wechat-ai-edge-indicator');
        if (indicator) indicator.style.display = 'flex';
        setTimeout(() => el.classList.remove('wechat-ai-anim'), 300);
    }

    function restoreFromEdge(el, animate) {
        setInnerVisible(true);
        const indicator = document.getElementById('wechat-ai-edge-indicator');
        if (indicator) indicator.style.display = 'none';
        clearSnapHints(el);
        el.classList.remove('wechat-ai-edge');
        Object.assign(el.style, { background: '', border: '1px solid var(--border)', boxShadow: 'var(--shadow)', cursor: '', touchAction: '', opacity: 1 });
        setState('normal');
        applyOpacity(GM_getValue(K.OPACITY, 100));
        if (!savedRect) savedRect = { left: Math.max(0, window.innerWidth - 720), top: Math.max(0, window.innerHeight - 540), width: 700, height: 500 };
        if (animate) {
            el.classList.add('wechat-ai-anim');
            setTimeout(() => el.classList.remove('wechat-ai-anim'), 300);
        }
        applyRect(el, savedRect, false);
    }

    function toggleMin(el) {
        clearSnapHints(el);
        if (state === 'edge-l' || state === 'edge-r' || state === 'min') { restoreFromEdge(el, true); return; }
        if (state === 'normal') savedRect = readRect(el);
        snapToEdge(el, 'right');
    }

    function toggleMax(el) {
        clearSnapHints(el);
        if (state === 'edge-l' || state === 'edge-r') restoreFromEdge(el, false);
        if (state === 'max') { applyRect(el, savedRect, true); setState('normal'); return; }
        if (state === 'normal') savedRect = readRect(el);
        el.classList.add('wechat-ai-anim');
        Object.assign(el.style, { right: 'auto', bottom: 'auto', left: '0', top: '0', width: window.innerWidth + 'px', height: window.innerHeight + 'px', maxWidth: 'none', maxHeight: 'none' });
        el.style.setProperty('border-radius', '0px', 'important');
        setState('max'); setTimeout(() => el.classList.remove('wechat-ai-anim'), 300);
    }

    function getSnapRect(type) {
        const vw = window.innerWidth, vh = window.innerHeight;
        switch (type) {
            case 'left-half': return { left: 0, top: 0, width: vw / 2, height: vh };
            case 'right-half': return { left: vw / 2, top: 0, width: vw / 2, height: vh };
            case 'left-2-3': return { left: 0, top: 0, width: vw * 0.66, height: vh };
            case 'right-1-3': return { left: vw * 0.66, top: 0, width: vw * 0.34, height: vh };
            case 'left-1-3': return { left: 0, top: 0, width: vw * 0.34, height: vh };
            case 'right-2-3': return { left: vw * 0.34, top: 0, width: vw * 0.66, height: vh };
        }
        return null;
    }

    function setupSnapLayouts(panel) {
        const layouts = document.getElementById('wechat-ai-snap-layouts');
        if (!layouts) return;
        panel._showLayouts = () => { if (state !== 'max' && state !== 'edge-l' && state !== 'edge-r') layouts.style.display = 'flex'; };
        panel._hideLayouts = () => { layouts.style.display = 'none'; };
    }

    function bindGesture(handle, panel, handlers) {
        let active = false, lastX = 0, lastY = 0, rafPending = false;
        const flushMove = () => { rafPending = false; if (active) handlers.move(lastX, lastY); };
        const onMove = (x, y) => { lastX = x; lastY = y; if (!rafPending && active) { rafPending = true; requestAnimationFrame(flushMove); } };
        const down = (x, y) => { if (handlers.start(x, y) === false) return; active = true; lastX = x; lastY = y; panel.classList.add('wechat-ai-gesture'); };
        const up = (e) => { if (!active) return; if (rafPending) { cancelAnimationFrame(flushMove); flushMove(); } active = false; panel.classList.remove('wechat-ai-gesture'); clearSnapHints(panel); if (handlers.end) handlers.end(e); };
        handle.addEventListener('mousedown', e => { down(e.clientX, e.clientY); });
        document.addEventListener('mousemove', e => { if (active) onMove(e.clientX, e.clientY); });
        document.addEventListener('mouseup', up);
    }

    function toggleSettings(force) {
        const settings = document.getElementById('wechat-ai-settings');
        if (!settings) return;
        const isHidden = !settings.classList.contains('show');
        const shouldShow = force === undefined ? isHidden : force;
        if (shouldShow) {
            settings.classList.add('show');
            const cssInput = document.getElementById('wechat-ai-custom-css');
            if (cssInput) cssInput.value = customCss;
        } else {
            settings.classList.remove('show');
        }
    }

    function enableDrag(el, handle) {
        let sx = 0, sy = 0, sl = 0, st = 0, w0 = 0;
        let clickStart = 0, startX = 0, startY = 0, moved = false;
        let wasMax = false;
        bindGesture(handle, el, {
            start(x, y) {
                clickStart = Date.now();
                startX = x; startY = y; moved = false;
                wasMax = (state === 'max');
                clearSnapHints(el);
                if (state === 'edge-l' || state === 'edge-r') restoreFromEdge(el, false);
                const r = readRect(el);
                sx = x; sy = y; sl = r.left; st = r.top; w0 = r.width;
                if (state === 'normal') savedRect = { left: r.left, top: r.top, width: r.width, height: r.height };
                el.classList.remove('wechat-ai-anim');
                Object.assign(el.style, { right: 'auto', bottom: 'auto', left: sl + 'px', top: st + 'px' });
                el.style.setProperty('border-radius', '10px', 'important');
            },
            move(x, y) {
                if (Math.abs(x - startX) > 5 || Math.abs(y - startY) > 5) {
                    if (!moved && wasMax) {
                        setState('normal');
                        applyRect(el, savedRect, false);
                        sl = savedRect.left; st = savedRect.top; w0 = savedRect.width;
                        sx = x; sy = y;
                    }
                    moved = true;
                }
                let nl = sl + (x - sx), nt = st + (y - sy);

                if (moved) {
                    if (nl <= 0) { snapToEdge(el, 'left'); return; }
                    if (nl + w0 >= window.innerWidth) { snapToEdge(el, 'right'); return; }
                }

                nl = Math.max(-w0, Math.min(window.innerWidth, nl));
                nt = Math.max(0, Math.min(window.innerHeight - 28, nt));
                el.style.left = nl + 'px'; el.style.top = nt + 'px';

                if (nt <= 30 && el._showLayouts) el._showLayouts();
                else if (nt > 60 && el._hideLayouts) el._hideLayouts();

                const hint = computeSnap(nl, w0);
                el.classList.toggle('wechat-ai-snap-left', hint === 'left');
                el.classList.toggle('wechat-ai-snap-right', hint === 'right');
            },
            end(e) {
                if (state === 'edge-l' || state === 'edge-r') return;

                let isInLayout = false, snapType = null;
                const layouts = document.getElementById('wechat-ai-snap-layouts');
                if (layouts && layouts.style.display === 'flex') {
                    const x = e.clientX, y = e.clientY;
                    const rect = layouts.getBoundingClientRect();
                    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                        const target = document.elementFromPoint(x, y);
                        const zone = target ? target.closest('.snap-zone') : null;
                        if (zone) { snapType = zone.dataset.snap; isInLayout = true; }
                    }
                    if (el._hideLayouts) el._hideLayouts();
                }
                if (isInLayout && snapType) {
                    const r = getSnapRect(snapType);
                    if (r) { applyRect(el, r, true); savedRect = Object.assign({}, r); setState('normal'); return; }
                }
                const r = readRect(el), side = computeSnap(r.left, r.width);
                if (side) return snapToEdge(el, side);

                if (state === 'normal') {
                    const w = r.width; let fl = r.left;
                    if (fl < 0) fl = 0;
                    if (fl + w > window.innerWidth) fl = Math.max(0, window.innerWidth - w);
                    if (fl !== r.left) el.style.left = fl + 'px';
                    if (savedRect) { savedRect.left = fl; savedRect.top = r.top; }
                }

                if (!moved && Date.now() - clickStart < 300) {
                    const target = e.target;
                    if (target.closest('.wechat-ai-winbtn')) return;

                    if (target.closest('#wechat-ai-dragzone')) {
                        toggleSettings();
                        return;
                    }

                    if (state === 'max') { applyRect(el, savedRect, true); setState('normal'); }
                    else if (state === 'edge-l' || state === 'edge-r') restoreFromEdge(el, true);
                }
            }
        });
        handle.addEventListener('dblclick', e => {
            if (e.target.closest('#wechat-ai-dragzone')) return;
            e.preventDefault();
            toggleMax(el);
        });
        el.addEventListener('click', e => {
            if (state === 'edge-l' || state === 'edge-r') { e.preventDefault(); e.stopPropagation(); restoreFromEdge(el, true); }
        }, true);
    }

    function enableResize(el, handle) {
        const dir = handle.dataset.dir;
        let sx = 0, sy = 0, sw = 0, sh = 0, sl = 0, st = 0;
        bindGesture(handle, el, {
            start(x, y) {
                if (state === 'edge-l' || state === 'edge-r') return false;
                if (state === 'max') setState('normal');
                if (state === 'min') return false;
                const r = readRect(el);
                sx = x; sy = y; sw = r.width; sh = r.height; sl = r.left; st = r.top;
                savedRect = { left: r.left, top: r.top, width: r.width, height: r.height };
                el.classList.remove('wechat-ai-anim');
            },
            move(x, y) {
                const dx = x - sx, dy = y - sy;
                let newW = sw, newH = sh, newL = sl, newT = st;
                const minW = 400, minH = 300;
                if (dir.includes('e')) newW = Math.max(minW, sw + dx);
                if (dir.includes('w')) { newW = Math.max(minW, sw - dx); newL = sl + sw - newW; }
                if (dir.includes('s')) newH = Math.max(minH, sh + dy);
                if (dir.includes('n')) { newH = Math.max(minH, sh - dy); newT = st + sh - newH; }
                Object.assign(el.style, { left: newL + 'px', top: newT + 'px', width: newW + 'px', height: newH + 'px', maxWidth: 'none', maxHeight: 'none' });
                if (savedRect) { savedRect.left = newL; savedRect.top = newT; savedRect.width = newW; savedRect.height = newH; }
            },
            end() {}
        });
    }

    function enableInputResize(handle, inputWrap) {
        let startY = 0, startH = 0, isDragging = false;
        handle.addEventListener('mousedown', e => {
            isDragging = true; startY = e.clientY; startH = inputWrap.offsetHeight;
            document.body.style.cursor = 'ns-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });
        document.addEventListener('mousemove', e => {
            if (!isDragging) return;
            const dy = startY - e.clientY;
            const newH = Math.max(80, Math.min(window.innerHeight - 200, startH + dy));
            inputWrap.style.setProperty('height', newH + 'px', 'important');
        });
        document.addEventListener('mouseup', () => {
            if (isDragging) { isDragging = false; document.body.style.cursor = ''; document.body.style.userSelect = ''; }
        });
    }

    function fallbackCopy(text, btn) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed'; ta.style.top = '-9999px'; ta.style.left = '-9999px';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); btn.textContent = '已复制'; } catch (err) { btn.textContent = '失败'; }
        ta.remove();
        setTimeout(() => btn.textContent = '复制', 2000);
    }

    function openImageFull(src) {
        const w = window.open('');
        if (w) {
            w.document.write('<html><head><title>查看图片</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;min-height:100vh;"><img src="' + src + '" style="max-width:100%;max-height:100vh;"></body></html>');
            w.document.close();
        }
    }

    function renderMarkdownContent(container, text) {
        const codeBlockRegex = /```(\w*)\n([\s\S]*?)(?:```|$)/g;
        let lastIndex = 0, match, hasCode = false;
        while ((match = codeBlockRegex.exec(text)) !== null) {
            hasCode = true;
            const textBefore = text.slice(lastIndex, match.index);
            if (textBefore.trim()) {
                const p = document.createElement('div');
                p.style.whiteSpace = 'pre-wrap'; p.textContent = textBefore;
                container.appendChild(p);
            }
            const lang = match[1] || 'text';
            const code = match[2].replace(/\n$/, '');
            const block = document.createElement('div'); block.className = 'wechat-ai-code-block';
            const header = document.createElement('div'); header.className = 'wechat-ai-code-header';
            const langSpan = document.createElement('span'); langSpan.className = 'wechat-ai-code-lang'; langSpan.textContent = lang;
            const copyBtn = document.createElement('button'); copyBtn.className = 'wechat-ai-code-copy'; copyBtn.textContent = '复制';
            copyBtn.addEventListener('click', (e) => {
                e.preventDefault(); e.stopPropagation();
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(code).then(() => {
                        copyBtn.textContent = '已复制'; setTimeout(() => copyBtn.textContent = '复制', 2000);
                    }).catch(() => fallbackCopy(code, copyBtn));
                } else { fallbackCopy(code, copyBtn); }
            });
            header.appendChild(langSpan); header.appendChild(copyBtn);
            const pre = document.createElement('pre');
            const codeEl = document.createElement('code');
            codeEl.className = `language-${lang}`; codeEl.textContent = code;
            pre.appendChild(codeEl);
            block.appendChild(header); block.appendChild(pre);
            container.appendChild(block);
            if (window.hljs) { try { window.hljs.highlightElement(codeEl); } catch (e) {} }
            lastIndex = match.index + match[0].length;
        }
        const textAfter = text.slice(lastIndex);
        if (textAfter.trim() || !hasCode) {
            const p = document.createElement('div');
            p.style.whiteSpace = 'pre-wrap'; p.textContent = textAfter || text;
            container.appendChild(p);
        }
    }

    function renderMessage(msg) {
        const c = document.getElementById('wechat-ai-messages');
        if (!c) return;
        const { who, text, images, thinkingMs } = msg;
        if (who === 'system') {
            const s = document.createElement('div'); s.className = 'wechat-ai-system'; s.textContent = text; c.appendChild(s); c.scrollTop = c.scrollHeight; return;
        }
        const cfg = AVATARS[who] || AVATARS.doubao;
        const row = document.createElement('div'); row.className = 'wechat-ai-row wechat-ai-' + who + (who === 'user' ? ' wechat-ai-right' : '');
        const av = document.createElement('div'); av.className = 'wechat-ai-avatar';
        if (cfg.img) av.style.backgroundImage = `url("${cfg.img}")`;
        else { av.style.backgroundColor = cfg.bg; av.textContent = cfg.text; }
        av.addEventListener('click', () => pickAvatar(who, av));

        const contentWrap = document.createElement('div'); contentWrap.className = 'wechat-ai-msg-content';

        if (thinkingMs > 0) {
            const info = document.createElement('div'); info.className = 'wechat-ai-think-info';
            info.textContent = '已思考，用时 ' + Math.round(thinkingMs / 1000) + ' 秒';
            contentWrap.appendChild(info);
        }

        const b = document.createElement('div'); b.className = 'wechat-ai-bubble';

        const cleanText = (text || '').replace(/\n{3,}/g, '\n\n').trim();
        const uniq = [];
        if (images && images.length) { const seenImg = {}; for (const s of images) if (!seenImg[s]) { seenImg[s] = true; uniq.push(loadImage(s) || s); } }
        const hasText = cleanText.length > 0, hasImages = uniq.length > 0;
        if (!hasText && hasImages) b.classList.add('wechat-ai-image-only');

        if (hasText) renderMarkdownContent(b, cleanText);
        if (hasImages) {
            for (const src of uniq) {
                const img = document.createElement('img');
                img.className = 'wechat-ai-img' + (who === 'user' ? ' wechat-ai-img-small' : '');
                img.src = src;
                img.addEventListener('click', e => { e.stopPropagation(); openImageFull(src); });
                img.onload = () => { c.scrollTop = c.scrollHeight; };
                img.onerror = () => img.remove();
                b.appendChild(img);
            }
        }
        contentWrap.appendChild(b);
        row.appendChild(av); row.appendChild(contentWrap); c.appendChild(row); c.scrollTop = c.scrollHeight;
    }

    function flush() {
        const c = document.getElementById('wechat-ai-messages'), msgs = getMessages();
        if (!c) return;
        const currentJson = JSON.stringify(msgs);
        if (msgs.length < rendered) {
            [...c.children].forEach(child => {
                if (child.id !== 'wechat-ai-thinking' && child.id !== 'wechat-ai-pc-refresh-tip') child.remove();
            });
            rendered = 0; lastMsgJson = '';
        }
        if (msgs.length > rendered || (msgs.length > 0 && currentJson !== lastMsgJson)) {
            if (msgs.length === rendered && msgs.length > 0) {
                const lastRow = c.querySelector('.wechat-ai-row:last-child');
                if (lastRow && lastRow.id !== 'wechat-ai-thinking') { lastRow.remove(); rendered--; }
            }
            for (let i = rendered; i < msgs.length; i++) renderMessage(msgs[i]);
            rendered = msgs.length;
            lastMsgJson = currentJson;
        }

        const thinking = document.getElementById('wechat-ai-thinking');
        if (thinking) {
            if (!getThinking().active) { if (thinking.style.display !== 'none') stopThinking(); }
            else {
                const lastEl = c.lastElementChild;
                if (lastEl !== thinking && lastEl?.id !== 'wechat-ai-pc-refresh-tip') {
                    c.appendChild(thinking);
                    c.scrollTop = c.scrollHeight;
                }
            }
        }
    }

    function startThinking() {
        stopThinking();
        const el = document.getElementById('wechat-ai-thinking');
        if (!el) return;
        el.style.display = 'flex';
        el.className = 'wechat-ai-row wechat-ai-' + myRole;
        const av = el.querySelector('.wechat-ai-avatar');
        if (av) av.style.backgroundImage = `url("${AVATARS[myRole].img}")`;

        const textEl = el.querySelector('.wechat-ai-thinking-text');
        if (!textEl) return;

        if (isDoubao) {
            textEl.innerHTML = '<span class="dot think-char">·</span><span class="dot think-char">·</span><span class="dot think-char">·</span>';
            textEl.style.fontSize = '20px';
            textEl.style.lineHeight = '1';
            textEl.style.letterSpacing = '2px';
            const dots = textEl.querySelectorAll('.dot');
            const frames = [
                [0, 0, 0], [1, 0, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1], [0, 0, 1]
            ];
            let frame = 0;
            const updateColors = () => {
                frames[frame].forEach((hi, i) => {
                    if (dots[i]) dots[i].classList.toggle('hi', !!hi);
                });
            };
            updateColors();
            thinkingTimer = setInterval(() => {
                frame = (frame + 1) % 6;
                updateColors();
            }, 300);
        } else {
            textEl.style.fontSize = '';
            textEl.style.lineHeight = '';
            textEl.style.letterSpacing = '';
            const chars = '深度思考中'.split('');
            textEl.innerHTML = chars.map((ch, i) =>
                `<span class="think-wave" style="animation-delay:-${(i * 0.18).toFixed(2)}s">${ch}</span>`
            ).join('');
        }
    }

    function stopThinking() {
        if (thinkingTimer) { clearInterval(thinkingTimer); thinkingTimer = null; }
        const el = document.getElementById('wechat-ai-thinking');
        if (el) el.style.display = 'none';
    }

    function checkThinking() {
        const t = getThinking();
        if (t.active) {
            const msgs = getMessages();
            if (Date.now() - t.startTime > 90000 || msgs.length === 0) {
                setThinking({ active: false, duration: 0 });
                lastThinkingKey = '';
                stopThinking();
                return;
            }
            const key = String(t.startTime);
            if (lastThinkingKey !== key) { lastThinkingKey = key; startThinking(); }
        } else if (lastThinkingKey) { lastThinkingKey = ''; stopThinking(); }
    }

    function markThinkingStart() {
        const cur = getThinking();
        if (cur.active) return;
        setThinking({ active: true, startTime: Date.now(), duration: 0 });
        lastThinkingKey = '';
        lastKey = '';
        stable = 0;
        startThinking();
        const c = document.getElementById('wechat-ai-messages');
        const el = document.getElementById('wechat-ai-thinking');
        if (c && el) {
            c.appendChild(el);
            c.scrollTop = c.scrollHeight;
        }
    }

    function clearChat(silent) {
        GM_setValue(K.MSGS, '[]');
        GM_setValue(K.USER, '');
        GM_setValue(K.TASK, '');
        GM_setValue(K.REPLY, '');
        GM_setValue(K.SESS, '');
        GM_setValue(K.THINKING, '');
        rendered = 0; lastMsgJson = '';
        const c = document.getElementById('wechat-ai-messages');
        if (c) {
            [...c.children].forEach(child => {
                if (child.id !== 'wechat-ai-thinking' && child.id !== 'wechat-ai-pc-refresh-tip') child.remove();
            });
        }
        stopThinking();
        lastThinkingKey = '';
        lastUserTs = 0; lastTaskTs = 0; lastReplyTs = 0;
        seen.clear(); lastKey = ''; stable = 0;
        if (!silent) { pushMessage('system', 'CLEAR_ALL'); flush(); }
    }

    async function sendUserMessage() {
        const inp = document.getElementById('wechat-ai-input'); const text = inp.value.trim();
        if (!text) return;
        inp.value = '';
        const wrap = document.getElementById('wechat-ai-input-wrap');
        if (wrap) wrap.style.setProperty('height', '120px', 'important');

        const sendBtn = document.getElementById('wechat-ai-send');
        sendBtn.classList.remove('active');
        const old = getSession();
        if (old.active && old.round > 0) { pushMessage('system', '上轮对话未结束，已重置为新对话'); flush(); }
        resetSession();
        setThinking({ active: false, duration: 0 });
        lastThinkingKey = '';
        stopThinking();
        pushMessage('user', text); flush();
        markThinkingStart();
        GM_setValue(K.USER, JSON.stringify({ text, ts: Date.now(), source: myRole }));
    }

    function showToast(text) {
        let toast = document.getElementById('wechat-ai-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'wechat-ai-toast';
            const ui = document.getElementById('wechat-ai-ui');
            if (ui) ui.appendChild(toast);
        }
        toast.textContent = text;
        toast.classList.add('show');
        if (toast._timer) clearTimeout(toast._timer);
        toast._timer = setTimeout(() => toast.classList.remove('show'), 2500);
    }

    function showBgMenu(x, y) {
        ['wechat-ai-bg-mask', 'wechat-ai-bg-menu'].forEach(id => { const el = document.getElementById(id); if (el) el.remove(); });
        const mask = document.createElement('div'); mask.id = 'wechat-ai-bg-mask'; document.body.appendChild(mask);
        const menu = document.createElement('div'); menu.id = 'wechat-ai-bg-menu';
        const ui = document.getElementById('wechat-ai-ui');
        if (ui && ui.classList.contains('dark')) menu.classList.add('dark');
        menu.innerHTML = '<button data-action="change">更换背景</button><button data-action="clear">恢复背景</button><button data-action="clear-chat" style="color:#e53935 !important;">清空对话</button><button data-action="cancel">取消操作</button>';

        menu.style.left = Math.min(window.innerWidth - 120, Math.max(10, x)) + 'px';
        menu.style.top = Math.min(window.innerHeight - 140, Math.max(10, y)) + 'px';

        document.body.appendChild(menu);
        const close = () => { mask.remove(); menu.remove(); };
        mask.addEventListener('click', close);
        menu.addEventListener('click', e => {
            const btn = e.target.closest('button'); if (!btn) return;
            const action = btn.getAttribute('data-action'); close();
            if (action === 'change') pickBackground();
            else if (action === 'clear') { setChatBg(''); GM_setValue(K.BG, ''); }
            else if (action === 'clear-chat') { clearChat(); GM_setValue(K.CMD_CLEAR, Date.now()); }
        });
    }

    function setupBgPicker() {
        const el = document.getElementById('wechat-ai-messages'); if (!el) return;
        const saved = GM_getValue(K.BG); if (saved) setChatBg(saved);

        el.addEventListener('contextmenu', e => {
            if (e.target.closest('.wechat-ai-avatar') || e.target.closest('.wechat-ai-bubble') || e.target.id === 'wechat-ai-pc-refresh-tip') return;
            e.preventDefault();
            showBgMenu(e.clientX, e.clientY);
        });
    }

    function setupScrollRefresh() {
        const scroller = document.getElementById('wechat-ai-messages');
        const tip = document.getElementById('wechat-ai-pc-refresh-tip');
        if (!scroller || !tip) return;

        let refreshing = false, scrollAccum = 0, timer = null;

        scroller.addEventListener('wheel', e => {
            if (refreshing) return;
            if (scroller.scrollTop <= 0 && e.deltaY < 0) {
                if (e.cancelable) e.preventDefault();
                scrollAccum -= e.deltaY;

                if (scrollAccum > 60) {
                    tip.classList.add('show');
                    tip.classList.remove('loading');
                    if (scrollAccum > 150) tip.textContent = '松开进行刷新';
                    else tip.textContent = '继续上滑刷新';
                }

                if (timer) clearTimeout(timer);
                timer = setTimeout(() => {
                    if (scrollAccum > 150) {
                        refreshing = true;
                        tip.textContent = '正在刷新';
                        tip.classList.add('loading');
                        GM_setValue('wechat_ai_cmd_reload', Date.now());
                        setTimeout(() => { try { location.reload(); } catch (e) {} }, 800);
                    } else {
                        scrollAccum = 0;
                        tip.classList.remove('show');
                    }
                }, 300);
            } else {
                if (!refreshing) {
                    scrollAccum = 0;
                    tip.classList.remove('show');
                }
            }
        }, { passive: false });
    }

    function createUI() {
        if (document.getElementById('wechat-ai-ui')) return;

        const style = document.createElement('style');
        style.id = 'wechat-ai-custom-style';
        style.textContent = customCss;
        document.head.appendChild(style);

        const div = document.createElement('div'); div.id = 'wechat-ai-ui';
        div.innerHTML = `
            <div id="wechat-ai-dragbar">
                <div style="width: 100px;"></div>
                <div id="wechat-ai-dragzone">爱聊</div>
                <div id="wechat-ai-winbtns">
                    <button class="wechat-ai-winbtn" id="btn-min" data-tip="最小化">
                        <svg viewBox="0 0 24 24"><path d="M4 12h16"/></svg>
                    </button>
                    <button class="wechat-ai-winbtn" id="btn-max" data-tip="最大化">
                        <svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16"/></svg>
                    </button>
                    <button class="wechat-ai-winbtn close" id="btn-close" data-tip="关闭">
                        <svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                </div>
            </div>
            <div id="wechat-ai-messages">
                <div id="wechat-ai-pc-refresh-tip">上滑刷新</div>
                <div id="wechat-ai-thinking" class="wechat-ai-row wechat-ai-${myRole}">
                    <div class="wechat-ai-avatar" style="background-image: url('${AVATARS[myRole].img}'); background-color: transparent;"></div>
                    <div class="wechat-ai-msg-content">
                        <div class="wechat-ai-thinking-text"></div>
                    </div>
                </div>
            </div>
            <div id="wechat-ai-input-area">
                <div id="wechat-ai-input-resize-handle"></div>
                <div id="wechat-ai-toolbar">
                    <button class="wechat-ai-tool-btn">
                        <svg viewBox="0 0 24 24"><path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke-width="1.5" fill="none"/><path d="M8 14C8 14 9.5 16 12 16C14.5 16 16 14 16 14" stroke-width="1.5" stroke-linecap="round"/><circle cx="9" cy="9" r="1" fill="#666"/><circle cx="15" cy="9" r="1" fill="#666"/></svg>
                    </button>
                    <button class="wechat-ai-tool-btn" id="btn-pick-img">
                        <svg viewBox="0 0 24 24"><path d="M21 19V5C21 3.89543 20.1046 3 19 3H5C3.89543 3 3 3.89543 3 5V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19Z" stroke-width="1.5" fill="none"/><path d="M3 16L8 11L13 16" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M13 13L16 10L21 15" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </button>
                    <button class="wechat-ai-tool-btn">
                        <svg viewBox="0 0 24 24"><path d="M14 4L18 8L8 18H4V14L14 4Z" stroke-width="1.5" fill="none"/></svg>
                    </button>
                    <button class="wechat-ai-tool-btn">
                        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-width="1.5" fill="none"/><circle cx="8" cy="12" r="1" fill="#666"/><circle cx="12" cy="12" r="1" fill="#666"/><circle cx="16" cy="12" r="1" fill="#666"/></svg>
                    </button>
                </div>
                <div id="wechat-ai-input-wrap" style="height: 120px;">
                    <textarea id="wechat-ai-input" placeholder=""></textarea>
                </div>
                <div id="wechat-ai-send-wrap">
                    <button id="wechat-ai-send">发送(S)</button>
                </div>
            </div>
            <div id="wechat-ai-settings">
                <div id="wechat-ai-settings-header">
                    设置 <span id="wechat-ai-settings-close">×</span>
                </div>
                <div id="wechat-ai-settings-content">
                    <div class="settings-group">
                        <h4>字号</h4>
                        <div class="segmented-control" id="wechat-ai-fontsize-group">
                            <button data-value="small">小</button>
                            <button data-value="medium">中</button>
                            <button data-value="large">大</button>
                        </div>
                    </div>
                    <div class="settings-group">
                        <h4>主题</h4>
                        <div class="segmented-control" id="wechat-ai-theme-group">
                            <button data-value="light">亮色</button>
                            <button data-value="dark">暗色</button>
                            <button data-value="auto">跟随系统</button>
                        </div>
                    </div>
                    <div class="settings-group">
                        <h4>窗口透明度</h4>
                        <div class="opacity-row">
                            <input type="range" min="30" max="100" step="1" id="wechat-ai-opacity">
                            <span id="wechat-ai-opacity-val">100%</span>
                        </div>
                    </div>
                    <div class="settings-group">
                        <h4>自定义CSS窗口样式</h4>
                        <textarea id="wechat-ai-custom-css" placeholder="输入css..."></textarea>
                        <div style="display:flex; gap:10px; flex-wrap:wrap;">
                            <button class="settings-btn primary" id="wechat-ai-save-css">应用并保存</button>
                            <button class="settings-btn" id="wechat-ai-import-css">从本地导入CSS</button>
                        </div>
                    </div>
                    <div class="settings-group">
                        <h4>对话数据</h4>
                        <button class="settings-btn danger" id="wechat-ai-clear-all">清空全部对话记录</button>
                    </div>
                    <div class="settings-group">
                        <h4>关于</h4>
                        <div id="wechat-ai-about">
                            爱聊 (v${VERSION})<br>
                            将豆包与 DeepSeek 网页版接入同一个群聊。<br>
                            点击标题栏"爱聊"打开/关闭此设置页。
                        </div>
                    </div>
                </div>
                <div id="wechat-ai-toast"></div>
            </div>
            <div id="wechat-ai-tooltip">Alt + w 召出</div>
            <div id="wechat-ai-edge-indicator"><span></span><span></span><span></span></div>
            <div class="resize-handle rh-n" data-dir="n"></div>
            <div class="resize-handle rh-s" data-dir="s"></div>
            <div class="resize-handle rh-e" data-dir="e"></div>
            <div class="resize-handle rh-w" data-dir="w"></div>
            <div class="resize-handle rh-ne" data-dir="ne"></div>
            <div class="resize-handle rh-nw" data-dir="nw"></div>
            <div class="resize-handle rh-se" data-dir="se"></div>
            <div class="resize-handle rh-sw" data-dir="sw"></div>
        `;
        document.body.appendChild(div);

        const layouts = document.createElement('div');
        layouts.id = 'wechat-ai-snap-layouts';
        layouts.innerHTML = `
            <div class="snap-group-wrap">
                <div class="snap-group">
                    <div class="snap-zone" style="width:calc(50% - 2px);" data-snap="left-half"></div>
                    <div class="snap-zone" style="width:calc(50% - 2px);" data-snap="right-half"></div>
                </div>
                <div class="snap-label">左右平分</div>
            </div>
            <div class="snap-group-wrap">
                <div class="snap-group">
                    <div class="snap-zone" style="width:calc(66.6% - 2px);" data-snap="left-2-3"></div>
                    <div class="snap-zone" style="width:calc(33.3% - 2px);" data-snap="right-1-3"></div>
                </div>
                <div class="snap-label">左宽右窄</div>
            </div>
            <div class="snap-group-wrap">
                <div class="snap-group">
                    <div class="snap-zone" style="width:calc(33.3% - 2px);" data-snap="left-1-3"></div>
                    <div class="snap-zone" style="width:calc(66.6% - 2px);" data-snap="right-2-3"></div>
                </div>
                <div class="snap-label">左窄右宽</div>
            </div>
        `;
        document.body.appendChild(layouts);

        const toggle = document.createElement('button'); toggle.id = 'wechat-ai-toggle'; toggle.textContent = '💬'; document.body.appendChild(toggle);
        toggle.onclick = () => { div.style.display = 'flex'; toggle.style.display = 'none'; };

        enableDrag(div, document.getElementById('wechat-ai-dragbar'));
        div.querySelectorAll('.resize-handle').forEach(h => enableResize(div, h));
        enableInputResize(document.getElementById('wechat-ai-input-resize-handle'), document.getElementById('wechat-ai-input-wrap'));
        setupSnapLayouts(div);
        setupScrollRefresh(); setupBgPicker(); updateBtns();

        const minBtn = document.getElementById('btn-min');
        const maxBtn = document.getElementById('btn-max');
        const closeBtn = document.getElementById('btn-close');
        const inputEl = document.getElementById('wechat-ai-input');
        const sendBtn = document.getElementById('wechat-ai-send');

        minBtn.onclick = (e) => { e.stopPropagation(); toggleMin(div); };
        maxBtn.onclick = (e) => { e.stopPropagation(); toggleMax(div); };
        closeBtn.onclick = (e) => { e.stopPropagation(); div.style.display = 'none'; toggle.style.display = 'block'; };

        document.getElementById('wechat-ai-settings-close').onclick = () => {
            toggleSettings(false);
        };

        const fontSizeGroup = document.getElementById('wechat-ai-fontsize-group');
        const themeGroup = document.getElementById('wechat-ai-theme-group');
        const currentFont = GM_getValue(K.FONT, 'medium');
        const currentTheme = GM_getValue(K.THEME, 'auto');

        fontSizeGroup.querySelectorAll('button').forEach(b => {
            if (b.dataset.value === currentFont) b.classList.add('active');
            b.onclick = () => {
                fontSizeGroup.querySelectorAll('button').forEach(x => x.classList.remove('active'));
                b.classList.add('active');
                GM_setValue(K.FONT, b.dataset.value);
                applyFontSize(b.dataset.value);
            };
        });

        themeGroup.querySelectorAll('button').forEach(b => {
            if (b.dataset.value === currentTheme) b.classList.add('active');
            b.onclick = () => {
                themeGroup.querySelectorAll('button').forEach(x => x.classList.remove('active'));
                b.classList.add('active');
                GM_setValue(K.THEME, b.dataset.value);
                applyTheme();
            };
        });

        applyFontSize(currentFont);
        applyTheme();

        const opacityInput = document.getElementById('wechat-ai-opacity');
        const opacityVal = document.getElementById('wechat-ai-opacity-val');
        const currentOpacity = Math.max(30, Math.min(100, Number(GM_getValue(K.OPACITY, 100)) || 100));
        opacityInput.value = currentOpacity;
        opacityVal.textContent = currentOpacity + '%';
        applyOpacity(currentOpacity);
        opacityInput.addEventListener('input', () => {
            const v = Number(opacityInput.value);
            opacityVal.textContent = v + '%';
            applyOpacity(v);
        });
        opacityInput.addEventListener('change', () => {
            GM_setValue(K.OPACITY, Number(opacityInput.value));
        });

        document.getElementById('wechat-ai-save-css').onclick = () => {
            const val = document.getElementById('wechat-ai-custom-css').value;
            customCss = val;
            GM_setValue(K.CUSTOM_CSS, customCss);
            document.getElementById('wechat-ai-custom-style').textContent = customCss;
            showToast('样式已保存');
            toggleSettings(false);
        };

        document.getElementById('wechat-ai-import-css').onclick = () => {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.css,text/css';
            fileInput.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (evt) => {
                    document.getElementById('wechat-ai-custom-css').value = evt.target.result;
                    document.getElementById('wechat-ai-save-css').click();
                };
                reader.readAsText(file);
            };
            fileInput.click();
        };

        document.getElementById('wechat-ai-clear-all').onclick = () => {
            if (confirm('确定清空全部消息吗？')) {
                clearChat();
                GM_setValue(K.CMD_CLEAR, Date.now());
                toggleSettings(false);
            }
        };

        let aboutClicks = 0;
        document.getElementById('wechat-ai-about').addEventListener('click', () => {
            aboutClicks++;
            if (aboutClicks >= 3) {
                aboutClicks = 0;
                const randomQuote = LEI_JUN_QUOTES[Math.floor(Math.random() * LEI_JUN_QUOTES.length)];
                showToast('“' + randomQuote + '” —— 雷军');
            }
        });

        inputEl.addEventListener('input', () => {
            if (inputEl.value.trim()) sendBtn.classList.add('active');
            else sendBtn.classList.remove('active');
        });

        inputEl.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendUserMessage();
            }
        });

        sendBtn.onclick = () => {
            if (sendBtn.classList.contains('active')) sendUserMessage();
        };

        document.getElementById('btn-pick-img').onclick = () => {
            pickUserImage();
        };

        window.addEventListener('resize', () => {
            if (state === 'max') {
                div.style.left = '0'; div.style.top = '0'; div.style.width = window.innerWidth + 'px'; div.style.height = window.innerHeight + 'px';
                div.style.setProperty('border-radius', '0px', 'important');
            }
        });
    }

    document.addEventListener('keydown', e => {
        if (e.altKey && e.key.toLowerCase() === 'w') {
            const ui = document.getElementById('wechat-ai-ui');
            if (!ui) return;
            if (state === 'edge-l' || state === 'edge-r' || state === 'min') {
                restoreFromEdge(ui, true);
            } else if (ui.style.display === 'none') {
                ui.style.display = 'flex';
                const toggle = document.getElementById('wechat-ai-toggle');
                if (toggle) toggle.style.display = 'none';
            }
        }
    });

    const mqDark = window.matchMedia('(prefers-color-scheme: dark)');
    const onMediaChange = () => { if (GM_getValue(K.THEME, 'auto') === 'auto') applyTheme(); };
    if (mqDark.addEventListener) mqDark.addEventListener('change', onMediaChange);
    else if (mqDark.addListener) mqDark.addListener(onMediaChange);

    GM_setValue(K.HB + myRole, Date.now());
    setInterval(() => { GM_setValue(K.HB + myRole, Date.now()); }, 3000);

    setTimeout(() => {
        const otherRole = isDoubao ? 'deepseek' : 'doubao';
        const otherHb = parseInt(GM_getValue(K.HB + otherRole, '0'), 10);
        const lastOpen = parseInt(GM_getValue(K.LAST_OPEN + otherRole, '0'), 10);

        if (Date.now() - otherHb > 15000 && Date.now() - lastOpen > 60000) {
            GM_setValue(K.LAST_OPEN + otherRole, Date.now());
            const url = isDoubao ? 'https://chat.deepseek.com' : 'https://www.doubao.com/chat/';
            const a = document.createElement('a');
            a.href = url; a.target = '_blank'; a.style.display = 'none';
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
        }
    }, 5000);

    (function waitForPageReady() {
        let attempts = 0;
        const maxAttempts = 30;
        const timer = setInterval(() => {
            attempts++;
            const hasInput = document.querySelector('div[contenteditable="true"]') || document.querySelector('textarea');
            const rootRendered = document.getElementById('root') && document.getElementById('root').children.length > 0;

            if (hasInput || rootRendered) {
                clearInterval(timer);
                createUI();
                setTimeout(() => { flush(); checkThinking(); }, 500);
            } else if (attempts >= maxAttempts) {
                clearInterval(timer);
                createUI();
            }
        }, 500);
    })();

    let initCheckCount = 0, lastInitKey = '';
    const initInterval = setInterval(() => {
        const cur = getReplyData();
        const k = cur.text + '###' + cur.images.join('|');
        if (k && k === lastInitKey) {
            initCheckCount++;
            if (initCheckCount >= 2) {
                seen.add(k); lastKey = k;
                ready = true;
                clearInterval(initInterval);
            }
        } else {
            lastInitKey = k;
            initCheckCount = 0;
        }
    }, 1000);

    setTimeout(() => {
        if (!ready) {
            const cur = getReplyData();
            const k = cur.text + '###' + cur.images.join('|');
            if (k) { seen.add(k); lastKey = k; }
            ready = true;
            clearInterval(initInterval);
        }
    }, 5000);

    (function snapshotTimestamps() {
        try { const u = GM_getValue(K.USER); if (u) lastUserTs = JSON.parse(u).ts || 0; } catch (e) {}
        try { const t = GM_getValue(K.TASK); if (t) lastTaskTs = JSON.parse(t).timestamp || 0; } catch (e) {}
        try { const r = GM_getValue(K.REPLY); if (r) lastReplyTs = JSON.parse(r).timestamp || 0; } catch (e) {}
    })();

    async function handleUser(data) {
        let imagePasted = false;
        if (data.imageId) {
            const b64 = loadImage(data.imageId);
            if (b64) {
                if (isDoubao) imagePasted = await pasteImageToDoubao(b64);
                else imagePasted = await pasteImageToDeepseek(b64);
                await sleep(800);
            }
        }
        const rawText = (data.text || '').trim();
        const hasRealText = rawText && rawText !== '[用户上传了一张图片]';
        let textToSend = '';
        if (hasRealText) textToSend = rawText;
        else if (data.imageId && !imagePasted) textToSend = '[用户上传了一张图片，请根据上下文回答]';
        else if (!data.imageId) return;

        if (textToSend) {
            const prompt = GROUP_PROMPT(myLabel) + 'User：' + textToSend;
            const ok = await typeIntoMyAI(prompt);
            if (!ok) {
                pushMessage('system', '[' + myLabel + '] 输入框未就绪'); flush();
                setThinking({ active: false, duration: 0 }); lastThinkingKey = ''; stopThinking();
                return;
            }
        }
        await sleep(1500);
        const sent = await waitAndClickSend(getMyInputBox(), 5000);
        if (!sent) {
            pushMessage('system', '[' + myLabel + '] 发送失败'); flush();
            setThinking({ active: false, duration: 0 }); lastThinkingKey = ''; stopThinking();
            return;
        }
        markThinkingStart();
        pendingForward = { from: myRole, round: 0, userText: rawText };
    }

    async function handleTask(task) {
        const ok = await typeIntoMyAI(task.text);
        if (!ok) {
            pushMessage('system', '[' + myLabel + '] 输入框未就绪'); flush();
            setThinking({ active: false, duration: 0 }); lastThinkingKey = ''; stopThinking();
            return;
        }
        await sleep(1500);
        await waitAndClickSend(getMyInputBox(), 5000);
        markThinkingStart();
        pendingForward = { from: task.from, round: task.round || 0, userText: '' };
    }

    async function handleReply(d) {
        const ok = await typeIntoMyAI(d.text);
        if (!ok) return;
        await sleep(1500);
        await waitAndClickSend(getMyInputBox(), 5000);
        markThinkingStart();
        pendingForward = { from: myRole, round: d.round || 0, userText: '' };
    }

    setInterval(async () => {
        if (executing) return;
        if (Date.now() < urlChangeUntil) return;

        let action = null;
        const userRaw = GM_getValue(K.USER);
        if (userRaw) {
            let d; try { d = JSON.parse(userRaw); } catch (e) {}
            if (d && d.ts !== lastUserTs && d.source === myRole) { lastUserTs = d.ts; action = { type: 'user', data: d }; }
        }
        if (!action) {
            const taskRaw = GM_getValue(K.TASK);
            if (taskRaw) {
                let t; try { t = JSON.parse(taskRaw); } catch (e) {}
                if (t && t.timestamp !== lastTaskTs && t.from !== myRole) { lastTaskTs = t.timestamp; action = { type: 'task', data: t }; }
            }
        }
        if (!action) {
            const replyRaw = GM_getValue(K.REPLY);
            if (replyRaw) {
                let r; try { r = JSON.parse(replyRaw); } catch (e) {}
                if (r && r.timestamp !== lastReplyTs && r.from === myRole) { lastReplyTs = r.timestamp; action = { type: 'reply', data: r }; }
            }
        }
        if (!action) return;
        executing = true;
        try {
            if (action.type === 'user') await handleUser(action.data);
            else if (action.type === 'task') await handleTask(action.data);
            else await handleReply(action.data);
        } finally { executing = false; }
    }, 1000);

    setInterval(() => {
        if (!ready || Date.now() < urlChangeUntil) return;
        const latest = getReplyData();

        if (!latest.text || latest.text.includes('系统提示：当前是一个多AI群聊')) return;
        if (latest.text.length < 1 && !latest.images.length) return;

        const key = latest.text + '###' + latest.images.join('|');
        if (key !== lastKey) {
            lastKey = key;
            stable = 0;
            const t = getThinking();
            if (!t.active) markThinkingStart();
            return;
        }

        stable++;
        if (stable < 3 || seen.has(key)) return;
        seen.add(key); stable = 0;

        let thinkingMs = 0;
        const t = getThinking();
        if (t.active) {
            thinkingMs = Date.now() - t.startTime;
            setThinking({ active: false, duration: thinkingMs });
            lastThinkingKey = '';
            stopThinking();
        }

        const imgIds = latest.images.map(src => saveImage(src));
        pushMessage(myRole, latest.text, imgIds, thinkingMs > 0 ? { thinkingMs } : null);
        flush();

        if (!pendingForward) return;
        const pf = pendingForward; pendingForward = null;
        const session = getSession(); const newRound = pf.round + 1;

        if (newRound >= session.maxRounds * 2) {
            pushMessage('system', '对话结束（' + session.maxRounds + '轮）'); flush(); session.active = false; setSession(session); return;
        }
        setSession(Object.assign({}, session, { round: newRound }));
        const targetKey = pf.from === myRole ? K.TASK : K.REPLY;
        const charHint = session.maxChars > 0 ? '\n\n（请用不超过' + session.maxChars + '字简短回复）' : '';
        const text = GROUP_PROMPT(otherLabel) + (pf.userText
            ? 'User：' + pf.userText + '\n\n' + myLabel + '：' + latest.text + charHint
            : myLabel + '：' + latest.text + charHint);

        GM_setValue(targetKey, JSON.stringify({ id: genId(), text, from: pf.from, round: newRound, timestamp: Date.now() }));
    }, 1000);

    setInterval(() => {
        const msgs = getMessages();
        if (msgs.length === 1 && msgs[0].who === 'system' && msgs[0].text === 'CLEAR_ALL') {
            clearChat(true);
            GM_setValue(K.MSGS, '[]');
        }
    }, 1000);

    setInterval(() => {
        const r = GM_getValue('wechat_ai_cmd_reload', 0);
        if (r > lastReloadCmd) {
            lastReloadCmd = r;
            setTimeout(() => { try { location.reload(); } catch (e) {} }, 500 + Math.random() * 500);
        }
    }, 1000);

    setInterval(() => {
        if (location.href === currentHref) return;
        currentHref = location.href;
        urlChangeUntil = Date.now() + 3000;
        pendingForward = null;
        lastKey = ''; stable = 0;

        const capture = () => {
            if (!ready) return;
            const cur = getReplyData();
            if (cur.text || cur.images.length) {
                const k = cur.text + '###' + cur.images.join('|');
                seen.add(k); lastKey = k;
            }
            stable = 0;
        };

        setTimeout(capture, 1000);
        setTimeout(capture, 2000);
        setTimeout(capture, 2800);
    }, 500);

    setInterval(flush, 1000);
    setInterval(checkThinking, 1000);
})();
