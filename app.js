// 初始化日期输入为今天
document.getElementById('dateInput').valueAsDate = new Date();

// 交易类型和分类数据定义
// 支出分类
const EXPENSE_CATEGORIES = [
    { id: 'food', name: '餐饮', icon: 'utensils', color: '#EF4444' },
    { id: 'transport', name: '交通', icon: 'car', color: '#F59E0B' },
    { id: 'shopping', name: '购物', icon: 'shopping-bag', color: '#8B5CF6' },
    { id: 'entertainment', name: '娱乐', icon: 'film', color: '#EC4899' },
    { id: 'medical', name: '医疗', icon: 'stethoscope', color: '#10B981' },
    { id: 'education', name: '教育', icon: 'graduation-cap', color: '#3B82F6' },
    { id: 'housing', name: '住房', icon: 'home', color: '#6366F1' },
    { id: 'other', name: '其他', icon: 'ellipsis-h', color: '#6B7280' }
];

// 收入分类
const INCOME_CATEGORIES = [
    { id: 'salary', name: '工资', icon: 'money-bill-wave', color: '#10B981' },
    { id: 'bonus', name: '奖金', icon: 'gift', color: '#3B82F6' },
    { id: 'investment', name: '投资', icon: 'chart-line', color: '#8B5CF6' },
    { id: 'part-time', name: '兼职', icon: 'briefcase', color: '#F59E0B' },
    { id: 'refund', name: '退款', icon: 'undo', color: '#6366F1' },
    { id: 'other', name: '其他', icon: 'ellipsis-h', color: '#6B7280' }
];

// 全局状态变量
let currentType = 'expense'; // 当前选择的交易类型
let selectedCategory = null; // 当前选择的分类
let currentUser = null; // 当前用户（null表示游客）
let editingTransactionId = null; // 编辑中的交易ID
let transactionsCache = []; // 从服务器加载的交易数据缓存

// 预算相关变量
let currentBudgetAmount = 0; // 当前预算金额
let currentMonthlyExpense = 0; // 当前月支出总额
let budgetExceeded = false; // 预算是否超支

// 图表实例占位（初始化后赋值）
let trendChart = null;
let categoryChart = null;
let incomeCategoryChart = null;
let monthlyComparisonChart = null;
let incomeExpenseRatioChart = null;

// 金额辅助函数（此前缺失导致渲染报错）
function parseAmountToCents(value) {
    const n = Number(value);
    if (Number.isNaN(n)) return 0;
    return Math.round(n * 100);
}
function centsToNumber(cents) {
    return (typeof cents === 'number' ? cents : 0) / 100;
}
function getAmountCents(t) {
    if (!t) return 0;
    if (typeof t.amountCents === 'number') return t.amountCents;
    if (t.amount != null) return parseAmountToCents(t.amount);
    return 0;
}

// 所有金额在前端内部使用整数分 (cents) 进行计算，以避免浮点误差

// DOM 元素获取
// 交易记录相关元素
const expenseBtn = document.getElementById('expenseBtn'); // 支出按钮
const incomeBtn = document.getElementById('incomeBtn'); // 收入按钮
const categoryContainer = document.getElementById('categoryContainer'); // 分类容器
const amountInput = document.getElementById('amountInput'); // 金额输入框
const saveBtn = document.getElementById('saveBtn'); // 保存按钮
const transactionList = document.getElementById('transactionList'); // 交易记录列表
const transactionModal = document.getElementById('transactionModal'); // 交易详情模态框
const closeModalBtn = document.getElementById('closeModalBtn'); // 关闭模态框按钮
const deleteTransactionBtn = document.getElementById('deleteTransactionBtn'); // 删除交易按钮
const editTransactionBtn = document.getElementById('editTransactionBtn'); // 编辑交易按钮
const modalContent = document.getElementById('modalContent'); // 模态框内容
const viewAllBtn = document.getElementById('viewAllBtn'); // 查看全部按钮
// 全部交易模态元素
const allTransactionsModal = document.getElementById('allTransactionsModal');
const closeAllTransactionsBtn = document.getElementById('closeAllTransactionsBtn');
const allTransactionsList = document.getElementById('allTransactionsList');
const allSearchInput = document.getElementById('allSearchInput');
const allTypeFilter = document.getElementById('allTypeFilter');
const rangeButtons = document.querySelectorAll('.range-btn');
const customStart = document.getElementById('customStart');
const customEnd = document.getElementById('customEnd');
const applyCustomRange = document.getElementById('applyCustomRange');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const pageSizeSelect = document.getElementById('pageSizeSelect');
const paginationInfo = document.getElementById('paginationInfo');

// 查看全部状态
let allRange = 'month'; // 默认显示本月
let allPage = 1;
let allPageSize = 10;
const timeFilterBtns = document.querySelectorAll('.time-filter-btn'); // 时间筛选按钮

// 用户认证相关元素
const settingsBtn = document.getElementById('settingsBtn'); // 设置/登录按钮
const authModal = document.getElementById('authModal'); // 认证模态框
const authCloseBtn = document.getElementById('authCloseBtn'); // 关闭认证模态框
const authTabLoginBtn = document.getElementById('authTabLoginBtn'); // 登录标签
const authTabRegisterBtn = document.getElementById('authTabRegisterBtn'); // 注册标签
const loginForm = document.getElementById('loginForm'); // 登录表单
const registerForm = document.getElementById('registerForm'); // 注册表单
const loginBtn = document.getElementById('loginBtn'); // 登录按钮
const registerBtn = document.getElementById('registerBtn'); // 注册按钮
const loginUsername = document.getElementById('loginUsername'); // 登录用户名输入
const loginPassword = document.getElementById('loginPassword'); // 登录密码输入
const registerUsername = document.getElementById('registerUsername'); // 注册用户名输入
const registerPassword = document.getElementById('registerPassword'); // 注册密码输入
const registerConfirm = document.getElementById('registerConfirm'); // 确认密码输入
const authError = document.getElementById('authError'); // 认证错误信息
const currentUserDisplay = document.getElementById('currentUserDisplay'); // 当前用户显示
const logoutBtn = document.getElementById('logoutBtn'); // 登出按钮

// 预算相关元素
const budgetStatus = document.getElementById('budgetStatus'); // 预算状态
const budgetSummary = document.getElementById('budgetSummary'); // 预算摘要
const budgetWarning = document.getElementById('budgetWarning'); // 预算警告
const budgetInput = document.getElementById('budgetInput'); // 预算输入
const saveBudgetBtn = document.getElementById('saveBudgetBtn'); // 保存预算按钮

// 数据导出与备份元素
const exportCsvBtn = document.getElementById('exportCsvBtn'); // 导出CSV按钮
const exportExcelBtn = document.getElementById('exportExcelBtn'); // 导出Excel按钮
const backupBtn = document.getElementById('backupBtn'); // 备份按钮
const restoreBtn = document.getElementById('restoreBtn'); // 恢复按钮
const restoreFileInput = document.getElementById('restoreFileInput'); // 恢复文件输入
const backupStatus = document.getElementById('backupStatus'); // 备份状态

// AI 分析元素
const analyzeBtn = document.getElementById('analyzeBtn'); // AI分析按钮
const aiModal = document.getElementById('aiModal'); // AI分析模态框
const aiCloseBtn = document.getElementById('aiCloseBtn'); // 关闭AI模态框
const aiCloseFooterBtn = document.getElementById('aiCloseFooterBtn'); // 底部关闭AI模态框
const aiContent = document.getElementById('aiContent'); // AI分析内容

// API 配置：支持通过 <meta name="api-base" content="https://your-backend.example.com"> 覆盖
const API_BASE = (function() {
    try {
        const meta = document.querySelector('meta[name="api-base"]');
        const v = (meta && meta.content ? meta.content : '').trim();
        if (v) {
            console.log('[config] Using API_BASE from <meta>:', v);
            return v;
        }
    } catch (e) {}
    // 默认同源，相对路径
    return '';
})();

// API 请求辅助：在静态模式下直接抛错，避免误用
function apiFetch() {
    return Promise.reject(new Error('静态模式下不可用')); 
}

