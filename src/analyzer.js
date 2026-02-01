const axios = require('axios');

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

/**
 * 生成当日要点简报
 * @param {string} category - 分类名称
 * @param {Array} items - 新闻条目列表
 * @returns {string} - Markdown 格式的简报
 */
async function generateDailyBriefing(category, items) {
    if (!items || items.length === 0) return null;

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
        console.warn('Skipping briefing: No DEEPSEEK_API_KEY');
        return null;
    }

    const titles = items.slice(0, 15).map(i => `- ${i.title}`).join('\n');

    const prompt = `你是一名资深时政分析师。请根据以下${category}新闻标题，提取最重要的3-5条政策信号或要点。

要求:
1. 每条要点用 "### 🔹 [要点标题]" 格式
2. 每个要点下用中文简述其背景和意义
3. 只输出Markdown格式内容，不要开场白
4. 相关联的新闻合并分析

新闻来源: ${category}
今日新闻:
${titles}
`;

    try {
        const response = await axios.post(DEEPSEEK_API_URL, {
            model: "deepseek-chat",
            messages: [
                { role: "system", content: "你是专业的中国政策新闻分析师。" },
                { role: "user", content: prompt }
            ],
            stream: false
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });

        return response.data.choices[0].message.content;
    } catch (error) {
        console.error(`Briefing generation failed for ${category}:`, error.response?.data || error.message);
        return null;
    }
}

/**
 * 生成一周政策趋势分析报告
 * @param {Array} weeklyData - 近7天的新闻数据 [{date, items}]
 * @returns {string} - Markdown 格式的趋势报告
 */
async function generateWeeklyTrend(weeklyData) {
    if (!weeklyData || weeklyData.length === 0) return null;

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
        console.warn('Skipping trend: No DEEPSEEK_API_KEY');
        return null;
    }

    // 构建一周数据摘要
    const weekSummary = weeklyData.map(day => {
        const topTitles = day.items.slice(0, 5).map(i => `  - ${i.title}`).join('\n');
        return `### ${day.date}\n${topTitles}`;
    }).join('\n\n');

    const prompt = `你是一名资深政策研究专家。请分析以下近一周的中国官方媒体新闻，生成政策发展趋势报告。

报告结构要求:
## 📊 本周核心政策动向
（总结3-5个本周最重要的政策方向）

## 📈 趋势变化分析
（与上周/近期相比，有哪些政策重点的变化）

## ⚠️ 值得关注的信号
（可能暗示未来政策变化的蛛丝马迹）

## 🔮 下周研判
（基于本周情况，下周可能的政策关注点）

---
一周新闻概览:
${weekSummary}
`;

    try {
        const response = await axios.post(DEEPSEEK_API_URL, {
            model: "deepseek-reasoner",
            messages: [
                { role: "system", content: "你是专业的中国政策研究专家，擅长从官方媒体报道中分析政策趋势。" },
                { role: "user", content: prompt }
            ],
            stream: false
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 120000 // Longer timeout for reasoning model
        });

        return response.data.choices[0].message.content;
    } catch (error) {
        console.error('Weekly trend generation failed:', error.response?.data || error.message);
        return null;
    }
}

module.exports = {
    generateDailyBriefing,
    generateWeeklyTrend
};
