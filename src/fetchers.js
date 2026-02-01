const axios = require('axios');
const Parser = require('rss-parser');
const cheerio = require('cheerio');
const { matchPlanCategories } = require('./fiveYearPlan');

const parser = new Parser({
    headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    },
    timeout: 15000
});

// RSS 数据源配置 - 使用 anyfeeder 第三方聚合服务获取最新内容
// 注意：人民网和新华网官方RSS已停止更新（数据停留在2025年6月），故使用第三方聚合服务
const RSS_FEEDS = {
    peopleDaily: [
        { name: '人民日报公众号', url: 'https://plink.anyfeeder.com/weixin/rmrbwx', category: 'official' },
        // 以下官方源已停更（2025年6月），暂时禁用
        // { name: '人民网时政', url: 'http://www.people.com.cn/rss/politics.xml', category: 'politics' },
        // { name: '人民网社会', url: 'http://www.people.com.cn/rss/society.xml', category: 'society' },
        // { name: '人民网国际', url: 'http://www.people.com.cn/rss/world.xml', category: 'world' },
    ],
    xinhua: [
        { name: '新华社微信', url: 'https://plink.anyfeeder.com/newscn/whxw', category: 'official' },
        // 以下官方源已停更（2022年12月），暂时禁用
        // { name: '新华网时政', url: 'http://www.xinhuanet.com/politics/news_politics.xml', category: 'politics' },
    ]
};

const SOURCE_KEYS = ['peopleDaily', 'xinhua'];

// Retry wrapper for resilience
async function fetchWithRetry(url, options = {}, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            return await axios.get(url, { ...options, timeout: 15000 });
        } catch (error) {
            if (i === retries - 1) throw error;
            console.log(`Retrying ${url} (${i + 1}/${retries})...`);
            await new Promise(res => setTimeout(res, 1000 * (i + 1)));
        }
    }
}

// Fetch single RSS feed
async function fetchRSSFeed(feed, sourceName) {
    try {
        console.log(`  > Fetching: ${feed.name}`);

        const { data: xmlData } = await fetchWithRetry(feed.url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'application/rss+xml, application/xml, text/xml; q=0.1'
            }
        });

        const parsedFeed = await parser.parseString(xmlData);

        // Take top 20 items per feed
        const items = parsedFeed.items.slice(0, 20).map((item, index) => {
            // Clean up content snippet
            let snippet = '';
            if (item.contentSnippet) {
                snippet = item.contentSnippet.slice(0, 300);
            } else if (item.content) {
                const $ = cheerio.load(item.content);
                snippet = $.text().slice(0, 300);
            } else if (item['content:encoded']) {
                const $ = cheerio.load(item['content:encoded']);
                snippet = $.text().slice(0, 300);
            }

            const title = item.title?.trim() || '无标题';

            // 匹配五年规划分类标签
            const planTags = matchPlanCategories(title, snippet);

            // 保存原始日期字符串用于客户端计算
            const pubDate = item.pubDate || item.isoDate || new Date().toISOString();

            return {
                title,
                link: item.link,
                source: sourceName,
                feedName: feed.name,
                category: feed.category,
                date: pubDate,
                snippet: snippet.trim().replace(/\s+/g, ' '),
                importance: 80 - (index * 2),
                planTags
            };
        });

        console.log(`    ✓ Got ${items.length} items from ${feed.name}`);
        return items;
    } catch (error) {
        console.error(`    ✗ Failed to fetch ${feed.name}: ${error.message}`);
        return [];
    }
}

// Fetch all feeds for a source (People's Daily or Xinhua)
async function fetchSource(sourceKey) {
    const feeds = RSS_FEEDS[sourceKey];
    if (!feeds) {
        console.warn(`Unknown source: ${sourceKey}`);
        return [];
    }

    const sourceName = sourceKey === 'peopleDaily' ? '人民日报' : '新华社';
    console.log(`> Fetching ${sourceName}...`);

    // Fetch all feeds in parallel
    const results = await Promise.all(
        feeds.map(feed => fetchRSSFeed(feed, sourceName))
    );

    const allItems = results.flat();

    // Deduplicate by title (same story may appear in multiple feeds)
    const seen = new Set();
    const deduped = allItems.filter(item => {
        if (seen.has(item.title)) return false;
        seen.add(item.title);
        return true;
    });

    // Sort by date (newest first)
    deduped.sort((a, b) => new Date(b.date) - new Date(a.date));

    console.log(`✓ ${sourceName}: ${deduped.length} unique items (from ${allItems.length} total)`);
    return deduped;
}

// Fetch all sources
async function fetchAllSources() {
    const data = {};

    for (const key of SOURCE_KEYS) {
        data[key] = await fetchSource(key);
    }

    return data;
}

module.exports = {
    fetchSource,
    fetchAllSources,
    SOURCE_KEYS,
    RSS_FEEDS
};
