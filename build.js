require('dotenv').config();
const fs = require('fs');
const path = require('path');

const { fetchAllSources, SOURCE_KEYS } = require('./src/fetchers');
const { generateDailyBriefing, generateWeeklyTrend } = require('./src/analyzer');
const { generateHTML, generateShell } = require('./src/template');

// Ensure dist exists
const DIST_DIR = path.join(__dirname, 'docs');
if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
}

// Archive directory for weekly trend data
const ARCHIVE_DIR = path.join(__dirname, 'archive');
if (!fs.existsSync(ARCHIVE_DIR)) {
    fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
}

// Helper: Chunk array for controlled concurrency
function chunkArray(arr, size) {
    return arr.length > size
        ? [arr.slice(0, size), ...chunkArray(arr.slice(size), size)]
        : [arr];
}

// Load last 7 days of archived data for trend analysis
function loadWeeklyArchive() {
    const files = fs.readdirSync(ARCHIVE_DIR)
        .filter(f => f.endsWith('.json'))
        .sort()
        .slice(-7); // Last 7 days

    return files.map(file => {
        const content = fs.readFileSync(path.join(ARCHIVE_DIR, file), 'utf-8');
        return JSON.parse(content);
    });
}

// Save today's data to archive
function saveToArchive(date, items) {
    const filename = `${date}.json`;
    const data = {
        date,
        items: items.slice(0, 50) // Store top 50 items for trend analysis
    };
    fs.writeFileSync(path.join(ARCHIVE_DIR, filename), JSON.stringify(data, null, 2));
    console.log(`Archived ${items.length} items to ${filename}`);
}

async function main() {
    console.log('========================================');
    console.log('  Policy Pulse - 政策脉搏 Daily Build');
    console.log('========================================\n');

    const data = {
        timestamp: new Date().toISOString(),
        briefings: {}
    };

    // 1. Fetch all sources
    console.log('📡 Step 1: Fetching news sources...\n');
    const sources = await fetchAllSources();

    data.peopleDaily = sources.peopleDaily;
    data.xinhua = sources.xinhua;

    // Combine all items for archiving
    const allItems = [...(sources.peopleDaily || []), ...(sources.xinhua || [])];

    // 2. Generate daily briefings with concurrency control
    console.log('\n🤖 Step 2: Generating AI briefings...\n');

    const CONCURRENCY_LIMIT = 2;
    const briefingTasks = [
        { key: 'peopleDaily', name: '人民日报', items: sources.peopleDaily },
        { key: 'xinhua', name: '新华社', items: sources.xinhua }
    ];

    const batches = chunkArray(briefingTasks, CONCURRENCY_LIMIT);

    for (const batch of batches) {
        await Promise.all(batch.map(async (task) => {
            if (!task.items || task.items.length === 0) {
                console.warn(`⚠️ No items for ${task.name}, skipping briefing`);
                return;
            }

            console.log(`> Generating briefing for ${task.name}...`);
            const briefing = await generateDailyBriefing(task.name, task.items);

            if (briefing) {
                data.briefings[task.key] = briefing;
                console.log(`✓ Briefing created for ${task.name}`);
            } else {
                console.warn(`⚠️ Briefing generation returned null for ${task.name}`);
            }
        }));
    }

    // 3. Archive today's data and generate weekly trend
    console.log('\n📊 Step 3: Processing weekly trend...\n');

    const now = new Date();
    const dateString = now.toISOString().split('T')[0];

    // Save today's data
    saveToArchive(dateString, allItems);

    // Load weekly data and generate trend
    const weeklyData = loadWeeklyArchive();

    if (weeklyData.length >= 3) {
        console.log(`> Generating weekly trend from ${weeklyData.length} days of data...`);
        const weeklyTrend = await generateWeeklyTrend(weeklyData);

        if (weeklyTrend) {
            data.weeklyTrend = weeklyTrend;
            console.log('✓ Weekly trend report generated');
        }
    } else {
        console.log(`⚠️ Only ${weeklyData.length} days of data, need at least 3 for trend analysis`);
    }

    // 4. Generate HTML outputs
    console.log('\n📄 Step 4: Generating HTML files...\n');

    const dailyFilename = `${dateString}.html`;
    const dailyPath = path.join(DIST_DIR, dailyFilename);

    // Get history
    let historyFiles = fs.readdirSync(DIST_DIR)
        .filter(f => f.match(/^\d{4}-\d{2}-\d{2}\.html$/))
        .sort()
        .reverse();

    // Add today if not present
    if (!historyFiles.includes(dailyFilename)) {
        historyFiles.unshift(dailyFilename);
    }

    // Generate daily report
    const htmlContent = generateHTML(data);
    fs.writeFileSync(dailyPath, htmlContent);
    console.log(`✓ Generated ${dailyFilename}`);

    // Generate history.json
    fs.writeFileSync(path.join(DIST_DIR, 'history.json'), JSON.stringify(historyFiles, null, 2));
    console.log('✓ Generated history.json');

    // Generate app shell
    const shellContent = generateShell(dailyFilename, historyFiles);
    fs.writeFileSync(path.join(DIST_DIR, 'index.html'), shellContent);
    console.log('✓ Generated index.html');

    console.log('\n========================================');
    console.log('  Build Complete! 构建完成');
    console.log('========================================');
}

main().catch(err => {
    console.error('Build failed:', err);
    process.exit(1);
});
