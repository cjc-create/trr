import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { PuppeteerScreenRecorder } from 'puppeteer-screen-recorder';
import { execSync } from 'child_process';

puppeteer.use(StealthPlugin());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==================== إعدادات المسارات ====================
const DAILYMOTION_DIR = path.join(__dirname, "Dailymotion");
const VIDEOS_DIR = path.join(DAILYMOTION_DIR, "Videos");

const createDirectories = async () => {
    if (!fs.existsSync(VIDEOS_DIR)) await fs.promises.mkdir(VIDEOS_DIR, { recursive: true });
};
await createDirectories();

// ==================== إعدادات النظام وتصوير الفيديو ====================
const CONFIG = {
    homeItemsCount: 30,
    videosPerFile: 35,
    requestDelay: 700,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    fixedText: " | شاهد الحلقة كاملة الرابط في البايو 🔗🍿",
    outputVideo: 'tiktok_ready.mp4',
    rawCapture: 'raw_capture.mp4',
    fontPath: '/tmp/Cairo-Bold.ttf'
};

const CHANNELS = [
    "Film.Arena",
    "Chnese-drama",
    "Drama-Portal",
    "Neon.History",
    "drama.box"
];

function generateRandomStats(originalValue) {
    return originalValue < 1000 ? Math.floor(Math.random() * 49000) + 1000 : originalValue;
}

function downloadArabicFont() {
    if (!fs.existsSync(CONFIG.fontPath)) {
        console.log("📥 جاري تحميل الخط العربي للقوالب...");
        try {
            execSync(`curl -L -s "https://github.com/google/fonts/raw/main/ofl/cairo/Cairo%5Bwght%5D.ttf" -o ${CONFIG.fontPath}`);
            console.log("✅ تم تحميل الخط بنجاح.");
        } catch (e) {
            CONFIG.fontPath = '/usr/share/fonts/truetype/kacst/KacstBook.ttf';
        }
    }
}

// ==================== نظام طلبات Dailymotion API ====================
class DailymotionClient {
    constructor() {
        this.baseUrl = "https://api.dailymotion.com";
    }

    async getM3U8Url(videoId) {
        try {
            const response = await fetch(`https://www.dailymotion.com/player/metadata/video/${videoId}`, {
                headers: { 'User-Agent': CONFIG.userAgent }
            });
            const data = await response.json();
            return data.qualities?.auto?.[0]?.url || "";
        } catch { return ""; }
    }

    async getUserVideos(username) {
        console.log(`📡 جلب بيانات القناة: ${username}...`);
        const url = `${this.baseUrl}/user/${username}/videos?fields=id,title,thumbnail_url,duration,created_time,views_total&limit=100&sort=recent`;
        const response = await fetch(url, { headers: { 'User-Agent': CONFIG.userAgent } });
        return await response.json();
    }
}

// ==================== المعالج الرئيسي والتصوير المدمج ====================
class ChronologicalScraper {
    constructor() {
        this.client = new DailymotionClient();
        this.masterList = [];
        this.arabicRegex = /[\u0600-\u06FF]/;
    }

    async run() {
        downloadArabicFont();
        console.log("🚀 جاري جمع الفيديوهات العربية من كافة القنوات...");

        for (const channel of CHANNELS) {
            try {
                const data = await this.client.getUserVideos(channel);
                if (!data.list) continue;

                for (const video of data.list) {
                    if (this.arabicRegex.test(video.title)) {
                        this.masterList.push(video);
                    }
                }
            } catch (err) {
                console.log(`⚠️ خطأ أثناء جلب بيانات القناة ${channel}:`, err.message);
            }
        }

        console.log("⚖️ جاري ترتيب الفيديوهات حسب تاريخ النشر...");
        this.masterList.sort((a, b) => b.created_time - a.created_time);

        if (this.masterList.length === 0) {
            console.error("❌ لم يتم العثور على أي فيديوهات عربية لتشغيلها.");
            return;
        }

        console.log(`✅ إجمالي الفيديوهات المكتشفة: ${this.masterList.length}. جاري استخراج روابط m3u8 لحفظ الملفات وتجهيز البث...`);

        const finalizedVideos = [];
        // سنستخرج الروابط ونحفظ البيانات كالمعتاد بناءً على كودك الأساسي
        for (const video of this.masterList) {
            console.log(`🔗 استخراج رابط: ${video.title.substring(0, 40)}...`);
            const m3u8Link = await this.client.getM3U8Url(video.id);

            finalizedVideos.push({
                id: video.id,
                title: video.title,
                thumbnail: video.thumbnail_url,
                m3u8Url: m3u8Link,
                embedUrl: `https://www.dailymotion.com/embed/video/${video.id}`,
                duration: video.duration,
                views: generateRandomStats(video.views_total),
                uploadedAt: new Date(video.created_time * 1000).toISOString(),
                timestamp: video.created_time
            });

            await new Promise(r => setTimeout(r, CONFIG.requestDelay));
        }

        // توزيع الملفات وحفظ الكاش (Home.json, p1.json...)
        await this.distributeFiles(finalizedVideos);

        // 🔥 [مرحلة تشغيل المشغل المستقر وتصوير الفيديو للـ TikTok]
        // سنختار فيديو عشوائي من أحدث 15 فيديو تم استخراجهم لضمان التجدد والسرعة
        const poolSize = Math.min(finalizedVideos.length, 15);
        const selectedVideo = finalizedVideos[Math.floor(Math.random() * poolSize)];
        
        if (!selectedVideo.m3u8Url) {
            console.log("⚠️ الفيديو المختار لا يحتوي على رابط m3u8 مباشر، سنستخدم رابط الـ Embed الإيجابي.");
            selectedVideo.m3u8Url = selectedVideo.embedUrl;
        }

        await this.captureVideoPlayback(selectedVideo);
    }

