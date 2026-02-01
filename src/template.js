const { formatDistanceToNow } = require('date-fns');
const { zhCN } = require('date-fns/locale');
const marked = require('marked');
const { FIVE_YEAR_PLAN } = require('./fiveYearPlan');

// App Shell Generator (index.html)
function generateShell(latestDate, history) {
    const historyOptions = history.map(file => {
        const dateLabel = file.replace('.html', '');
        return `<option value="${file}">${dateLabel}</option>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>政策脉搏 | Policy Pulse</title>
    <style>
        :root {
            --bg-color: #0f172a;
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --accent-primary: #dc2626;
            --accent-secondary: #f59e0b;
            --gradient: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
        }
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: 'Inter', 'PingFang SC', system-ui, -apple-system, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-primary);
            height: 100vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        header {
            background: rgba(15, 23, 42, 0.95);
            border-bottom: 1px solid rgba(255,255,255,0.1);
            padding: 1rem 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-shrink: 0;
            z-index: 100;
        }

        .header-left { display: flex; align-items: center; gap: 1rem; }

        .logo {
            font-size: 1.5rem;
            font-weight: 800;
            background: var(--gradient);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        
        .history-select {
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.2);
            color: var(--text-primary);
            padding: 0.25rem 0.5rem;
            border-radius: 0.25rem;
            font-size: 0.875rem;
            cursor: pointer;
        }

        .timestamp { font-size: 0.875rem; color: var(--text-secondary); }

        iframe {
            flex-grow: 1;
            border: none;
            width: 100%;
            height: 100%;
        }
    </style>
</head>
<body>
    <header>
        <div class="header-left">
            <div class="logo">政策脉搏 <span style="font-size:0.8em; font-weight:400; opacity:0.7">Policy Pulse</span></div>
            <select id="history-nav" class="history-select">
                ${historyOptions}
            </select>
        </div>
        <div class="timestamp">每日政策情报</div>
    </header>

    <iframe id="content-frame" src="${latestDate}" title="Daily Report"></iframe>

    <script>
        const select = document.getElementById('history-nav');
        const iframe = document.getElementById('content-frame');
        
        select.addEventListener('change', (e) => {
            iframe.src = e.target.value;
        });
    </script>
</body>
</html>`;
}

// 生成五年规划脑图 HTML
function generatePlanMindmap() {
    const categories = FIVE_YEAR_PLAN.categories;

    // 生成分类卡片网格
    const categoryCards = categories.map(cat => `
        <div class="plan-category" id="plan-${cat.id}" style="--cat-color: ${cat.color}">
            <div class="plan-cat-header">
                <span class="plan-cat-icon">${cat.icon}</span>
                <span class="plan-cat-name">${cat.name}</span>
            </div>
            <p class="plan-cat-desc">${cat.description}</p>
            <div class="plan-subtopics">
                ${cat.subTopics.map(sub => `<span class="subtopic">${sub}</span>`).join('')}
            </div>
            <div class="plan-keywords">
                <small>关键词: ${cat.keywords.slice(0, 5).join('、')}...</small>
            </div>
        </div>
    `).join('');

    return `
        <div class="plan-overview">
            <div class="plan-header">
            <h2>🏛️ ${FIVE_YEAR_PLAN.name} (${FIVE_YEAR_PLAN.period})</h2>
            <p class="plan-theme">主题：<strong>${FIVE_YEAR_PLAN.theme}</strong></p>
            <p class="plan-intro">${FIVE_YEAR_PLAN.subtitle}。基于2025年10月二十届四中全会审议通过的建议稿，以下是主要政策领域及其重点方向：</p>
        </div>
            <div class="plan-grid">
                ${categoryCards}
            </div>
        </div>
    `;
}

// Daily Report Generator
function generateHTML(data) {
    const formatDate = (dateStr) => {
        try {
            return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: zhCN });
        } catch (e) {
            return '最近';
        }
    };

    // 渲染五年规划标签
    const renderPlanTags = (planTags) => {
        if (!planTags || planTags.length === 0) return '';

        return `
            <div class="plan-tags">
                ${planTags.map(tag => `
                    <span class="plan-tag" style="--tag-color: ${tag.color}" onclick="openTab('tab-plan'); event.preventDefault(); event.stopPropagation();">
                        ${tag.icon} ${tag.name}
                    </span>
                `).join('')}
            </div>
        `;
    };

    const renderCard = (item, index) => {
        const isHighValue = item.importance > 75;
        const rankBadge = isHighValue ? '<span class="badge hot">🔥 重要</span>' : '';

        return `
        <a href="${item.link}" target="_blank" class="card fade-in" style="animation-delay: ${index * 30}ms">
            <div class="card-header">
                <div class="card-source">${item.feedName || item.source} ${rankBadge}</div>
            </div>
            
            <h3 class="card-title">${item.title}</h3>
            
            ${renderPlanTags(item.planTags)}
            
            <div class="card-meta">${formatDate(item.date)}</div>
            
            ${item.snippet ? `<div class="card-snippet">${item.snippet.slice(0, 200)}${item.snippet.length > 200 ? '...' : ''}</div>` : ''}
        </a>
    `;
    };

    const renderSection = (title, items, briefing = null) => {
        let contentHTML = '';
        if (!items || items.length === 0) {
            contentHTML = `<div class="empty-state">暂无 ${title} 内容</div>`;
        } else {
            const visibleItems = items.slice(0, 30);
            contentHTML = `
            <div class="grid">
                ${visibleItems.map((item, i) => renderCard(item, i)).join('')}
            </div>`;
        }

        const briefingContent = briefing ? `
            <div class="briefing-box">
                <h3 class="briefing-title">📋 AI 要点摘要</h3>
                ${marked.parse(briefing)}
            </div>
        ` : '';

        return `
        <section>
            ${briefingContent}
            ${contentHTML}
        </section>
        `;
    };

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>每日政策简报</title>
    <style>
        :root {
            --bg-color: #0f172a;
            --card-bg: #1e293b;
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --text-tertiary: #64748b;
            --accent-primary: #dc2626;
            --accent-secondary: #f59e0b;
            --accent-gold: #fbbf24;
            --gradient: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: 'Inter', 'PingFang SC', system-ui, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-primary);
            line-height: 1.6;
            padding-bottom: 3rem;
            overflow-y: auto;
        }

        body.embedded header { display: none !important; }

        header {
            background: rgba(15, 23, 42, 0.95);
            backdrop-filter: blur(10px);
            border-bottom: 1px solid rgba(255,255,255,0.1);
            padding: 1.5rem 2rem;
            position: sticky;
            top: 0;
            z-index: 100;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .logo {
            font-size: 1.5rem;
            font-weight: 800;
            background: var(--gradient);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .timestamp { font-size: 0.875rem; color: var(--text-secondary); }

        /* Tab Navigation */
        .tab-nav {
            display: flex;
            overflow-x: auto;
            gap: 0.5rem;
            padding: 1rem 2rem;
            border-bottom: 1px solid rgba(255,255,255,0.05);
            scrollbar-width: none;
            background: var(--bg-color);
            position: sticky;
            top: 0;
            z-index: 90;
        }
        body:not(.embedded) .tab-nav { top: 80px; }
        .tab-nav::-webkit-scrollbar { display: none; }

        .tab-btn {
            background: transparent;
            border: 1px solid transparent;
            color: var(--text-secondary);
            padding: 0.5rem 1rem;
            border-radius: 2rem;
            cursor: pointer;
            white-space: nowrap;
            font-weight: 600;
            font-size: 0.9rem;
            transition: all 0.2s;
        }

        .tab-btn:hover {
            color: var(--text-primary);
            background: rgba(255,255,255,0.05);
        }

        .tab-btn.active {
            color: #fff;
            background: rgba(220, 38, 38, 0.2);
            border-color: var(--accent-primary);
        }
        
        .tab-btn.plan-tab {
            background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(6, 182, 212, 0.2));
            border-color: #8b5cf6;
        }
        .tab-btn.plan-tab.active {
            background: linear-gradient(135deg, rgba(139, 92, 246, 0.4), rgba(6, 182, 212, 0.4));
        }

        main {
            max-width: 1200px;
            margin: 2rem auto;
            padding: 0 1rem;
        }

        .tab-content { display: none; animation: fadeIn 0.3s ease-out; }
        .tab-content.active { display: block; }

        /* Five Year Plan Styles */
        .plan-overview {
            padding: 1rem 0;
        }
        
        .plan-header {
            text-align: center;
            margin-bottom: 2rem;
        }
        
        .plan-header h2 {
            font-size: 1.75rem;
            margin-bottom: 0.5rem;
            background: linear-gradient(135deg, #8b5cf6, #06b6d4);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        
        .plan-theme {
            font-size: 1.1rem;
            color: var(--accent-gold);
            margin-bottom: 0.5rem;
        }
        
        .plan-intro {
            color: var(--text-secondary);
            max-width: 800px;
            margin: 0 auto;
        }
        
        .plan-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 1.25rem;
        }
        
        .plan-category {
            background: var(--card-bg);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 0.75rem;
            padding: 1.25rem;
            transition: all 0.2s;
            border-left: 3px solid var(--cat-color);
        }
        
        .plan-category:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 24px rgba(0,0,0,0.3);
            border-color: var(--cat-color);
        }
        
        .plan-cat-header {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            margin-bottom: 0.5rem;
        }
        
        .plan-cat-icon {
            font-size: 1.5rem;
        }
        
        .plan-cat-name {
            font-weight: 700;
            font-size: 1.1rem;
            color: var(--text-primary);
        }
        
        .plan-cat-desc {
            font-size: 0.85rem;
            color: var(--text-secondary);
            margin-bottom: 0.75rem;
        }
        
        .plan-subtopics {
            display: flex;
            flex-wrap: wrap;
            gap: 0.4rem;
            margin-bottom: 0.75rem;
        }
        
        .subtopic {
            background: rgba(255,255,255,0.08);
            padding: 0.2rem 0.5rem;
            border-radius: 0.25rem;
            font-size: 0.75rem;
            color: var(--text-primary);
        }
        
        .plan-keywords {
            color: var(--text-tertiary);
            font-size: 0.75rem;
        }

        /* Plan Tags on Cards */
        .plan-tags {
            display: flex;
            flex-wrap: wrap;
            gap: 0.4rem;
            margin: 0.25rem 0;
        }
        
        .plan-tag {
            background: color-mix(in srgb, var(--tag-color) 20%, transparent);
            border: 1px solid color-mix(in srgb, var(--tag-color) 50%, transparent);
            color: var(--text-primary);
            padding: 0.15rem 0.5rem;
            border-radius: 0.25rem;
            font-size: 0.7rem;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .plan-tag:hover {
            background: color-mix(in srgb, var(--tag-color) 40%, transparent);
            transform: scale(1.05);
        }

        /* Briefing Box */
        .briefing-box {
            background: rgba(220, 38, 38, 0.05);
            border: 1px solid rgba(220, 38, 38, 0.2);
            border-radius: 0.75rem;
            padding: 1.5rem;
            margin-bottom: 2rem;
        }
        
        .briefing-title {
            color: var(--accent-secondary);
            margin-bottom: 1rem;
            font-size: 1.1rem;
        }

        .briefing-box h3 { 
            color: var(--accent-secondary); 
            margin-top: 1.5rem; 
            margin-bottom: 0.75rem; 
            font-size: 1rem;
        }
        .briefing-box h3:first-child { margin-top: 0; }
        
        .briefing-box p { 
            color: var(--text-secondary); 
            margin-bottom: 0.75rem; 
        }
        
        .briefing-box strong { 
            color: var(--text-primary); 
        }

        /* Card Grid */
        .grid { 
            display: grid; 
            gap: 1.5rem; 
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        }

        .card {
            background: var(--card-bg);
            border: 1px solid rgba(255,255,255,0.05);
            border-radius: 0.75rem;
            padding: 1.25rem;
            text-decoration: none;
            color: inherit;
            transition: all 0.2s;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }

        .card:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px -5px rgba(0,0,0,0.3);
            border-color: rgba(220, 38, 38, 0.3);
            background: #233045;
        }

        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: start;
        }

        .card-source {
            font-size: 0.75rem;
            font-weight: 600;
            color: var(--accent-secondary);
            text-transform: uppercase;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .card-title { 
            font-size: 1rem; 
            font-weight: 600; 
            line-height: 1.4; 
            color: var(--text-primary); 
        }

        .card-meta { 
            font-size: 0.75rem; 
            color: var(--text-tertiary); 
        }

        .card-snippet { 
            font-size: 0.85rem; 
            color: var(--text-secondary); 
            line-height: 1.5;
            background: rgba(0,0,0,0.2);
            padding: 0.75rem;
            border-radius: 0.5rem;
            border-left: 2px solid var(--text-tertiary);
        }

        .badge {
            padding: 0.1rem 0.3rem;
            border-radius: 0.2rem;
            font-size: 0.65rem;
            color: #fff;
        }
        .badge.hot { background: var(--accent-primary); }

        .empty-state {
            text-align: center;
            padding: 3rem;
            color: var(--text-secondary);
            background: rgba(255,255,255,0.02);
            border-radius: 1rem;
        }

        /* Trend Report Box */
        .trend-report {
            background: linear-gradient(135deg, rgba(251, 191, 36, 0.1), rgba(220, 38, 38, 0.05));
            border: 1px solid rgba(251, 191, 36, 0.3);
            border-radius: 1rem;
            padding: 2rem;
        }

        .trend-report h2 {
            color: var(--accent-gold);
            margin-top: 2rem;
            margin-bottom: 1rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        .trend-report h2:first-child { margin-top: 0; }

        .trend-report p {
            color: var(--text-secondary);
            margin-bottom: 1rem;
            line-height: 1.8;
        }

        .trend-report ul, .trend-report ol {
            padding-left: 1.5rem;
            margin-bottom: 1rem;
            color: var(--text-secondary);
        }
        
        .trend-report li { margin-bottom: 0.5rem; }

        @keyframes fadeIn { 
            from { opacity: 0; transform: translateY(10px); } 
            to { opacity: 1; transform: translateY(0); } 
        }
        .fade-in { animation: fadeIn 0.5s ease-out backwards; }

        @media (max-width: 768px) {
            .grid { grid-template-columns: 1fr; }
            .plan-grid { grid-template-columns: 1fr; }
            .tab-nav { padding: 1rem; }
        }
    </style>
</head>
<body>
    <header>
        <div class="logo">政策脉搏 <span style="font-size:0.8em; font-weight:400; opacity:0.7">Report</span></div>
        <div class="timestamp">生成时间: ${new Date(data.timestamp).toLocaleString('zh-CN')}</div>
    </header>

    <nav class="tab-nav">
        <button class="tab-btn plan-tab active" onclick="openTab('tab-plan')">🏛️ 五年规划</button>
        <button class="tab-btn" onclick="openTab('tab-peopleDaily')">人民日报</button>
        <button class="tab-btn" onclick="openTab('tab-xinhua')">新华社</button>
        <button class="tab-btn" onclick="openTab('tab-trend')">📈 本周趋势</button>
    </nav>

    <main>
        <div id="tab-plan" class="tab-content active">
            ${generatePlanMindmap()}
        </div>

        <div id="tab-peopleDaily" class="tab-content">
            ${renderSection('人民日报', data.peopleDaily, data.briefings?.peopleDaily)}
        </div>

        <div id="tab-xinhua" class="tab-content">
            ${renderSection('新华社', data.xinhua, data.briefings?.xinhua)}
        </div>

        <div id="tab-trend" class="tab-content">
            ${data.weeklyTrend ? `
                <div class="trend-report">
                    ${marked.parse(data.weeklyTrend)}
                </div>
            ` : `
                <div class="empty-state">
                    <p>📊 周趋势报告正在生成中...</p>
                    <p style="font-size: 0.9em; opacity: 0.7">需要累积数天数据后才能生成趋势分析</p>
                </div>
            `}
        </div>
    </main>

    <script>
        if (window.self !== window.top) {
            document.body.classList.add('embedded');
        }

        function openTab(tabId) {
            document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');
            document.querySelectorAll('.tab-btn').forEach(btn => {
                if (btn.getAttribute('onclick').includes(tabId)) {
                    btn.classList.add('active');
                }
            });
            window.scrollTo(0, 0);
        }
    </script>
</body>
</html>`;
}

module.exports = { generateHTML, generateShell };
