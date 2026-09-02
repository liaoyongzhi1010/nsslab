import { chromium } from "playwright-core";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const outputDir = resolve(here, "../../screenshots");
const baseUrl = process.env.E2E_BASE_URL || "http://127.0.0.1:5173";
const username = process.env.E2E_USERNAME;
const password = process.env.E2E_PASSWORD;
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 1 });
const consoleErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => consoleErrors.push(error.message));

try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "登录实验工作台" }).waitFor();
  await page.screenshot({ path: resolve(outputDir, "00-login.png"), fullPage: false });
  if (!username || !password) throw new Error("浏览器验收需要设置 E2E_USERNAME 与 E2E_PASSWORD");
  await page.getByLabel("用户名").fill(username);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: /安全登录/ }).click();
  await page.getByRole("heading", { name: /构建你的专属/ }).waitFor();
  await page.getByRole("button", { name: "紧凑字号" }).click();
  const compactFontSize = Number.parseFloat(await page.locator(".hero-copy > p").evaluate((node) => getComputedStyle(node).fontSize));
  await page.getByRole("button", { name: "大字号" }).click();
  const largeFontSize = Number.parseFloat(await page.locator(".hero-copy > p").evaluate((node) => getComputedStyle(node).fontSize));
  if (largeFontSize <= compactFontSize) throw new Error(`验收失败：大字号 ${largeFontSize}px 未大于紧凑字号 ${compactFontSize}px`);
  await page.reload({ waitUntil: "networkidle" });
  if (await page.locator("html").getAttribute("data-font-size") !== "large") throw new Error("验收失败：字号设置未持久化");
  await page.getByRole("button", { name: "标准字号" }).click();
  if (await page.locator("html").getAttribute("data-theme") === "light") {
    await page.getByRole("button", { name: "切换到深色主题" }).click();
  }
  const themeToggle = page.getByRole("button", { name: "切换到浅色主题" });
  await themeToggle.click();
  if (await page.locator("html").getAttribute("data-theme") !== "light") throw new Error("验收失败：未切换到浅色主题");
  await page.screenshot({ path: resolve(outputDir, "00-light-dashboard.png"), fullPage: false });
  await page.reload({ waitUntil: "networkidle" });
  if (await page.locator("html").getAttribute("data-theme") !== "light") throw new Error("验收失败：浅色主题未持久化");
  await page.getByRole("button", { name: "切换到深色主题" }).click();
  if (await page.locator("html").getAttribute("data-theme") !== "dark") throw new Error("验收失败：未切换回深色主题");
  await page.getByRole("button", { name: "创建实验项目" }).click();
  await page.getByLabel("项目名称").fill("密码学智能体课程实验");
  await page.getByRole("button", { name: /创建并开始/ }).click();
  await page.getByRole("heading", { name: "密码学智能体课程实验", exact: true }).waitFor();

  await page.getByRole("link", { name: /向量知识库/ }).click();
  const uploadInput = page.getByLabel("上传密码学资料");
  await uploadInput.setInputFiles([
    { name: "student-notes.txt", mimeType: "text/plain", buffer: Buffer.from("Merkle 树使用哈希函数验证数据完整性，根哈希可作为紧凑承诺。") },
    { name: "modular_demo.py", mimeType: "text/x-python", buffer: Buffer.from("def mod_inverse(a, modulus):\n    return pow(a, -1, modulus)\n") },
  ]);
  await page.getByText("已解析 2 份资料，并自动加入本次知识库").waitFor();
  await page.getByText("student-notes.txt", { exact: true }).waitFor();
  await page.getByText("modular_demo.py", { exact: true }).waitFor();
  await page.getByRole("button", { name: "预览 modular_demo" }).click();
  await page.getByText("PARSED SOURCE CODE").waitFor();
  await page.getByText("Python", { exact: true }).waitFor();
  await page.getByRole("button").filter({ has: page.locator("svg.lucide-x") }).click();
  await page.getByRole("button", { name: "构建知识库" }).click();
  await page.getByText("Crypto Knowledge Base 已就绪").waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: /运行检索/ }).click();
  await page.getByText("QUERY EMBEDDING", { exact: true }).waitFor();
  const rsaRanked = await page.locator(".result-row").filter({ hasText: "RSA 与公钥加密边界" }).count();
  if (!rsaRanked) throw new Error("验收失败：RSA 查询未返回 RSA 片段");
  await page.screenshot({ path: resolve(outputDir, "01-knowledge-lab.png"), fullPage: false });

  await page.getByRole("link", { name: /Crypto-RAG/ }).click();
  await page.getByRole("button", { name: /运行 A\/B 对比/ }).click();
  await page.getByText("RAG 过程观察器").waitFor({ timeout: 90000 });
  await page.getByText("引用来源").waitFor();
  await page.screenshot({ path: resolve(outputDir, "02-rag-compare.png"), fullPage: false });

  await page.getByRole("link", { name: /Crypto Agent/ }).click();
  await page.getByRole("button", { name: /运行 Mini Crypto Agent/ }).click();
  await page.getByText("Agent 工作过程观察器").waitFor({ timeout: 90000 });
  await page.locator(".agent-summary").getByText("crypto_selection", { exact: true }).waitFor();
  await page.locator(".agent-summary").getByText("knowledge_search", { exact: true }).waitFor();
  await page.screenshot({ path: resolve(outputDir, "03-agent-trace.png"), fullPage: false });

  await page.getByRole("link", { name: /实验报告/ }).click();
  await page.getByRole("heading", { name: /实验过程与/ }).waitFor();
  const conclusion = "调整 Top-K 后引用更完整，但需要避免过多弱相关上下文。";
  await page.getByLabel("学生结论").fill(conclusion);
  const [pdfDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "导出 PDF" }).click(),
  ]);
  const pdfBytes = await readFile(await pdfDownload.path());
  if (pdfBytes.subarray(0, 5).toString() !== "%PDF-") throw new Error("验收失败：PDF 下载内容无效");
  if (!pdfDownload.suggestedFilename().endsWith(".pdf")) throw new Error("验收失败：PDF 下载文件名错误");
  const [docxDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "导出 Word (.docx)" }).click(),
  ]);
  const docxBytes = await readFile(await docxDownload.path());
  if (docxBytes.subarray(0, 2).toString() !== "PK") throw new Error("验收失败：Word 下载内容无效");
  if (!docxDownload.suggestedFilename().endsWith(".docx")) throw new Error("验收失败：Word 下载文件名错误");
  await page.screenshot({ path: resolve(outputDir, "04-report.png"), fullPage: false });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/lab/rag`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "大字号" }).click();
  const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
  if (bodyWidth > 420) throw new Error(`验收失败：移动端页面横向溢出 ${bodyWidth}px`);
  await page.screenshot({ path: resolve(outputDir, "05-mobile-rag.png"), fullPage: false });

  if (consoleErrors.length) throw new Error(`浏览器控制台错误：\n${consoleErrors.join("\n")}`);
  console.log(JSON.stringify({ status: "passed", screenshots: 7, downloads: ["pdf", "docx"], themes: ["light", "dark"], fonts: { compactFontSize, largeFontSize }, rsaRanked, bodyWidth }, null, 2));
} finally {
  await browser.close();
}
