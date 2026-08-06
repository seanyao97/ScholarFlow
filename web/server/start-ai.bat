@echo off
chcp 65001 >nul
title AI 助手后端服务
echo ============================================
echo   AI 助手后端服务 (Reasonix -> DeepSeek)
echo   前端: 科研工作台 AI 助手模块
echo   停止: 关闭此窗口
echo ============================================
echo.
cd /d "%~dp0"
python server.py
pause