async function analyzeExpenses() {
    // 收集最近的交易（优先登录用户数据，否则用 local guest）
    const { transactions } = await getTransactionsForExport();
    if (!transactions || transactions.length === 0) {
        aiContent.innerHTML = '<p class="text-gray-500">暂无交易可分析。</p>';
        aiModal.classList.remove('hidden');
        return;
    }

    // 准备要发送给后端的精简数据（减小 payload）
    const sample = transactions.slice(0, 200).map(t => ({ date: t.date, type: t.type, amount: t.amount ?? (t.amountCents ? (t.amountCents/100) : 0), category: t.category ? t.category.name : '', note: t.note }));
    // 显示 loading 状态并打开模态
    aiContent.innerHTML = '<p class="text-gray-500">正在分析（这可能需要几秒钟）...</p>';
    aiModal.classList.remove('hidden');

    // 禁用触发按钮以防重复请求，并保存原始文本以便恢复
    let prevBtnText = null;
    if (analyzeBtn) {
        // 纯静态：从本地存储渲染最近交易
        transactionList.innerHTML = '';
        const key = 'transactions_guest';
        const raw = localStorage.getItem(key);
        let arr = [];
        try { arr = raw ? JSON.parse(raw) : []; } catch (e) { arr = []; }
        if (!Array.isArray(arr)) arr = [];
        if (arr.length === 0) {
            transactionList.innerHTML = `
                <div class="text-center py-10 text-gray-500">
                    <i class="fas fa-file-invoice-dollar text-4xl mb-3"></i>
                    <p>暂无交易记录</p>
                </div>
            `;
            updateFinancialSummary();
            return;
        }
        const normalized = arr.map(r => ({
            id: r.id,
            type: r.type,
            amountCents: typeof r.amountCents === 'number' ? r.amountCents : parseAmountToCents(r.amount),
            amount: centsToNumber(typeof r.amountCents === 'number' ? r.amountCents : parseAmountToCents(r.amount)),
            date: r.date,
            category: r.category,
            note: r.note,
            createdAt: r.createdAt || r.created_at
        }));
        normalized.sort((a,b) => new Date(b.date) - new Date(a.date));
        const recentTransactions = normalized.slice(0,10);
        recentTransactions.forEach(transaction => {
            const transactionItem = document.createElement('div');
            transactionItem.className = 'transaction-item flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-gray-200';
            transactionItem.dataset.id = transaction.id;
            const category = transaction.category || {};
            const isExpense = transaction.type === 'expense';
            const bg = category.color ? category.color + '20' : '#ddd';
            const icon = category.icon || 'question-circle';
            const color = category.color || '#999';
            const name = category.name || '未分类';
            transactionItem.innerHTML = `
                <div class="flex items-center">
                    <div class="w-10 h-10 rounded-full flex items-center justify-center mr-3" style="background-color: ${bg}">
                        <i class="fas fa-${icon}" style="color: ${color}"></i>
                    </div>
                    <div>
                        <p class="font-medium">${name}</p>
                        <p class="text-xs text-gray-500">${formatDate(transaction.date)}</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="font-bold ${isExpense ? 'text-danger' : 'text-secondary'}">${isExpense ? '-' : '+'}¥${Number(transaction.amount).toFixed(2)}</p>
                    ${transaction.note ? `<p class=\"text-xs text-gray-500\">${transaction.note}</p>` : ''}
                </div>
            `;
            transactionItem.addEventListener('click', () => openTransactionModal(transaction.id));
            transactionList.appendChild(transactionItem);
        });
        updateFinancialSummary();
    }
}

// ----------------- 应用初始化（恢复事件绑定与图表/分类渲染） -----------------
function init() {
    // 默认类型与分类渲染
    setTransactionType('expense');
    renderCategories();
    updateSaveButtonState();

    // 事件绑定：类型切换
    if (expenseBtn) expenseBtn.addEventListener('click', () => setTransactionType('expense'));
    if (incomeBtn) incomeBtn.addEventListener('click', () => setTransactionType('income'));

    // 输入与保存
    if (amountInput) amountInput.addEventListener('input', updateSaveButtonState);
    if (saveBtn) saveBtn.addEventListener('click', () => { if (!saveBtn.disabled) saveTransaction(); });

    // 交易模态相关
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (deleteTransactionBtn) deleteTransactionBtn.addEventListener('click', deleteCurrentTransaction);
    if (editTransactionBtn) editTransactionBtn.addEventListener('click', editCurrentTransaction);
    if (viewAllBtn) viewAllBtn.addEventListener('click', viewAllTransactions);
    if (closeAllTransactionsBtn) closeAllTransactionsBtn.addEventListener('click', () => allTransactionsModal.classList.add('hidden'));
    if (allTransactionsModal) allTransactionsModal.addEventListener('click', (e) => { if (e.target === allTransactionsModal) allTransactionsModal.classList.add('hidden'); });
    if (allSearchInput) allSearchInput.addEventListener('input', renderAllTransactions);
    if (allTypeFilter) allTypeFilter.addEventListener('change', renderAllTransactions);
    rangeButtons.forEach(btn => btn.addEventListener('click', () => {
        rangeButtons.forEach(b => b.classList.remove('bg-primary','text-white'));
        btn.classList.add('bg-primary','text-white');
        allRange = btn.dataset.range;
        allPage = 1;
        renderAllTransactions();
    }));
    if (applyCustomRange) applyCustomRange.addEventListener('click', () => { allRange = 'custom'; allPage = 1; renderAllTransactions(); });
    if (prevPageBtn) prevPageBtn.addEventListener('click', () => { if (allPage > 1) { allPage--; renderAllTransactions(); } });
    if (nextPageBtn) nextPageBtn.addEventListener('click', () => { allPage++; renderAllTransactions(true); });
    if (pageSizeSelect) pageSizeSelect.addEventListener('change', () => { allPageSize = Number(pageSizeSelect.value) || 10; allPage = 1; renderAllTransactions(); });

    // 时间筛选按钮
    timeFilterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            timeFilterBtns.forEach(b => {
                b.classList.remove('bg-primary', 'text-white');
                b.classList.add('bg-gray-100', 'text-gray-600');
            });
            btn.classList.remove('bg-gray-100', 'text-gray-600');
            btn.classList.add('bg-primary', 'text-white');
            updateTrendChart(btn.dataset.period);
        });
    });

    // 预算保存与回车快捷
    if (saveBudgetBtn) saveBudgetBtn.addEventListener('click', handleBudgetSave);
    if (budgetInput) budgetInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); handleBudgetSave(); } });

    // 导出 / 备份 / 恢复
    if (exportCsvBtn) exportCsvBtn.addEventListener('click', () => handleExport('csv'));
    if (exportExcelBtn) exportExcelBtn.addEventListener('click', () => handleExport('excel'));
    if (backupBtn) backupBtn.addEventListener('click', handleBackup);
    if (restoreBtn) restoreBtn.addEventListener('click', () => restoreFileInput && restoreFileInput.click());
    if (restoreFileInput) restoreFileInput.addEventListener('change', handleRestoreFile);

    // 初始化图表与数据
    initCharts();
    loadTransactions();
    loadBudget();
    updateCharts();
}

// ----------------- 备份与恢复功能 -----------------
async function handleBackup() {
    try {
        const payload = await buildBackupPayload();
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
        downloadBlob(blob, `backup-${buildFileTimestamp()}.json`);
        if (backupStatus) backupStatus.textContent = `上次备份：${new Date().toLocaleString()}`;
        showToast('备份已下载');
    } catch (e) {
        console.error('备份失败', e);
        showToast('备份失败');
    }
}

async function buildBackupPayload() {
    const payload = { exportedAt: new Date().toISOString(), transactions: [], budget: 0 };
    const raw = localStorage.getItem('transactions_guest');
    payload.transactions = raw ? JSON.parse(raw) : [];
    const b = localStorage.getItem('budget_guest');
    payload.budget = b ? Number(b) : 0;
    return payload;
}

function handleRestoreFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(ev) {
        try {
            const text = ev.target.result;
            const json = JSON.parse(text);
            await importBackupData(json);
            showToast('恢复完成');
            if (restoreFileInput) restoreFileInput.value = '';
            await loadTransactions();
            updateCharts();
        } catch (err) {
            console.error('恢复失败', err);
            showToast('恢复失败：文件格式错误或导入过程中出错');
        }
    };
    reader.readAsText(file, 'utf-8');
}

async function importBackupData(json) {
    if (!json || !Array.isArray(json.transactions)) throw new Error('无效备份格式');
    const transactions = json.transactions;
    const budget = Number(json.budget) || 0;
    localStorage.setItem('transactions_guest', JSON.stringify(transactions));
    localStorage.setItem('budget_guest', String(budget));
    if (backupStatus) backupStatus.textContent = `恢复：覆盖本地数据 ${transactions.length} 条`;
}

// 主题切换逻辑


// 设置交易类型
function setTransactionType(type) {
    currentType = type;
    selectedCategory = null;
    
    if (type === 'expense') {
        expenseBtn.classList.remove('bg-gray-100', 'text-gray-600');
        expenseBtn.classList.add('bg-danger', 'text-white');
        incomeBtn.classList.remove('bg-secondary', 'text-white');
        incomeBtn.classList.add('bg-gray-100', 'text-gray-600');
    } else {
        incomeBtn.classList.remove('bg-gray-100', 'text-gray-600');
        incomeBtn.classList.add('bg-secondary', 'text-white');
        expenseBtn.classList.remove('bg-danger', 'text-white');
        expenseBtn.classList.add('bg-gray-100', 'text-gray-600');
    }
    
    renderCategories();
    updateSaveButtonState();
}

// 渲染分类
function renderCategories() {
    categoryContainer.innerHTML = '';
    const categories = currentType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
    
    categories.forEach(category => {
        const categoryItem = document.createElement('div');
        categoryItem.className = `category-item flex flex-col items-center justify-center p-3 rounded-lg cursor-pointer transition-custom ${selectedCategory === category.id ? 'bg-primary/10' : 'bg-gray-50 hover:bg-gray-100'}`;
        categoryItem.dataset.id = category.id;
        
        categoryItem.innerHTML = `
            <div class="w-12 h-12 rounded-full flex items-center justify-center mb-1" style="background-color: ${category.color}20">
                <i class="fas fa-${category.icon}" style="color: ${category.color}"></i>
            </div>
            <span class="text-xs">${category.name}</span>
        `;
        
        categoryItem.addEventListener('click', () => {
            selectedCategory = category.id;
            renderCategories();
            updateSaveButtonState();
        });
        
        categoryContainer.appendChild(categoryItem);
    });
}

// 更新保存按钮状态
function updateSaveButtonState() {
    const amount = parseFloat(amountInput.value);
    saveBtn.disabled = isNaN(amount) || amount <= 0 || !selectedCategory;
}

// 保存交易（如已登录通过 API，否则写入本地 guest）
async function saveTransaction() {
    const amountInputValue = amountInput.value;
    const amountCents = parseAmountToCents(amountInputValue);
    const amount = centsToNumber(amountCents);
    const date = document.getElementById('dateInput').value;
    const note = document.getElementById('noteInput').value;
    const categories = currentType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
    const category = categories.find(c => c.id === selectedCategory);

    const payload = {
        type: currentType,
        // send amount as normalized number with two decimals so server storage remains compatible
        amount: amount,
        date: date,
        category: category,
        note: note
    };

    try {
        if (currentUser) {
            if (editingTransactionId) {
                await apiFetch(`/api/transactions/${editingTransactionId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                editingTransactionId = null;
            } else {
                await apiFetch('/api/transactions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }
        } else {
            // 游客模式：保存在 localStorage guest 键
            const key = 'transactions_guest';
            const raw = localStorage.getItem(key);
            const arr = raw ? JSON.parse(raw) : [];
            // store amount in cents to avoid float precision problems
            arr.push({ id: Date.now().toString(), ...payload, amountCents: amountCents, createdAt: new Date().toISOString() });
            localStorage.setItem(key, JSON.stringify(arr));
        }
    } catch (e) {
        console.error(e);
        showToast('保存交易失败');
        return;
    }

    // 重置表单
    amountInput.value = '';
    document.getElementById('noteInput').value = '';
    selectedCategory = null;
    renderCategories();
    updateSaveButtonState();

    // 更新界面
    await loadTransactions();
    updateCharts();

    showToast('记账成功！');
}

// 获取所有交易
// 获取本地（guest）或从缓存返回
function getTransactions() {
    // Only return server-loaded transactions when logged in.
    // Do not expose guest/local transactions in the main UI when not logged in.
    if (currentUser) return transactionsCache;
    // guest: return transactions from localStorage but normalize to include amountCents
    const key = 'transactions_guest';
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    try {
        const arr = JSON.parse(raw);
        if (!Array.isArray(arr)) return [];
        return arr.map(t => {
            // ensure amountCents exists
            if (typeof t.amountCents !== 'number') {
                t.amountCents = parseAmountToCents(t.amount);
            }
            return t;
        });
    } catch (e) {
        console.error('解析本地交易数据失败', e);
        return [];
    }
}

// 加载交易记录
// 加载交易：如果登录则从服务器拉取并渲染，否则从本地 guest 渲染
async function loadTransactions() {
    transactionList.innerHTML = '';
    if (!currentUser) {
        // 游客模式：从 localStorage 读取并渲染
        const key = 'transactions_guest';
        let arr = [];
        try {
            const raw = localStorage.getItem(key);
            arr = raw ? JSON.parse(raw) : [];
        } catch (e) {
            arr = [];
        }
        if (!Array.isArray(arr)) arr = [];
        if (arr.length === 0) {
            transactionList.innerHTML = `
                <div class="text-center py-10 text-gray-500">
                    <i class="fas fa-file-invoice-dollar text-4xl mb-3"></i>
                    <p>暂无交易记录</p>
                </div>
            `;
            updateFinancialSummary();
            return;
        }
        const normalized = arr.map(r => ({
            id: r.id,
            type: r.type,
            amountCents: typeof r.amountCents === 'number' ? r.amountCents : parseAmountToCents(r.amount),
            amount: centsToNumber(typeof r.amountCents === 'number' ? r.amountCents : parseAmountToCents(r.amount)),
            date: r.date,
            category: r.category,
            note: r.note,
            createdAt: r.createdAt || r.created_at
        }));
        normalized.sort((a,b) => new Date(b.date) - new Date(a.date));
        const recentTransactions = normalized.slice(0,10);
        recentTransactions.forEach(transaction => {
            const transactionItem = document.createElement('div');
            transactionItem.className = 'transaction-item flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-gray-200';
            transactionItem.dataset.id = transaction.id;
            const category = transaction.category || {};
            const isExpense = transaction.type === 'expense';
            const bg = category.color ? category.color + '20' : '#ddd';
            const icon = category.icon || 'question-circle';
            const color = category.color || '#999';
            const name = category.name || '未分类';
            transactionItem.innerHTML = `
                <div class="flex items-center">
                    <div class="w-10 h-10 rounded-full flex items-center justify-center mr-3" style="background-color: ${bg}">
                        <i class="fas fa-${icon}" style="color: ${color}"></i>
                    </div>
                    <div>
                        <p class="font-medium">${name}</p>
                        <p class="text-xs text-gray-500">${formatDate(transaction.date)}</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="font-bold ${isExpense ? 'text-danger' : 'text-secondary'}">${isExpense ? '-' : '+'}¥${Number(transaction.amount).toFixed(2)}</p>
                    ${transaction.note ? `<p class=\"text-xs text-gray-500\">${transaction.note}</p>` : ''}
                </div>
            `;
            transactionItem.addEventListener('click', () => openTransactionModal(transaction.id));
            transactionList.appendChild(transactionItem);
        });
        updateFinancialSummary();
        return;
    }

    // 登录用户：从服务器拉取
    try {
    const res = await apiFetch('/api/transactions');
        if (!res.ok) {
            let errMsg = '加载失败';
            try { const err = await res.json(); errMsg = err.error || JSON.stringify(err); } catch(e) {}
            throw new Error(`fetch failed: ${res.status} ${errMsg}`);
        }
        const data = await res.json();
        transactionsCache = data.transactions.map(r => ({
            id: r.id,
            type: r.type,
            // keep original amount field for compatibility, but also compute integer cents for calculations
            amount: Number(r.amount),
            amountCents: Math.round(Number(r.amount) * 100),
            date: r.date,
            category: { id: r.category_id, name: r.category_name, color: r.category_color, icon: r.category_icon },
            note: r.note,
            createdAt: r.created_at
        }));
        // 渲染
        if (transactionsCache.length === 0) {
            transactionList.innerHTML = `
                <div class="text-center py-10 text-gray-500">
                    <i class="fas fa-file-invoice-dollar text-4xl mb-3"></i>
                    <p>暂无交易记录</p>
                </div>
            `;
            updateFinancialSummary();
            return;
        }
        transactionsCache.sort((a,b) => new Date(b.date) - new Date(a.date));
        const recentTransactions = transactionsCache.slice(0,10);
        recentTransactions.forEach(transaction => {
            const transactionItem = document.createElement('div');
            transactionItem.className = 'transaction-item flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-gray-200';
            transactionItem.dataset.id = transaction.id;
            const category = transaction.category;
            const isExpense = transaction.type === 'expense';
            transactionItem.innerHTML = `
                <div class="flex items-center">
                    <div class="w-10 h-10 rounded-full flex items-center justify-center mr-3" style="background-color: ${category.color}20">
                        <i class="fas fa-${category.icon}" style="color: ${category.color}"></i>
                    </div>
                    <div>
                        <p class="font-medium">${category.name}</p>
                        <p class="text-xs text-gray-500">${formatDate(transaction.date)}</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="font-bold ${isExpense ? 'text-danger' : 'text-secondary'}">${isExpense ? '-' : '+'}¥${transaction.amount.toFixed(2)}</p>
                    ${transaction.note ? `<p class="text-xs text-gray-500">${transaction.note}</p>` : ''}
                </div>
            `;
            transactionItem.addEventListener('click', () => openTransactionModal(transaction.id));
            transactionList.appendChild(transactionItem);
        });
        updateFinancialSummary();
    } catch (e) {
        console.error(e);
        transactionList.innerHTML = `
            <div class="text-center py-10 text-gray-500">
                <p>加载交易失败：${e.message}</p>
            </div>
        `;
    }
}

// 更新财务摘要
function updateFinancialSummary() {
    const transactions = getTransactions();
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // 计算本月收支
    const monthlyTransactions = transactions.filter(t => {
        const transactionDate = new Date(t.date);
        return transactionDate.getMonth() === currentMonth && transactionDate.getFullYear() === currentYear;
    });
    
    // 使用分（cents）进行计算以避免浮点误差
    const monthlyIncomeCents = monthlyTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + getAmountCents(t), 0);

    const monthlyExpenseCents = monthlyTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + getAmountCents(t), 0);

    const totalBalanceCents = transactions
        .reduce((sum, t) => sum + (t.type === 'income' ? getAmountCents(t) : -getAmountCents(t)), 0);
    
    // 计算上月数据用于比较
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    
    const lastMonthTransactions = transactions.filter(t => {
        const transactionDate = new Date(t.date);
        return transactionDate.getMonth() === lastMonth && transactionDate.getFullYear() === lastYear;
    });
    
    const lastMonthIncome = lastMonthTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
    
    const lastMonthExpense = lastMonthTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
    
    // 纯静态：始终展示本地计算结果
    document.getElementById('totalBalance').textContent = `¥${centsToNumber(totalBalanceCents).toFixed(2)}`;
    document.getElementById('monthlyIncome').textContent = `¥${centsToNumber(monthlyIncomeCents).toFixed(2)}`;
    document.getElementById('monthlyExpense').textContent = `¥${centsToNumber(monthlyExpenseCents).toFixed(2)}`;
    
    // 计算本月变化
    const monthChange = centsToNumber(monthlyIncomeCents - monthlyExpenseCents);
    document.getElementById('monthChange').textContent = `${monthChange >= 0 ? '+' : ''}¥${monthChange.toFixed(2)}`;
    
    // 计算同比变化
    const incomeChange = lastMonthIncome === 0 ? 0 : ((centsToNumber(monthlyIncomeCents) - lastMonthIncome) / lastMonthIncome) * 100;
    const expenseChange = lastMonthExpense === 0 ? 0 : ((centsToNumber(monthlyExpenseCents) - lastMonthExpense) / lastMonthExpense) * 100;
    
    document.getElementById('incomeChange').textContent = (incomeChange >= 0 ? `+${incomeChange.toFixed(2)}%` : `${incomeChange.toFixed(2)}%`);
    document.getElementById('expenseChange').textContent = (expenseChange >= 0 ? `+${expenseChange.toFixed(2)}%` : `${expenseChange.toFixed(2)}%`);

    currentMonthlyExpense = centsToNumber(monthlyExpenseCents);
    updateBudgetUI();
}

// 初始化图表
function initCharts() {
    // 趋势图
    const trendCtx = document.getElementById('trendChart').getContext('2d');
    trendChart = new Chart(trendCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: '收入',
                    data: [],
                    borderColor: '#10B981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.3,
                    fill: true
                },
                {
                    label: '支出',
                    data: [],
                    borderColor: '#EF4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.3,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '¥' + value;
                        }
                    }
                }
            }
        }
    });
    
    // 支出分类饼图
    const categoryCtx = document.getElementById('categoryChart').getContext('2d');
    categoryChart = new Chart(categoryCtx, {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            cutout: '70%'
        }
    });
    
    // 收入分类饼图
    const incomeCategoryCtx = document.getElementById('incomeCategoryChart').getContext('2d');
    incomeCategoryChart = new Chart(incomeCategoryCtx, {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            cutout: '70%'
        }
    });
    
    // 月度收支对比柱状图
    const monthlyComparisonCtx = document.getElementById('monthlyComparisonChart').getContext('2d');
    monthlyComparisonChart = new Chart(monthlyComparisonCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [
                {
                    label: '收入',
                    data: [],
                    backgroundColor: 'rgba(16, 185, 129, 0.8)',
                    borderColor: '#10B981',
                    borderWidth: 1
                },
                {
                    label: '支出',
                    data: [],
                    backgroundColor: 'rgba(239, 68, 68, 0.8)',
                    borderColor: '#EF4444',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '¥' + value;
                        }
                    }
                }
            }
        }
    });
    
    // 收支比例饼图
    const incomeExpenseRatioCtx = document.getElementById('incomeExpenseRatioChart').getContext('2d');
    incomeExpenseRatioChart = new Chart(incomeExpenseRatioCtx, {
        type: 'pie',
        data: {
            labels: ['收入', '支出'],
            datasets: [{
                data: [0, 0],
                backgroundColor: ['#10B981', '#EF4444'],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                            return `${label}: ¥${value.toFixed(2)} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
    
    updateCharts();
}

// 更新图表
function updateCharts() {
    updateTrendChart('month');
    updateCategoryChart();
    updateIncomeCategoryChart();
    updateMonthlyComparisonChart();
    updateIncomeExpenseRatioChart();
}

// 清空图表数据的辅助函数
function resetChartsData() {
    try {
        if (trendChart) {
            trendChart.data.labels = [];
            if (trendChart.data.datasets && trendChart.data.datasets[0]) trendChart.data.datasets[0].data = [];
            if (trendChart.data.datasets && trendChart.data.datasets[1]) trendChart.data.datasets[1].data = [];
            trendChart.update();
        }
    } catch (e) {}
    try {
        if (categoryChart) {
            categoryChart.data.labels = [];
            if (categoryChart.data.datasets && categoryChart.data.datasets[0]) {
                categoryChart.data.datasets[0].data = [];
                categoryChart.data.datasets[0].backgroundColor = [];
            }
            categoryChart.update();
        }
    } catch (e) {}
    try {
        if (incomeCategoryChart) {
            incomeCategoryChart.data.labels = [];
            if (incomeCategoryChart.data.datasets && incomeCategoryChart.data.datasets[0]) {
                incomeCategoryChart.data.datasets[0].data = [];
                incomeCategoryChart.data.datasets[0].backgroundColor = [];
            }
            incomeCategoryChart.update();
        }
    } catch (e) {}
    try {
        if (monthlyComparisonChart) {
            monthlyComparisonChart.data.labels = [];
            if (monthlyComparisonChart.data.datasets && monthlyComparisonChart.data.datasets[0]) monthlyComparisonChart.data.datasets[0].data = [];
            if (monthlyComparisonChart.data.datasets && monthlyComparisonChart.data.datasets[1]) monthlyComparisonChart.data.datasets[1].data = [];
            monthlyComparisonChart.update();
        }
    } catch (e) {}
    try {
        if (incomeExpenseRatioChart && incomeExpenseRatioChart.data && incomeExpenseRatioChart.data.datasets && incomeExpenseRatioChart.data.datasets[0]) {
            incomeExpenseRatioChart.data.datasets[0].data = [0, 0];
            incomeExpenseRatioChart.update();
        }
    } catch (e) {}
}

// 更新趋势图
function updateTrendChart(period) {
    const transactions = getTransactions();
    const now = new Date();
    let labels = [];
    let incomeData = [];
    let expenseData = [];
    
    if (period === 'month') {
        // 最近30天
        for (let i = 29; i >= 0; i--) {
            const date = new Date();
            date.setDate(now.getDate() - i);
            const dateStr = formatDate(date);
            labels.push(dateStr);
            
            const dayTransactions = transactions.filter(t => t.date === dateStr);
            const dayIncomeCents = dayTransactions
                .filter(t => t.type === 'income')
                .reduce((sum, t) => sum + getAmountCents(t), 0);

            const dayExpenseCents = dayTransactions
                .filter(t => t.type === 'expense')
                .reduce((sum, t) => sum + getAmountCents(t), 0);
            
            incomeData.push(centsToNumber(dayIncomeCents));
            expenseData.push(centsToNumber(dayExpenseCents));
        }
    } else if (period === 'quarter') {
        // 最近3个月，按周统计
        for (let i = 11; i >= 0; i--) {
            const weekStart = new Date();
            weekStart.setDate(now.getDate() - i * 7);
            const weekLabel = `第${Math.floor((now - weekStart) / (7 * 24 * 60 * 60 * 1000)) + 1}周`;
            labels.push(weekLabel);
            
            const weekTransactions = transactions.filter(t => {
                const transactionDate = new Date(t.date);
                const diffDays = Math.floor((weekStart - transactionDate) / (24 * 60 * 60 * 1000));
                return diffDays >= 0 && diffDays < 7;
            });
            const weekIncomeCents = weekTransactions
                .filter(t => t.type === 'income')
                .reduce((sum, t) => sum + getAmountCents(t), 0);

            const weekExpenseCents = weekTransactions
                .filter(t => t.type === 'expense')
                .reduce((sum, t) => sum + getAmountCents(t), 0);

            incomeData.push(centsToNumber(weekIncomeCents));
            expenseData.push(centsToNumber(weekExpenseCents));
        }
    } else if (period === 'year') {
        // 最近12个月
        for (let i = 11; i >= 0; i--) {
            const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthLabel = `${monthDate.getFullYear()}年${monthDate.getMonth() + 1}月`;
            labels.push(monthLabel);
            
            const monthTransactions = transactions.filter(t => {
                const transactionDate = new Date(t.date);
                return transactionDate.getMonth() === monthDate.getMonth() && 
                       transactionDate.getFullYear() === monthDate.getFullYear();
            });
            const monthIncomeCents = monthTransactions
                .filter(t => t.type === 'income')
                .reduce((sum, t) => sum + getAmountCents(t), 0);

            const monthExpenseCents = monthTransactions
                .filter(t => t.type === 'expense')
                .reduce((sum, t) => sum + getAmountCents(t), 0);

            incomeData.push(centsToNumber(monthIncomeCents));
            expenseData.push(centsToNumber(monthExpenseCents));
        }
    }
    
    trendChart.data.labels = labels;
    trendChart.data.datasets[0].data = incomeData;
    trendChart.data.datasets[1].data = expenseData;
    trendChart.update();
}

// 更新分类图表
function updateCategoryChart() {
    const transactions = getTransactions();
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // 获取本月支出
    const monthlyExpenses = transactions.filter(t => {
        const transactionDate = new Date(t.date);
        return t.type === 'expense' && 
               transactionDate.getMonth() === currentMonth && 
               transactionDate.getFullYear() === currentYear;
    });
    
    // 按分类统计
    const categoryStats = {};
    monthlyExpenses.forEach(t => {
        const categoryId = t.category.id;
        if (!categoryStats[categoryId]) {
            categoryStats[categoryId] = {
                name: t.category.name,
                amountCents: 0,
                color: t.category.color
            };
        }
        categoryStats[categoryId].amountCents += getAmountCents(t);
    });
    
    // 转换为数组并排序
    const categories = Object.values(categoryStats).sort((a, b) => b.amountCents - a.amountCents);
    
    // 更新图表
    categoryChart.data.labels = categories.map(c => c.name);
    categoryChart.data.datasets[0].data = categories.map(c => centsToNumber(c.amountCents));
    categoryChart.data.datasets[0].backgroundColor = categories.map(c => c.color);
    categoryChart.update();
    
    // 更新分类列表
    const categoryList = document.getElementById('categoryList');
    categoryList.innerHTML = '';
    
    if (categories.length === 0) {
        categoryList.innerHTML = `
            <div class="text-center py-4 text-gray-500 text-sm">
                本月暂无支出
            </div>
        `;
        return;
    }
    
    const totalExpense = categories.reduce((sum, c) => sum + c.amountCents, 0);
    
    categories.forEach(category => {
    const percentage = totalExpense > 0 ? (category.amountCents / totalExpense) * 100 : 0;
        const categoryItem = document.createElement('div');
        categoryItem.className = 'flex items-center justify-between';
        
        categoryItem.innerHTML = `
            <div class="flex items-center">
                <div class="w-3 h-3 rounded-full mr-2" style="background-color: ${category.color}"></div>
                <span class="text-sm">${category.name}</span>
            </div>
            <div class="text-right">
                <span class="text-sm font-medium">¥${centsToNumber(category.amountCents).toFixed(2)}</span>
                <span class="text-xs text-gray-500 ml-1">(${percentage.toFixed(1)}%)</span>
            </div>
        `;
        
        categoryList.appendChild(categoryItem);
    });
}

// 更新收入分类图表
function updateIncomeCategoryChart() {
    const transactions = getTransactions();
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // 获取本月收入
    const monthlyIncomes = transactions.filter(t => {
        const transactionDate = new Date(t.date);
        return t.type === 'income' && 
               transactionDate.getMonth() === currentMonth && 
               transactionDate.getFullYear() === currentYear;
    });
    
    // 按分类统计
    const categoryStats = {};
    monthlyIncomes.forEach(t => {
        const categoryId = t.category.id;
        if (!categoryStats[categoryId]) {
            categoryStats[categoryId] = {
                name: t.category.name,
                amountCents: 0,
                color: t.category.color
            };
        }
        categoryStats[categoryId].amountCents += getAmountCents(t);
    });
    
    // 转换为数组并排序
    const categories = Object.values(categoryStats).sort((a, b) => b.amountCents - a.amountCents);
    
    // 更新图表
    incomeCategoryChart.data.labels = categories.map(c => c.name);
    incomeCategoryChart.data.datasets[0].data = categories.map(c => centsToNumber(c.amountCents));
    incomeCategoryChart.data.datasets[0].backgroundColor = categories.map(c => c.color);
    incomeCategoryChart.update();
    
    // 更新收入分类列表
    const incomeCategoryList = document.getElementById('incomeCategoryList');
    incomeCategoryList.innerHTML = '';
    
    if (categories.length === 0) {
        incomeCategoryList.innerHTML = `
            <div class="text-center py-4 text-gray-500 text-sm">
                本月暂无收入
            </div>
        `;
        return;
    }
    
    const totalIncome = categories.reduce((sum, c) => sum + c.amountCents, 0);
    
    categories.forEach(category => {
        const percentage = totalIncome > 0 ? (category.amountCents / totalIncome) * 100 : 0;
        const categoryItem = document.createElement('div');
        categoryItem.className = 'flex items-center justify-between';
        
        categoryItem.innerHTML = `
            <div class="flex items-center">
                <div class="w-3 h-3 rounded-full mr-2" style="background-color: ${category.color}"></div>
                <span class="text-sm">${category.name}</span>
            </div>
            <div class="text-right">
                <span class="text-sm font-medium">¥${centsToNumber(category.amountCents).toFixed(2)}</span>
                <span class="text-xs text-gray-500 ml-1">(${percentage.toFixed(1)}%)</span>
            </div>
        `;
        
        incomeCategoryList.appendChild(categoryItem);
    });
}

// 更新月度收支对比图表
function updateMonthlyComparisonChart() {
    const transactions = getTransactions();
    const now = new Date();
    
    // 获取最近6个月的数据
    const labels = [];
    const incomeData = [];
    const expenseData = [];
    
    for (let i = 5; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthLabel = `${monthDate.getFullYear()}年${monthDate.getMonth() + 1}月`;
        labels.push(monthLabel);
        
        const monthTransactions = transactions.filter(t => {
            const transactionDate = new Date(t.date);
            return transactionDate.getMonth() === monthDate.getMonth() && 
                   transactionDate.getFullYear() === monthDate.getFullYear();
        });
        
        const monthIncomeCents = monthTransactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + getAmountCents(t), 0);

        const monthExpenseCents = monthTransactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + getAmountCents(t), 0);

        incomeData.push(centsToNumber(monthIncomeCents));
        expenseData.push(centsToNumber(monthExpenseCents));
    }
    
    monthlyComparisonChart.data.labels = labels;
    monthlyComparisonChart.data.datasets[0].data = incomeData;
    monthlyComparisonChart.data.datasets[1].data = expenseData;
    monthlyComparisonChart.update();
}

// 更新收支比例图表
function updateIncomeExpenseRatioChart() {
    const transactions = getTransactions();
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // 获取本月收支
    const monthlyTransactions = transactions.filter(t => {
        const transactionDate = new Date(t.date);
        return transactionDate.getMonth() === currentMonth && 
               transactionDate.getFullYear() === currentYear;
    });
    
    const monthlyIncomeCents = monthlyTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + getAmountCents(t), 0);

    const monthlyExpenseCents = monthlyTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + getAmountCents(t), 0);

    incomeExpenseRatioChart.data.datasets[0].data = [centsToNumber(monthlyIncomeCents), centsToNumber(monthlyExpenseCents)];
    incomeExpenseRatioChart.update();
}

// 预算相关
async function loadBudget() {
    let amount = 0;
    if (currentUser) {
        try {
            const res = await apiFetch('/api/budget');
            if (res.ok) {
                const data = await res.json();
                amount = Number(data.amount) || 0;
            }
        } catch (e) {
            console.error('加载预算失败', e);
        }
    } else {
        const raw = localStorage.getItem('budget_guest');
        amount = raw ? Number(raw) : 0;
        if (Number.isNaN(amount)) amount = 0;
    }
    currentBudgetAmount = Math.max(0, Number(amount) || 0);
    if (budgetInput && document.activeElement !== budgetInput) {
        budgetInput.value = currentBudgetAmount > 0 ? currentBudgetAmount.toFixed(2) : '';
    }
    updateBudgetUI();
}

async function handleBudgetSave() {
    if (!budgetInput) return;
    const value = Number(budgetInput.value);
    if (Number.isNaN(value) || value < 0) {
        showToast('请输入有效的预算金额');
        return;
    }
    const normalized = Math.round(value * 100) / 100;
    try {
        localStorage.setItem('budget_guest', String(normalized));
        currentBudgetAmount = normalized;
        if (budgetInput) budgetInput.value = currentBudgetAmount.toFixed(2);
        updateBudgetUI();
        showToast('预算已更新');
    } catch (e) {
        console.error(e);
        showToast('保存预算失败');
    }
}

function updateBudgetUI() {
    if (budgetStatus) {
        budgetStatus.textContent = `当前预算：¥${currentBudgetAmount.toFixed(2)}`;
    }
    if (budgetSummary) {
        if (currentBudgetAmount > 0) {
            const remaining = currentBudgetAmount - currentMonthlyExpense;
            const remainingText = remaining >= 0 ? `剩余 ¥${remaining.toFixed(2)}` : `超出 ¥${Math.abs(remaining).toFixed(2)}`;
            budgetSummary.textContent = `本月已支出 ¥${currentMonthlyExpense.toFixed(2)}，${remainingText}。`;
            budgetSummary.classList.toggle('text-danger', remaining < 0);
        } else {
            budgetSummary.textContent = `尚未设置预算。本月已支出 ¥${currentMonthlyExpense.toFixed(2)}。`;
            budgetSummary.classList.remove('text-danger');
        }
    }
    if (currentBudgetAmount > 0 && currentMonthlyExpense > currentBudgetAmount) {
        const exceeded = currentMonthlyExpense - currentBudgetAmount;
        if (budgetWarning) {
            budgetWarning.textContent = `注意：本月已超出预算 ¥${exceeded.toFixed(2)}！`;
            budgetWarning.classList.remove('hidden');
        }
        if (!budgetExceeded) {
            showToast('已超出预算，请注意控制支出');
        }
        budgetExceeded = true;
    } else {
        if (budgetWarning) {
            budgetWarning.classList.add('hidden');
        }
        budgetExceeded = false;
    }
}

async function handleExport(format) {
    const { transactions, source } = await getTransactionsForExport();
    if (!currentUser && source !== 'guest') {
        showToast('请先登录以导出数据');
        return;
    }
    if (!transactions || transactions.length === 0) {
        showToast('暂无可导出的交易数据');
        return;
    }
    const rows = prepareExportRows(transactions);
    if (format === 'csv') {
        exportTransactionsToCsv(rows);
    } else {
        exportTransactionsToExcel(rows);
    }
}

async function getTransactionsForExport() {
    const key = 'transactions_guest';
    const raw = localStorage.getItem(key);
    if (!raw) return { transactions: [], source: 'guest' };
    try {
        const arr = JSON.parse(raw);
        return { transactions: Array.isArray(arr) ? arr : [], source: 'guest' };
    } catch (e) {
        console.error('解析本地交易数据失败', e);
        return { transactions: [], source: 'guest' };
    }
}

function prepareExportRows(transactions) {
    return [...transactions]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .map(t => {
            const categoryName = t.category ? (t.category.name || '') : '';
            const amountNum = centsToNumber(getAmountCents(t));
            return {
                date: formatDate(t.date),
                type: t.type === 'income' ? '收入' : '支出',
                amount: amountNum.toFixed(2),
                category: categoryName,
                note: (t.note || '').replace(/\r?\n/g, ' ').trim()
            };
        });
}

function exportTransactionsToCsv(rows) {
    const headers = ['日期', '类型', '金额', '分类', '备注'];
    const lines = [
        headers,
        ...rows.map(r => [r.date, r.type, r.amount, r.category, r.note])
    ].map(cols => cols.map(sanitizeCsvValue).join(',')).join('\r\n');
    const content = '\uFEFF' + lines;
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `transactions-${buildFileTimestamp()}.csv`);
}

function exportTransactionsToExcel(rows) {
    const headers = ['日期', '类型', '金额', '分类', '备注'];
    const headerHtml = headers.map(h => `<th style="background:#f3f4f6;border:1px solid #d1d5db;padding:6px 10px;text-align:left;">${escapeHtml(h)}</th>`).join('');
    const bodyHtml = rows.map(r => `
        <tr>
            <td style="border:1px solid #d1d5db;padding:6px 10px;">${escapeHtml(r.date)}</td>
            <td style="border:1px solid #d1d5db;padding:6px 10px;">${escapeHtml(r.type)}</td>
            <td style="border:1px solid #d1d5db;padding:6px 10px;">${escapeHtml(r.amount)}</td>
            <td style="border:1px solid #d1d5db;padding:6px 10px;">${escapeHtml(r.category)}</td>
            <td style="border:1px solid #d1d5db;padding:6px 10px;">${escapeHtml(r.note)}</td>
        </tr>`).join('');
    const html = `
        <html>
            <head><meta charset="UTF-8" /></head>
            <body>
                <table style="border-collapse:collapse;">
                    <thead><tr>${headerHtml}</tr></thead>
                    <tbody>${bodyHtml}</tbody>
                </table>
            </body>
        </html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    downloadBlob(blob, `transactions-${buildFileTimestamp()}.xls`);
}

function sanitizeCsvValue(value) {
    const str = (value ?? '').toString().replace(/"/g, '""');
    if (/[",\r\n]/.test(str)) {
        return `"${str}"`;
    }
    return str;
}

function escapeHtml(value) {
    return (value ?? '').toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function buildFileTimestamp() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mi = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// 打开交易详情模态框
function openTransactionModal(transactionId) {
    const transactions = getTransactions();
    const transaction = transactions.find(t => t.id === transactionId);
    
    if (!transaction) return;
    
    const isExpense = transaction.type === 'expense';
    
    modalContent.innerHTML = `
        <div class="flex justify-between items-center pb-4 border-b">
            <h4 class="font-medium">${transaction.category.name}</h4>
            <span class="text-2xl font-bold ${isExpense ? 'text-danger' : 'text-secondary'}">${isExpense ? '-' : '+'}¥${transaction.amount.toFixed(2)}</span>
        </div>
        <div class="grid grid-cols-2 gap-4">
            <div>
                <p class="text-xs text-gray-500">日期</p>
                <p class="font-medium">${formatDate(transaction.date)}</p>
            </div>
            <div>
                <p class="text-xs text-gray-500">类型</p>
                <p class="font-medium">${isExpense ? '支出' : '收入'}</p>
            </div>
        </div>
        ${transaction.note ? `
            <div>
                <p class="text-xs text-gray-500">备注</p>
                <p class="font-medium">${transaction.note}</p>
            </div>
        ` : ''}
    `;
    
    // 保存当前交易ID到按钮上，以便删除和编辑
    deleteTransactionBtn.dataset.id = transactionId;
    editTransactionBtn.dataset.id = transactionId;
    
    transactionModal.classList.remove('hidden');
}

// 关闭模态框
function closeModal() {
    transactionModal.classList.add('hidden');
}

// 删除当前交易
function deleteCurrentTransaction() {
    const transactionId = deleteTransactionBtn.dataset.id;
    if (!transactionId) return;
    (async () => {
        try {
            if (currentUser) {
                await deleteTransactionById(transactionId);
            } else {
                // guest
                const key = 'transactions_guest';
                const raw = localStorage.getItem(key);
                const arr = raw ? JSON.parse(raw) : [];
                const updated = arr.filter(t => t.id !== transactionId);
                localStorage.setItem(key, JSON.stringify(updated));
            }
            closeModal();
            await loadTransactions();
            updateCharts();
            showToast('交易已删除！');
        } catch (e) {
            console.error(e);
            showToast('删除失败');
        }
    })();
}

// 编辑当前交易
function editCurrentTransaction() {
    const transactionId = editTransactionBtn.dataset.id;
    if (!transactionId) return;
    // 从缓存或本地找到交易
    const transaction = transactionsCache.find(t => t.id === transactionId) || (getTransactions().find(t => t.id === transactionId));
    if (!transaction) return;
    // 填充表单进行编辑
    editingTransactionId = transactionId;
    setTransactionType(transaction.type);
    amountInput.value = transaction.amount;
    document.getElementById('dateInput').value = transaction.date;
    document.getElementById('noteInput').value = transaction.note || '';
    selectedCategory = transaction.category ? transaction.category.id : null;
    renderCategories();
    updateSaveButtonState();
    closeModal();
    document.querySelector('.lg\\:col-span-1').scrollIntoView({ behavior: 'smooth' });
    showToast('请修改交易信息并保存');
}

// 查看所有交易
function viewAllTransactions() {
    renderAllTransactions();
    allTransactionsModal.classList.remove('hidden');
}

function renderAllTransactions() {
    const q = (allSearchInput && allSearchInput.value || '').trim().toLowerCase();
    const typeFilter = (allTypeFilter && allTypeFilter.value) || 'all';
    let list = getTransactions()
        .map(t => ({
            id: t.id,
            type: t.type,
            amountCents: getAmountCents(t),
            amount: centsToNumber(getAmountCents(t)),
            date: t.date,
            category: t.category || { name: '未分类', icon: 'question-circle', color: '#999' },
            note: t.note || '',
            createdAt: t.createdAt || t.created_at
        }))
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    // 日期范围过滤
    const { start, end } = computeRange(allRange);
    list = list.filter(t => {
        const d = new Date(t.date);
        return (!start || d >= start) && (!end || d <= end);
    });

    const filtered = list.filter(t => {
        const matchType = typeFilter === 'all' ? true : (t.type === typeFilter);
        const hay = `${t.note} ${t.category.name}`.toLowerCase();
        const matchQ = q ? hay.includes(q) : true;
        return matchType && matchQ;
    });

    allTransactionsList.innerHTML = '';
    if (filtered.length === 0) {
        allTransactionsList.innerHTML = `
            <div class="text-center py-6 text-gray-500">
                暂无匹配的交易记录
            </div>
        `;
        return;
    }

    // 分页
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / allPageSize));
    if (allPage > totalPages) allPage = totalPages;
    const startIdx = (allPage - 1) * allPageSize;
    const pageItems = filtered.slice(startIdx, startIdx + allPageSize);
    if (paginationInfo) paginationInfo.textContent = `第 ${totalPages === 0 ? 0 : allPage}/${totalPages} 页，共 ${total} 条`;
    if (prevPageBtn) prevPageBtn.disabled = allPage <= 1;
    if (nextPageBtn) nextPageBtn.disabled = allPage >= totalPages;

    pageItems.forEach(t => {
        const isExpense = t.type === 'expense';
        const bg = t.category.color ? t.category.color + '20' : '#ddd';
        const item = document.createElement('div');
        item.className = 'flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-gray-200';
        item.innerHTML = `
            <div class="flex items-center">
                <div class="w-10 h-10 rounded-full flex items-center justify-center mr-3" style="background-color: ${bg}">
                    <i class="fas fa-${t.category.icon}" style="color: ${t.category.color}"></i>
                </div>
                <div>
                    <p class="font-medium">${t.category.name}</p>
                    <p class="text-xs text-gray-500">${formatDate(t.date)}</p>
                </div>
            </div>
            <div class="flex items-center gap-3">
                <span class="font-bold ${isExpense ? 'text-danger' : 'text-secondary'}">${isExpense ? '-' : '+'}¥${t.amount.toFixed(2)}</span>
                <button class="px-2 py-1 text-sm border rounded hover:bg-gray-50" data-action="edit" data-id="${t.id}">编辑</button>
                <button class="px-2 py-1 text-sm border rounded hover:bg-gray-50" data-action="delete" data-id="${t.id}">删除</button>
            </div>
        `;
        // 打开详情
        item.querySelector('.font-medium').addEventListener('click', () => openTransactionModal(t.id));
        // 编辑
        item.querySelector('[data-action="edit"]').addEventListener('click', () => {
            // 复用单条编辑逻辑
            editTransactionById(t.id);
        });
        // 删除
        item.querySelector('[data-action="delete"]').addEventListener('click', async () => {
            await deleteTransactionDirect(t.id);
        });
        allTransactionsList.appendChild(item);
    });
}

function computeRange(range) {
    const now = new Date();
    // 归一到本地日期 00:00
    const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const endOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

    if (range === 'day') {
        const s = startOfDay(now); const e = endOfDay(now);
        return { start: s, end: e };
    }
    if (range === 'week') {
        const d = new Date(now);
        const day = d.getDay(); // 0-6, 周日为0
        const diffToMonday = (day + 6) % 7; // 将周一视为一周起点
        const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - diffToMonday);
        const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
        return { start: startOfDay(monday), end: endOfDay(sunday) };
    }
    if (range === 'month') {
        const s = new Date(now.getFullYear(), now.getMonth(), 1);
        const e = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        return { start: s, end: e };
    }
    if (range === 'quarter') {
        const q = Math.floor(now.getMonth() / 3); // 0..3
        const startMonth = q * 3;
        const s = new Date(now.getFullYear(), startMonth, 1);
        const e = new Date(now.getFullYear(), startMonth + 3, 0, 23, 59, 59, 999);
        return { start: s, end: e };
    }
    if (range === 'year') {
        const s = new Date(now.getFullYear(), 0, 1);
        const e = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        return { start: s, end: e };
    }
    if (range === 'custom') {
        let s = customStart && customStart.value ? new Date(customStart.value) : null;
        let e = customEnd && customEnd.value ? new Date(customEnd.value) : null;
        if (s) s = startOfDay(s);
        if (e) e = endOfDay(e);
        return { start: s, end: e };
    }
    return { start: null, end: null };
}

function editTransactionById(id) {
    const transaction = getTransactions().find(t => t.id === id);
    if (!transaction) return;
    editingTransactionId = id;
    setTransactionType(transaction.type);
    amountInput.value = centsToNumber(getAmountCents(transaction));
    document.getElementById('dateInput').value = transaction.date;
    document.getElementById('noteInput').value = transaction.note || '';
    selectedCategory = transaction.category ? transaction.category.id : null;
    renderCategories();
    updateSaveButtonState();
    allTransactionsModal.classList.add('hidden');
    document.querySelector('.lg\:col-span-1').scrollIntoView({ behavior: 'smooth' });
    showToast('已载入至表单，请修改后保存');
}

async function deleteTransactionDirect(id) {
    try {
        if (currentUser) {
            await deleteTransactionById(id);
        } else {
            const key = 'transactions_guest';
            const raw = localStorage.getItem(key);
            const arr = raw ? JSON.parse(raw) : [];
            const updated = arr.filter(t => t.id !== id);
            localStorage.setItem(key, JSON.stringify(updated));
        }
        await loadTransactions();
        renderAllTransactions();
        updateCharts();
        showToast('交易已删除');
    } catch (e) {
        console.error(e);
        showToast('删除失败');
    }
}

// 格式化日期
function formatDate(date) {
    if (typeof date === 'string') {
        return date;
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 显示提示信息
function showToast(message) {
    // 创建提示元素
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-fadeIn';
    toast.textContent = message;
    
    // 添加到页面
    document.body.appendChild(toast);
    
    // 2秒后移除
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translate(-50%, 20px)';
        toast.style.transition = 'opacity 0.3s, transform 0.3s';
        
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, 2000);
}

// 点击模态框外部关闭
transactionModal.addEventListener('click', (e) => {
    if (e.target === transactionModal) {
        closeModal();
    }
});

// 初始化应用：如果文档已就绪则直接执行，否则等待 DOMContentLoaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// ----------------- 游客初始示例数据（仅在无数据时生成一次） -----------------
function initializeGuestTransactions() {
    const key = 'transactions_guest';
    let existing = [];
    try { existing = JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { existing = []; }
    if (Array.isArray(existing) && existing.length > 0) return; // 已有数据不覆盖
    const today = new Date();
    const fmt = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const daysAgo = n => { const d = new Date(today); d.setDate(d.getDate()-n); return d; };
    const samples = [
        { type:'income', category: INCOME_CATEGORIES.find(c=>c.id==='salary'), amountCents: 800000, note:'工资', date: fmt(daysAgo(10)) },
        { type:'expense', category: EXPENSE_CATEGORIES.find(c=>c.id==='food'), amountCents: 4500, note:'午餐', date: fmt(daysAgo(3)) },
        { type:'expense', category: EXPENSE_CATEGORIES.find(c=>c.id==='transport'), amountCents: 1200, note:'公交', date: fmt(daysAgo(2)) },
        { type:'expense', category: EXPENSE_CATEGORIES.find(c=>c.id==='shopping'), amountCents: 25900, note:'网购衣物', date: fmt(daysAgo(1)) },
        { type:'income', category: INCOME_CATEGORIES.find(c=>c.id==='bonus'), amountCents: 200000, note:'季度奖金', date: fmt(daysAgo(5)) }
    ].map(s => ({
        id: (Date.now() + Math.random()).toString(),
        createdAt: new Date().toISOString(),
        amount: centsToNumber(s.amountCents),
        ...s
    }));
    localStorage.setItem(key, JSON.stringify(samples));
}

// 在 init 之前调用示例初始化（确保分类常量已可用）
initializeGuestTransactions();

// 旧的本地认证和存储逻辑已移除，前端现在使用后端 API

// ----------------- 前端 API 辅助函数 -----------------
function showAuthError(msg) { if (authError) { authError.textContent = msg; authError.classList.remove('hidden'); } }

function openAuthModal() {
    if (authError) authError.classList.add('hidden');
    if (authModal) authModal.classList.remove('hidden');
    switchAuthTab('login');
}

function closeAuthModal() { if (authModal) authModal.classList.add('hidden'); }

function switchAuthTab(tab) {
    if (tab === 'login') {
        if (loginForm) loginForm.classList.remove('hidden');
        if (registerForm) registerForm.classList.add('hidden');
        if (authTabLoginBtn) { authTabLoginBtn.classList.add('bg-primary', 'text-white'); authTabLoginBtn.classList.remove('bg-gray-100', 'text-gray-600'); }
        if (authTabRegisterBtn) { authTabRegisterBtn.classList.remove('bg-secondary', 'text-white'); authTabRegisterBtn.classList.add('bg-gray-100', 'text-gray-600'); }
    } else {
        if (loginForm) loginForm.classList.add('hidden');
        if (registerForm) registerForm.classList.remove('hidden');
        if (authTabRegisterBtn) { authTabRegisterBtn.classList.add('bg-secondary', 'text-white'); authTabRegisterBtn.classList.remove('bg-gray-100', 'text-gray-600'); }
        if (authTabLoginBtn) { authTabLoginBtn.classList.remove('bg-primary', 'text-white'); authTabLoginBtn.classList.add('bg-gray-100', 'text-gray-600'); }
    }
}

function updateAuthUI() {
    if (currentUser) {
        if (currentUserDisplay) currentUserDisplay.textContent = currentUser.username;
        if (logoutBtn) logoutBtn.classList.remove('hidden');
    } else {
        if (currentUserDisplay) currentUserDisplay.textContent = '游客';
        if (logoutBtn) logoutBtn.classList.add('hidden');
    }
}
async function loadCurrentUserFromServer() {
    // 静态模式：始终为游客
    currentUser = null;
    updateAuthUI();
}

async function handleRegister() {
    showAuthError('静态模式：不支持注册');
}

async function handleLogin() {
    showAuthError('静态模式：不支持登录');
}

async function handleLogout() {
    // 游客模式无登出概念
    showToast('静态模式：无登录状态');
}

// 登出后清空页面中的交易、预算与图表，避免数据泄露
function clearUIAfterLogout() {
    try {
        // 清空内存缓存与状态
        transactionsCache = [];
        currentMonthlyExpense = 0;
        currentBudgetAmount = 0;
        budgetExceeded = false;

        // 清空交易列表并显示登录提示
        if (transactionList) {
            transactionList.innerHTML = `
                <div class="text-center py-10 text-gray-500">
                    <i class="fas fa-file-invoice-dollar text-4xl mb-3"></i>
                    <p>暂无交易记录</p>
                </div>
            `;
        }

        // 置零关键统计
        const zeroCurrency = '¥0.00';
        const setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
        setText('totalBalance', zeroCurrency);
        setText('monthlyIncome', zeroCurrency);
        setText('monthlyExpense', zeroCurrency);
        setText('monthChange', '+¥0.00');
        setText('incomeChange', '+0.00%');
        setText('expenseChange', '+0.00%');

        // 清空预算输入与摘要
        if (budgetInput && document.activeElement !== budgetInput) {
            budgetInput.value = '';
        }
        if (budgetStatus) budgetStatus.textContent = `当前预算：${zeroCurrency}`;
        if (budgetSummary) {
            budgetSummary.textContent = `尚未设置预算。本月已支出 ¥0.00。`;
            budgetSummary.classList.remove('text-danger');
        }
        if (budgetWarning) budgetWarning.classList.add('hidden');

        // 清空图表
        resetChartsData();

        // 关闭并清空 AI 模态
        if (aiModal) aiModal.classList.add('hidden');
        if (aiContent) aiContent.innerHTML = '';
    } catch (e) {
        // 安静失败，避免打断登出流程
        console.warn('清空界面失败', e);
    }
}

async function createTransaction(t) {
    // 不调用后端；直接返回本地对象
    return t;
}

async function updateTransaction(id, t) {
    return { id, ...t }; // 静态模式占位
}

async function deleteTransactionById(id) {
    return { ok: true }; // 静态模式占位
}


