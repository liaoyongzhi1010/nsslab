import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outputDir = resolve(here, "../../screenshots");
const baseUrl = process.env.E2E_BASE_URL || "http://127.0.0.1:8080";
const username = "registration-e2e-student";
const password = "Registration-E2E-Password-2026!";
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "学生注册" }).click();
  await page.getByRole("heading", { name: "注册学生账号" }).waitFor();
  await page.getByLabel("姓名或昵称").fill("注册验收学生");
  await page.getByLabel("用户名").fill(username);
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByLabel("确认密码").fill(password);
  await page.screenshot({ path: resolve(outputDir, "register-01-form.png"), fullPage: false });
  await page.getByRole("button", { name: /注册并进入平台/ }).click();
  await page.getByRole("heading", { name: /构建你的专属/ }).waitFor();
  await page.getByText("注册验收学生", { exact: true }).waitFor();
  await page.getByText("学生", { exact: true }).waitFor();
  const currentUser = await page.evaluate(async () => (await fetch("/api/auth/me")).json());
  if (currentUser.user.username !== username || currentUser.user.role !== "student") {
    throw new Error("注册后的用户身份不符合预期");
  }
  await page.screenshot({ path: resolve(outputDir, "register-02-student-workspace.png"), fullPage: false });
  process.stdout.write(`${JSON.stringify({ status: "passed", username, role: currentUser.user.role, automaticLogin: true, screenshots: 2 }, null, 2)}\n`);
} finally {
  await browser.close();
}
