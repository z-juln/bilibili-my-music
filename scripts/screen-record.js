const puppeteer = require('puppeteer');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs-extra');
const ora = require('ora');

/** @typedef {{ totalTime: number; fps?: number; output?: string; viewport?: { width: number; height: number; } }} Opts */

const screenRecord = async (/** @type {Opts} */ opts) => {
  const {
    fps = 12, // 一秒12帧
    totalTime,
    output,
    viewport = { width: 1280, height: 720 },
  } = opts;

  const interval = 1000 / fps;

  const generateSpin = ora({ color: 'yellow', spinner: 'circle' }).start('生成中...');
  const mergeSpin = ora({ color: 'yellow', spinner: 'circle' });

  fs.emptyDirSync('screenshot');
  fs.remove(output);

  const browser = await puppeteer.launch({
    headless: 'new',
    defaultViewport: viewport,
    ignoreHTTPSErrors: true,
  });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:8080?autoplay=1&speed=1');
  let i = 1;
  const doScreenshot = async () => {
    generateSpin.text = `图片序列生成中... ${(i / (totalTime / interval) * 100).toFixed(1)}%`;
    const screenshot = await page.screenshot({ fullPage: true, type: 'jpeg' });
    fs.writeFile(`screenshot/${i.toString().padStart(6, '0')}.jpeg`, screenshot, { encoding: 'binary' }, (err) => {
      if (err) {
        generateSpin.fail('图片序列生成失败');
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
      generateSpin.succeed('图片序列生成完成');
      mergeSpin.start('视频合成中...');
      // 延后3000ms执行，保证图片序列生成好了
      spawn(ffmpegPath, [
        '-f', 'image2',
        '-r', 1000 / interval, // 频率
        '-i', 'screenshot/%06d.jpeg',
        '-c:v', 'libx264',
        '-crf', '18',
        '-preset', 'veryslow',
        '-tune', 'animation',
        '-y', output,
      ])
        .on('close', async () => {
          mergeSpin.succeed('视频合成成功');
          await page.close();
          await browser.close();
        })
        .on('error', (error) => {
          mergeSpin.fail('视频合成失败');
          console.log('error', error);
        });
    }, 3000);
  }, totalTime);
};

screenRecord({
  fps: 12,
  totalTime: 1.2 * 60 * 1000,
  output: 'output.mp4',
  viewport: { width: 1024, height: 576 },
});
