# 交接运行数据

本目录用于保存 `20260829_124735` 交接快照的可选运行数据。完整恢复命令见根目录 `HANDOFF.md`。

预期文件：

- `cryptolab-postgres-20260829_124735.dump`：PostgreSQL custom-format 备份。
- `cryptolab-uploads-20260829_124735.tar.gz`：上传资料 Docker 卷备份。
- `SHA256SUMS`：本目录备份文件的 SHA-256。

数据库备份包含实验项目、用户密码哈希、文档、Chunk、向量、RAG、Agent、运行记录、Skill 和 Tool；明确排除了 `auth_sessions` 的数据。恢复后必须重新登录。

本目录可能包含用户上传的实验资料，只能在授权范围内传递、恢复和使用。不要把该目录提交到公开仓库。
