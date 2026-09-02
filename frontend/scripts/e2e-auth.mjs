import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outputDir = resolve(here, "../../screenshots");
const baseUrl = process.env.E2E_BASE_URL || "http://127.0.0.1:8080";
const username = process.env.E2E_USERNAME;
const password = process.env.E2E_PASSWORD;
if (!username || !password) throw new Error("需要设置 E2E_USERNAME 与 E2E_PASSWORD");
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const browserErrors = [];
page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
page.on("pageerror", (error) => browserErrors.push(error.message));

try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "登录实验工作台" }).waitFor();
  await page.screenshot({ path: resolve(outputDir, "auth-01-login.png"), fullPage: false });

  await page.getByRole("tab", { name: "学生注册" }).click();
  await page.getByRole("heading", { name: "注册学生账号" }).waitFor();
  await page.getByLabel("姓名或昵称").fill("浏览器验收学生");
  await page.getByLabel("用户名").fill(`browser-${Date.now()}`);
  await page.getByLabel("密码", { exact: true }).fill("Browser-Student-Password-2026!");
  await page.getByLabel("确认密码").fill("different-password");
  await page.getByRole("button", { name: /注册并进入平台/ }).click();
  await page.getByRole("alert").getByText("两次输入的密码不一致").waitFor();
  await page.getByRole("tab", { name: "登录" }).click();

  await page.getByLabel("用户名").fill(username);
  await page.getByLabel("密码").fill("wrong-password");
  await page.getByRole("button", { name: /安全登录/ }).click();
  await page.getByRole("alert").getByText("用户名或密码错误").waitFor();

  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: /安全登录/ }).click();
  await page.getByRole("heading", { name: /构建你的专属/ }).waitFor();
  await page.getByText("实验学生", { exact: true }).waitFor();
  await page.getByText("学生", { exact: true }).waitFor();
  await page.screenshot({ path: resolve(outputDir, "auth-02-student-dashboard.png"), fullPage: false });

  const cookie = (await page.context().cookies()).find((item) => item.name === "cryptolab_session");
  if (!cookie?.httpOnly || cookie.sameSite !== "Strict") throw new Error("会话 Cookie 安全属性不符合预期");
  await page.getByRole("button", { name: "退出登录" }).click();
  await page.getByRole("heading", { name: "登录实验工作台" }).waitFor();
  const meStatus = await page.evaluate(async () => (await fetch("/api/auth/me")).status);
  if (meStatus !== 401) throw new Error(`退出后会话仍有效：${meStatus}`);
  const unexpectedErrors = browserErrors.filter((message) => !message.includes("status of 401 (Unauthorized)"));
  if (unexpectedErrors.length) throw new Error(`浏览器控制台错误：\n${unexpectedErrors.join("\n")}`);
  process.stdout.write(`${JSON.stringify({ status: "passed", registrationForm: true, role: "student", cookie: { httpOnly: cookie.httpOnly, sameSite: cookie.sameSite }, logoutStatus: meStatus, screenshots: 2 }, null, 2)}\n`);
} finally {
  await browser.close();
}
