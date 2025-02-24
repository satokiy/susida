import { chromium } from "playwright";
import { createWorker } from "tesseract.js";
import { createCanvas, loadImage } from "canvas"
import fs from "fs"

const filePath = (fileName: string) => `screenshots/${fileName}`;

const browser = await chromium.launch({
	channel: "chrome",
	headless: false,
});

const context = await browser.newContext();
const page = await context.newPage();
await page.goto("https://sushida.net/play.html?soundless");

let canvasEl = undefined;
while (canvasEl === undefined) {
	canvasEl = await page.locator('[id="\\#canvas"]');
}

// 寿司打画面が確実に開くまで待つ
await page.waitForTimeout(10000);

// "スタート"の文字位置を指定
const startX = 250;
const startY = 255;

// const startScreenName = filePath('start.png');
// await canvasEl.screenshot({ path: startScreenName });
// const startImage = await loadImage(startScreenName);
// const startCanvas = createCanvas(startImage.width, startImage.height);
// const startCtx = startCanvas.getContext('2d');
// startCtx.fillStyle = 'red';
// startCtx.beginPath();
// startCtx.arc(startX, startY, 10, 0, 2 * Math.PI);
// startCtx.fill();

// const startOutput = fs.createWriteStream(filePath('start_annotated.png'));
// const startAnnotatedStream = startCanvas.createPNGStream();
// startAnnotatedStream.pipe(startOutput);
// startOutput.on('finish', () => console.log('The annotated start screenshot was created.'));

await canvasEl.click({
	position: {
		x: startX,
		y: startY
	}
})

await page.waitForTimeout(2000);

// "10,000"のボタン位置
await canvasEl.click({
	position: {
		x: 165,
		y: 330
	}
})

await page.waitForTimeout(1000);
await page.keyboard.press("Enter")
await page.waitForTimeout(3000);

const worker = await createWorker("eng");

let count = 0;
const MAX_COUNT = 200; // 終わらないので。

setInterval(async () => {
	if (count >= MAX_COUNT) {
		return;
	}
	const fileName = filePath('screenshot.png');
	await canvasEl.screenshot({ path: fileName });
	
	// 文字を認識するエリア
	const region = {
		x: 60,
		y: 200,
		width: 400,
		height: 100,
	}
	
	const image = await loadImage(fileName)
	const canvas = createCanvas(region.width, region.height);
	const ctx = canvas.getContext('2d');
	ctx.drawImage(image, region.x, region.y, region.width, region.height, 0, 0, region.width, region.height);
	
	const regionFileName = filePath('region_screenshot.png');
	const out = fs.createWriteStream(regionFileName);
	const stream = canvas.createPNGStream();
	stream.pipe(out);
	await new Promise(resolve => out.on('finish', resolve));
	
	const { data: { words } } = await worker.recognize(regionFileName);
	
	// 記録用画像
	ctx.font = '20px Arial';
	ctx.fillStyle = 'red';
	words.forEach((word) => {
		const { x0, y0, x1, y1 } = word.bbox;
		ctx.fillText(word.text, x0, y0 - 10);
		ctx.strokeStyle = 'red';
		ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
	});
	const output = fs.createWriteStream(filePath('annotated_region_screenshot.png'));
	const annotatedStream = canvas.createPNGStream();
	annotatedStream.pipe(output);
	output.on('finish', () => console.log(''));
	

	const typingWord = words.filter((word) => {
		return word.text.match(/\b[a-z!?]{4,}\b/);
	})

	/**
	 * FIXME: "j"の認識が"Jj"になってしまうなどの問題がある。
	 */
	if (typingWord.length === 0) {
		console.log("No matching words found.");
		console.log(words.map((word) => word.text));
		return
	}

	const typingWords = typingWord[0].text.split('');
	console.log(typingWords.join(""));
	for(let i = 0; i < typingWords.length; i++) {
		setTimeout(async () => await page.keyboard.press(typingWords[i]), 100)
	}
	count++;
}, 1000);


// await worker.terminate();
// await browser.close();
