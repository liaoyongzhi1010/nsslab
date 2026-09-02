import os


# 测试套件永远不读取或调用开发者本地的真实模型密钥。
os.environ["LLM_PROVIDER"] = "local"
os.environ["APP_ENV"] = "test"
os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["DATABASE_AUTO_CREATE"] = "true"
os.environ["AUTH_ADMIN_USERNAME"] = "admin"
os.environ["AUTH_ADMIN_PASSWORD"] = "Admin-Test-Password-2026!"
os.environ["AUTH_ADMIN_DISPLAY_NAME"] = "测试管理员"
os.environ["AUTH_STUDENT_USERNAME"] = "student"
os.environ["AUTH_STUDENT_PASSWORD"] = "Student-Test-Password-2026!"
os.environ["AUTH_STUDENT_DISPLAY_NAME"] = "测试学生"
