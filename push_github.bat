@echo off
color 0E
echo =================================================================
echo Dang tien hanh add, commit va push code SafeOne len GitHub...
echo =================================================================
git add .
git commit -m "feat: sync codebase from acp360 including environment variables, lazy loading, constants, utils, and chatbot markdown"
git push
echo =================================================================
echo Hoan thanh push code SafeOne len GitHub!
echo =================================================================
pause
