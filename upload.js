const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { PuppeteerScreenRecorder } = require('puppeteer-screen-recorder');
const fs = require('fs');

// 🟢 تفعيل إضافة التخفي لمنع الحظر والتعرف على البوت
puppeteer.use(StealthPlugin());

const MOVIES_SITE = 'https://topcinemaa.cam/movies/';
const CONFIG = {
    fixedText: " | شاهد الفيلم كامل الرابط في البايو 🔗🍿",
    outputVideo: 'tiktok_ready.mp4',
    rawCapture: 'raw_capture.mp4',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    fontPath: '/tmp/Cairo-Bold.ttf'
};

function downloadArabicFont() {
    if (!fs.existsSync(CONFIG.fontPath)) {
        console.log("📥 جاري تحميل الخط العربي...");
        try {
            const { execSync } = require('child_process');
            execSync(`curl -L -s "https://github.com/google/fonts/raw/main/ofl/cairo/Cairo%5Bwght%5D.ttf" -o ${CONFIG.fontPath}`);
            console.log("✅ تم تحميل الخط.");
        } catch (e) {
            console.log("⚠️ فشل تحميل الخط، سيتم استخدام الخط الافتراضي للنظام.");
            CONFIG.fontPath = '/usr/share/fonts/truetype/kacst/KacstBook.ttf';
        }
    }
}

