const puppeteer = require('puppeteer');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs-extra');
const ora = require('ora');

const spin = ora({ color: 'yellow' }).start('生成中...');

const interval = 100;
const totalTime = 0.1 * 60 * 1000;
const url = 'http://127.0.0.1:8080?autoplay=1';
const output = 'output.mp4';
const viewport = {
  width: 1280,
  height: 720,
};

(async () => {
  fs.emptyDirSync('screenshot');
  fs.remove(output);

  const browser = await puppeteer.launch({
    headless: 'new',
    defaultViewport: viewport,
    ignoreHTTPSErrors: true,
  });
  const page = await browser.newPage();
  await page.goto(url);
  let i = 1;
  const doScreenshot = async () => {
    spin.text = `生成中... ${(i / (totalTime / interval) * 100).toFixed(1)}%`;
    const screenshot = await page.screenshot({ fullPage: true });
    fs.writeFile(`screenshot/${i.toString().padStart(6, '0')}.png`, screenshot, { encoding: 'binary' }, (err) => {
      if (err) {
        spin.fail('生成失败');
        console.log('err', err);
      }
    });
    i++;
  };

  doScreenshot();
  const intervalTimer = setInterval(doScreenshot, interval);

  setTimeout(() => {
    clearInterval(intervalTimer);
    setTimeout(() => {
      // 延后3000ms执行，保证图片序列生成好了
      spawn(ffmpegPath, [
        '-f', 'image2',
        '-r', 1000 / interval, // 频率
        '-i', 'screenshot/%06d.png',
        '-c:v', 'libx264',
        '-crf', '18',
        '-preset', 'veryslow',
        '-tune', 'animation',
        '-y', output,
      ])
        .on('close', async () => {
          spin.succeed('生成完成');
          await page.close();
          await browser.close();
        });
    }, 3000);
  }, totalTime);
})();