    async captureVideoPlayback(video) {
        console.log(`🎬 الفيديو المختار للتصوير: ${video.title}`);
        console.log(`🌐 الرابط المستخدم للبث: ${video.m3u8Url}`);

        const browser = await puppeteer.launch({
            headless: "new",
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--window-size=1080,1920',
                '--autoplay-policy=no-user-gesture-required',
                '--disable-web-security'
            ]
        });

        const page = await browser.newPage();
        await page.setUserAgent(CONFIG.userAgent);
        await page.setViewport({ width: 1080, height: 1920 });

        const recorder = new PuppeteerScreenRecorder(page, {
            followNewTab: true,
            fps: 25,
            videoFrame: { width: 1080, height: 1920 }
        });

        console.log(`🎥 جاري بدء تسجيل الشاشة الفعلي للدراما...`);
        await recorder.start(CONFIG.rawCapture);

        try {
            // إذا كان الرابط m3u8، سنقوم بتوليد مشغل HTML5 بسيط جداً يملأ الشاشة بالطول دون إعلانات ومشاكل حظر
            if (video.m3u8Url.includes('.m3u8')) {
                const playerHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <link href="https://vjs.zencdn.net/8.10.0/video-js.css" rel="stylesheet" />
                    <script src="https://vjs.zencdn.net/8.10.0/video.js"></script>
                    <style>
                        body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #000; }
                        .video-js { width: 100% !important; height: 100% !important; }
                        /* جعل الفيديو يملأ أبعاد التيك توك بالطول بشكل رائع */
                        video { object-fit: cover; }
                    </style>
                </head>
                <body>
                    <video id="drama-player" class="video-js vjs-default-skin" autoplay muted playsinline></video>
                    <script>
                        var player = videojs('drama-player');
                        player.src({ src: '${video.m3u8Url}', type: 'application/x-mpegURL' });
                        player.ready(function() { player.play(); });
                    </script>
                </body>
                </html>`;
                
                await page.setContent(playerHtml, { waitUntil: 'networkidle2' });
            } else {
                // خيار احتياطي في حال كان الرابط هو الـ embed الافتراضي
                await page.goto(video.m3u8Url, { waitUntil: 'networkidle2' });
            }

            console.log("⏳ تم إطلاق مشغل الدراما النظيف، جاري التصوير لمدة 40 ثانية حية...");
            await new Promise(r => setTimeout(r, 40000));

            console.log("🛑 إيقاف التسجيل وإغلاق المتصفح...");
            await recorder.stop();
            await browser.close();

            console.log("🎨 تجميع الفيديو النهائي وإضافة العناوين الجمالية للتيك توك...");
            // معالجة النصوص وتنظيف النص لئلا يتسبب بكسر أمر الـ FFmpeg
            const cleanTitle = video.title.replace(/['"\\/]/g, '');
            const filterCmd = `ffmpeg -i ${CONFIG.rawCapture} -vf "drawtext=fontfile=${CONFIG.fontPath}:text='${cleanTitle.substring(0, 50)}':fontcolor=white:fontsize=40:x=(w-text_w)/2:y=250,drawtext=fontfile=${CONFIG.fontPath}:text='${CONFIG.fixedText}':fontcolor=yellow:fontsize=32:x=(w-text_w)/2:y=1650" -c:v libx264 -crf 23 -y ${CONFIG.outputVideo}`;
            
            execSync(filterCmd, { env: process.env, stdio: 'inherit' });
            if (fs.existsSync(CONFIG.rawCapture)) fs.unlinkSync(CONFIG.rawCapture);

            console.log(`✨ اكتمل العمل بالكامل بنجاح وفيديو التيك توك جاهز: ${CONFIG.outputVideo}`);

        } catch (err) {
            console.error("❌ حدث خطأ أثناء بث أو تصوير الفيديو:", err.message);
            try { await recorder.stop(); } catch(e){}
            await browser.close();
        }
    }

    async distributeFiles(videos) {
        const homeChunk = videos.slice(0, CONFIG.homeItemsCount);
        await fs.promises.writeFile(path.join(VIDEOS_DIR, "Home.json"), JSON.stringify(homeChunk, null, 2));
        console.log(`Home.json تم إنشاؤه.`);

        const remaining = videos.slice(CONFIG.homeItemsCount);
        for (let i = 0; i < remaining.length; i += CONFIG.videosPerFile) {
            const chunk = remaining.slice(i, i + CONFIG.videosPerFile);
            const fileNumber = Math.floor(i / CONFIG.videosPerFile) + 1;
            const fileName = `p${fileNumber}.json`;
            await fs.promises.writeFile(path.join(VIDEOS_DIR, fileName), JSON.stringify(chunk, null, 2));
        }
        console.log("✨ تم تحديث وتوزيع كافة ملفات الـ JSON بنجاح.");
    }
}

const scraper = new ChronologicalScraper();
scraper.run();