async function startScreenCapture() {
    downloadArabicFont();

    const browser = await puppeteer.launch({
        headless: "new", 
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--window-size=1080,1920',
            '--disable-web-security',
            '--allow-running-insecure-content',
            '--disable-blink-features=AutomationControlled',
            '--autoplay-policy=no-user-gesture-required'
        ]
    });
    
    const page = await browser.newPage();
    
    // 🟢 خداع السيرفرات وإخفاء ميزة الـ webdriver تماماً لتبدو كإنسان حقيقي
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        Object.defineProperty(navigator, 'languages', { get: () => ['ar-SA', 'ar', 'en-US', 'en'] });
    });

    await page.setUserAgent(CONFIG.userAgent);
    await page.setViewport({ width: 1080, height: 1920 });

    const recorder = new PuppeteerScreenRecorder(page, {
        followNewTab: true,
        fps: 25,
        videoFrame: { width: 1080, height: 1920 }
    });
    
    console.log(`🎥 بدء تسجيل الشاشة...`);
    await recorder.start(CONFIG.rawCapture);

    try {
        console.log(`🔎 1. فتح الموقع الرئيسي...`);
        await page.goto(MOVIES_SITE, { waitUntil: 'networkidle2', timeout: 60000 });

        // انتظار تحميل الأفلام
        await page.waitForSelector('.Small--Box a.recent--block', { timeout: 30000 });

        const movies = await page.evaluate(() => {
            const items = Array.from(document.querySelectorAll('.Small--Box a.recent--block'));
            return items.map(item => ({
                title: item.getAttribute('title') ? item.getAttribute('title').replace('مترجم اون لاين', '').trim() : 'فيلم مشوق',
                url: item.getAttribute('href')
            }));
        });

        if (movies.length === 0) throw new Error("لم يتم العثور على أفلام.");
        const randomMovie = movies[Math.floor(Math.random() * movies.length)];
        
        console.log(`🎬 الفيلم المختار: ${randomMovie.title}`);
        console.log(`🔗 الرابط الأساسي: ${randomMovie.url}`);
        
        // 🟢 الخطوة المهمة: إضافة /watch/ للرابط
        let watchUrl = randomMovie.url;
        if (watchUrl.endsWith('/')) {
            watchUrl = watchUrl.slice(0, -1);
        }
        watchUrl = watchUrl + '/watch/';
        
        console.log(`🚀 2. الانتقال إلى صفحة المشاهدة: ${watchUrl}`);
        await page.goto(watchUrl, { waitUntil: 'networkidle2', timeout: 60000 });

        // 🟢 انتظار تحميل الصفحة
        console.log("⏳ انتظار تحميل صفحة المشاهدة...");
        await page.waitForTimeout(5000);

        // 🟢 استخراج رابط التضمين من meta tag الصحيح: og:video:url
        console.log("🔍 3. استخراج رابط المشغل من og:video:url...");
        
        const embedUrl = await page.evaluate(() => {
            const metaTag = document.querySelector('meta[property="og:video:url"]');
            console.log('Meta tag found:', metaTag ? metaTag.getAttribute('content') : 'null');
            return metaTag ? metaTag.getAttribute('content') : null;
        });

        if (!embedUrl) {
            throw new Error("❌ لم يتم العثور على رابط التضمين في og:video:url");
        }

        console.log(`✅ تم العثور على رابط التضمين: ${embedUrl}`);

        // 🟢 فتح الرابط في نفس التبويب
        console.log(`🚀 4. فتح صفحة التضمين...`);
        await page.goto(embedUrl, { 
            waitUntil: 'networkidle2', 
            timeout: 60000 
        });

        // انتظار تحميل المشغل
        console.log("⏳ انتظار تحميل مشغل الفيديو...");
        await page.waitForTimeout(8000);

        // 🟢 محاولة تشغيل الفيديو
        console.log(`🖱️ 5. محاولة تشغيل الفيديو...`);
        
        // محاولات متعددة لتشغيل الفيديو
        await page.evaluate(() => {
            // تشغيل جميع عناصر الفيديو
            const videos = document.querySelectorAll('video');
            videos.forEach(video => {
                video.muted = true; // مهم للتشغيل التلقائي
                video.play().catch(e => console.log('Video play failed:', e));
            });
            
            // النقر على أزرار التشغيل المختلفة
            const playSelectors = [
                '.vjs-big-play-button',
                '.play-button',
                '[aria-label="Play"]',
                'button.play',
                '.jw-icon-playback',
                '.plyr__control--overlaid',
                'button[aria-label="تشغيل"]',
                '.play-btn',
                '#play-button'
            ];
            
            playSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => el.click());
            });
        });

        // النقر في منتصف الشاشة
        await page.mouse.click(540, 960);
        await page.waitForTimeout(2000);
        
        // النقر مرة أخرى للتأكيد
        await page.mouse.click(540, 800);
        await page.waitForTimeout(2000);

        // محاولة أخيرة للتشغيل عبر مساحة الصفحة
        await page.keyboard.press('Space');
        await page.waitForTimeout(1000);

        console.log("⏳ 6. تسجيل الفيديو لمدة 60 ثانية...");
        // عداد تنازلي للتتبع
        for (let i = 60; i > 0; i -= 10) {
            console.log(`   ⏱️ متبقي ${i} ثانية...`);
            await page.waitForTimeout(10000);
        }

        await recorder.stop();
        await browser.close();

        console.log(`🎨 7. دمج النصوص والعناوين بواسطة FFmpeg...`);
        const { execSync } = require('child_process');
        
        // تنظيف النص العربي لتجنب مشاكل FFmpeg
        const safeTitle = randomMovie.title.replace(/'/g, "'\\''").replace(/:/g, '\\:');
        const safeFixedText = CONFIG.fixedText.replace(/'/g, "'\\''").replace(/:/g, '\\:');
        
        // تحسين أوامر FFmpeg مع معالجة أفضل للنص العربي
        const filterCmd = `ffmpeg -i ${CONFIG.rawCapture} \
            -vf "drawtext=fontfile=${CONFIG.fontPath}:text='${safeTitle}':fontcolor=white:fontsize=42:x=(w-text_w)/2:y=250:shadowx=2:shadowy=2:shadowcolor=black, \
            drawtext=fontfile=${CONFIG.fontPath}:text='${safeFixedText}':fontcolor=yellow:fontsize=32:x=(w-text_w)/2:y=1650:shadowx=2:shadowy=2:shadowcolor=black" \
            -c:v libx264 -crf 23 -preset fast -y ${CONFIG.outputVideo}`;
        
        execSync(filterCmd, { env: process.env, stdio: 'inherit' });
        
        // تنظيف الملف المؤقت
        if (fs.existsSync(CONFIG.rawCapture)) {
            fs.unlinkSync(CONFIG.rawCapture);
            console.log("🧹 تم حذف الملف المؤقت");
        }

        console.log(`🚀 تم تجهيز الفيديو بنجاح: ${CONFIG.outputVideo}`);
        return true;

    } catch (e) {
        console.error(`❌ خطأ:`, e.message);
        console.error(e.stack);
        try { await recorder.stop(); } catch(err){}
        await browser.close();
        return false;
    }
}

(async () => {
    const result = await startScreenCapture();
    process.exit(result ? 0 : 1);
})();
