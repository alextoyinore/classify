@echo off
set PGPASSWORD=12345abcde
"C:\Program Files\PostgreSQL\18\pgAdmin 4\runtime\psql.exe" -U classify_user -h 127.0.0.1 -d classify_db -c "SELECT version();" --no-align --quiet
