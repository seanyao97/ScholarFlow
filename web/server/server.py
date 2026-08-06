# -*- coding: utf-8 -*-
"""
AI 助手后端接口层(零依赖,Python 标准库)
架构:前端 → 本服务 → reasonix CLI → DeepSeek-V4-Flash → 返回

启动:  python server.py   (或双击 start-ai.bat)
接口:
  GET  /api/ai/status     -> {status, model, backend}
  POST /api/ai/chat       -> {answer, time}
  POST /api/ai/file       -> {answer, time}
"""
import http.server
import json
import os
import re
import subprocess
import sys
import time
import urllib.parse

PORT = int(os.environ.get('AI_PORT', '8765'))

# reasonix CLI 路径(可用环境变量覆盖)
REASONIX = os.environ.get('REASONIX_CLI', r'C:\App\reasonix\reasonix-cli.exe')

MODEL_NAME = os.environ.get('AI_MODEL', 'DeepSeek-V4-Flash')

# 若配置了 DEEPSEEK_API_KEY,则优先直连 DeepSeek(OpenAI 兼容),否则走 reasonix CLI
DEEPSEEK_API_KEY = os.environ.get('DEEPSEEK_API_KEY', '')
DEEPSEEK_BASE = os.environ.get('DEEPSEEK_BASE', 'https://api.deepseek.com/v1')
DEEPSEEK_MODEL = os.environ.get('DEEPSEEK_MODEL', 'deepseek-chat')


def call_reasonix(prompt, timeout=180):
    """通过 reasonix CLI 单次执行,返回文本回答"""
    cmd = [REASONIX, '-p', '--output-format', 'json', prompt]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True,
                           timeout=timeout, encoding='utf-8', errors='replace',
                           creationflags=0x08000000)  # CREATE_NO_WINDOW
        out = (r.stdout or '').strip()
        if not out:
            out = (r.stderr or '').strip()
        # reasonix -p --output-format json 可能输出 {answer/...} 结构,尝试解析
        try:
            data = json.loads(out)
            ans = data.get('answer') or data.get('text') or data.get('result') or out
        except Exception:
            ans = out
        return str(ans).strip() or '（模型未返回内容）'
    except subprocess.TimeoutExpired:
        return '（请求超时,请稍后重试）'
    except Exception as e:
        return f'（Reasonix 调用失败:{e}）'


def call_deepseek(messages, timeout=120):
    """直连 DeepSeek(OpenAI 兼容),仅当配置了 DEEPSEEK_API_KEY"""
    import urllib.request
    body = json.dumps({
        'model': DEEPSEEK_MODEL,
        'messages': messages,
        'stream': False
    }).encode('utf-8')
    req = urllib.request.Request(
        DEEPSEEK_BASE.rstrip('/') + '/chat/completions',
        data=body,
        headers={'Content-Type': 'application/json',
                 'Authorization': 'Bearer ' + DEEPSEEK_API_KEY})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode('utf-8'))
        return data['choices'][0]['message']['content'].strip()
    except Exception as e:
        return f'（DeepSeek 调用失败:{e}）'


def chat_answer(message, history=None):
    system = ('你是嵌入博士科研工作台的 AI 科研助手(Reasonix 驱动)。'
              '请用专业、简洁的中文回答科研相关问题。')
    if DEEPSEEK_API_KEY:
        messages = [{'role': 'system', 'content': system}]
        for m in (history or [])[-10:]:
            messages.append(m)
        messages.append({'role': 'user', 'content': message})
        return call_deepseek(messages)
    # reasonix 模式:把历史拼接进 prompt
    prompt = system + '\n'
    for m in (history or [])[-10:]:
        role = '用户' if m.get('role') == 'user' else '助手'
        prompt += f'{role}: {m.get("content", "")}\n'
    prompt += f'用户: {message}\n助手:'
    return call_reasonix(prompt)


def extract_pdf_text(data):
    """粗略提取 PDF 文本(零依赖,仅处理纯文本流)"""
    text = data.decode('latin-1', errors='ignore')
    text = re.sub(r'\(([^)]*)\)', r'\1', text)
    # 去掉字典等二进制噪音
    text = re.sub(r'[^\x20-\x7E\u4e00-\u9fff\n\r]', ' ', text)
    return text[:8000]


class Handler(http.server.BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def _json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        if self.path.startswith('/api/ai/status'):
            self._json(200, {'status': 'ok', 'model': MODEL_NAME,
                             'backend': 'deepseek' if DEEPSEEK_API_KEY else 'reasonix'})
        else:
            self._json(404, {'error': 'not found'})

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        if path == '/api/ai/chat':
            length = int(self.headers.get('Content-Length', 0))
            try:
                data = json.loads(self.rfile.read(length).decode('utf-8'))
            except Exception:
                self._json(400, {'error': 'bad json'})
                return
            message = (data.get('message') or '').strip()
            if not message:
                self._json(400, {'error': 'empty message'})
                return
            answer = chat_answer(message, data.get('history'))
            self._json(200, {'answer': answer, 'time': time.strftime('%H:%M:%S')})
        elif path == '/api/ai/file':
            # 简化:multipart 解析第一版只取文本类文件内容
            content_type = self.headers.get('Content-Type', '')
            length = int(self.headers.get('Content-Length', 0))
            raw = self.rfile.read(length)
            filename = 'upload'
            prompt = ''
            if 'multipart/form-data' in content_type:
                try:
                    # 提取 filename 和文件体(粗解析)
                    boundary = content_type.split('boundary=')[1].encode()
                    parts = raw.split(b'--' + boundary)
                    for part in parts:
                        if b'filename="' in part:
                            m = re.search(rb'filename="([^"]*)"', part)
                            if m:
                                filename = m.group(1).decode('utf-8', errors='ignore')
                            body = part.split(b'\r\n\r\n', 1)[1].rstrip(b'\r\n--')
                            lower = filename.lower()
                            if lower.endswith(('.txt', '.md', '.csv')):
                                prompt = body.decode('utf-8', errors='ignore')[:8000]
                            elif lower.endswith('.pdf'):
                                prompt = extract_pdf_text(body)
                            else:
                                prompt = f'（{filename} 已作为上下文,内容类型暂不解析文本）'
                except Exception as e:
                    prompt = f'（文件解析失败:{e}）'
            else:
                prompt = raw.decode('utf-8', errors='ignore')[:8000]
            question = ('请分析我上传的文件(如为论文/文档请总结:研究背景、问题、方法、'
                        '结果、创新点、不足;如为实验方案请给出分析)。文件信息:\n')
            answer = chat_answer(question + '\n' + prompt)
            self._json(200, {'answer': answer, 'time': time.strftime('%H:%M:%S'),
                             'filename': filename})
        else:
            self._json(404, {'error': 'not found'})

    def log_message(self, fmt, *args):
        sys.stderr.write('[AI] ' + fmt % args + '\n')


if __name__ == '__main__':
    print('=' * 50)
    print('  AI 助手后端服务')
    print(f'  模型: {MODEL_NAME}')
    print(f'  后端: {"直连 DeepSeek" if DEEPSEEK_API_KEY else "Reasonix CLI"}')
    print(f'  地址: http://localhost:{PORT}')
    print('  前端请保持此服务运行。Ctrl+C 停止。')
    print('=' * 50)
    server = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()
