const appPage = document.body?.dataset?.page || 'home';

// 初始化日期输入为今天
const dateInputOnLoad = document.getElementById('dateInput');
if (dateInputOnLoad) {
    dateInputOnLoad.valueAsDate = new Date();
}

function isCurrentPage(...pages) {
    return pages.includes(appPage);
}

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
let supabaseClient = null; // Supabase 浏览器客户端
let lastAuthUserId = null; // 用于识别本次页面生命周期内的登录切换
let migrationPromptedUserId = null; // 避免同一次登录重复提示游客数据迁移
let isSavingTransaction = false; // 防止重复点击导致同一笔交易重复保存

// 预算相关变量
let currentBudgetAmount = 0; // 当前预算金额
let currentMonthlyExpense = 0; // 当前月支出总额
let budgetExceeded = false; // 预算是否超支

// 图表实例占位（初始化后赋值）
let trendChart = null;
let analyticsTrendChart = null;
let categoryChart = null;
let incomeCategoryChart = null;
let monthlyComparisonChart = null;
let incomeExpenseRatioChart = null;

let homeTrendPeriod = 'month';
let analyticsTrendPeriod = 'month';

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

function toSecondISOString(date = new Date()) {
    return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function getTransactionDateTime(t) {
    if (!t) return '';
    return t.transactionAt || t.transaction_at || t.createdAt || t.created_at || (t.date ? `${t.date}T00:00:00` : '');
}

function buildTransactionFingerprint(payload) {
    const amountCents = typeof payload.amountCents === 'number' ? payload.amountCents : parseAmountToCents(payload.amount);
    const categoryId = payload.category && payload.category.id ? payload.category.id : '';
    const note = (payload.note || '').trim();
    return [payload.type, amountCents, payload.date, categoryId, note].join('|');
}

function isDuplicateTransaction(payload, transactions = getTransactions(), excludeId = null) {
    const fingerprint = buildTransactionFingerprint(payload);
    return transactions.some(t => t.id !== excludeId && buildTransactionFingerprint(t) === fingerprint);
}

function getTransactionSortKey(t) {
    if (!t) return 0;
    const transactionAt = getTransactionDateTime(t);
    if (transactionAt) {
        const transactionAtMs = Date.parse(transactionAt);
        if (!Number.isNaN(transactionAtMs)) return transactionAtMs;
    }
    const createdAt = t.createdAt || t.created_at;
    if (createdAt) {
        const createdAtMs = Date.parse(createdAt);
        if (!Number.isNaN(createdAtMs)) return createdAtMs;
    }
    const idAsNumber = Number.parseFloat(t.id);
    if (!Number.isNaN(idAsNumber)) return idAsNumber;
    const dateMs = Date.parse(t.date);
    if (!Number.isNaN(dateMs)) return dateMs;
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

const analyticsTimeFilterBtns = document.querySelectorAll('.analytics-time-filter-btn');

// 查看全部状态
let allRange = 'month'; // 默认显示本月
let allPage = 1;
let allPageSize = 10;
const timeFilterBtns = document.querySelectorAll('.time-filter-btn'); // 时间筛选按钮

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

// 认证相关元素
const currentUserDisplay = document.getElementById('currentUserDisplay');
const authOpenBtn = document.getElementById('authOpenBtn');
const signOutBtn = document.getElementById('signOutBtn');

// ----------------- 应用初始化（恢复事件绑定与图表/分类渲染） -----------------
async function init() {
    if (isCurrentPage('home', 'transactions')) {
        if (expenseBtn && incomeBtn) {
            setTransactionType('expense');
            renderCategories();
            updateSaveButtonState();
        }

        if (expenseBtn) expenseBtn.addEventListener('click', () => setTransactionType('expense'));
        if (incomeBtn) incomeBtn.addEventListener('click', () => setTransactionType('income'));
        if (amountInput) amountInput.addEventListener('input', updateSaveButtonState);
        if (saveBtn) saveBtn.addEventListener('click', () => { if (!saveBtn.disabled) saveTransaction(); });

        if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
        if (deleteTransactionBtn) deleteTransactionBtn.addEventListener('click', deleteCurrentTransaction);
        if (editTransactionBtn) editTransactionBtn.addEventListener('click', editCurrentTransaction);
        if (viewAllBtn) viewAllBtn.addEventListener('click', viewAllTransactions);
        if (closeAllTransactionsBtn && allTransactionsModal) closeAllTransactionsBtn.addEventListener('click', () => allTransactionsModal.classList.add('hidden'));
        if (allTransactionsModal) allTransactionsModal.addEventListener('click', (e) => { if (e.target === allTransactionsModal) allTransactionsModal.classList.add('hidden'); });
        if (allSearchInput) allSearchInput.addEventListener('input', renderAllTransactions);
        if (allTypeFilter) allTypeFilter.addEventListener('change', renderAllTransactions);
        rangeButtons.forEach(btn => btn.addEventListener('click', () => {
            rangeButtons.forEach(b => b.classList.remove('bg-primary', 'text-white'));
            btn.classList.add('bg-primary', 'text-white');
            allRange = btn.dataset.range;
            allPage = 1;
            renderAllTransactions();
        }));
        if (applyCustomRange) applyCustomRange.addEventListener('click', () => { allRange = 'custom'; allPage = 1; renderAllTransactions(); });
        if (prevPageBtn) prevPageBtn.addEventListener('click', () => { if (allPage > 1) { allPage--; renderAllTransactions(); } });
        if (nextPageBtn) nextPageBtn.addEventListener('click', () => { allPage++; renderAllTransactions(); });
        if (pageSizeSelect) pageSizeSelect.addEventListener('change', () => { allPageSize = Number(pageSizeSelect.value) || 10; allPage = 1; renderAllTransactions(); });

        if (isCurrentPage('home')) {
            timeFilterBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    homeTrendPeriod = btn.dataset.period;
                    timeFilterBtns.forEach(b => {
                        b.classList.remove('bg-primary', 'text-white');
                        b.classList.add('bg-gray-100', 'text-gray-600');
                    });
                    btn.classList.remove('bg-gray-100', 'text-gray-600');
                    btn.classList.add('bg-primary', 'text-white');
                    updateTrendChart(homeTrendPeriod);
                });
            });
        }
    }

    if (isCurrentPage('analytics')) {
        analyticsTimeFilterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                analyticsTrendPeriod = btn.dataset.period;
                analyticsTimeFilterBtns.forEach(b => {
                    b.classList.remove('bg-primary', 'text-white');
                    b.classList.add('bg-gray-100', 'text-gray-600');
                });
                btn.classList.remove('bg-gray-100', 'text-gray-600');
                btn.classList.add('bg-primary', 'text-white');
                updateCharts();
            });
        });
    }

    if (isCurrentPage('settings')) {
        if (saveBudgetBtn) saveBudgetBtn.addEventListener('click', handleBudgetSave);
        if (budgetInput) budgetInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); handleBudgetSave(); } });
        if (exportCsvBtn) exportCsvBtn.addEventListener('click', () => handleExport('csv'));
        if (exportExcelBtn) exportExcelBtn.addEventListener('click', () => handleExport('excel'));
        if (backupBtn) backupBtn.addEventListener('click', handleBackup);
        if (restoreBtn) restoreBtn.addEventListener('click', () => restoreFileInput && restoreFileInput.click());
        if (restoreFileInput) restoreFileInput.addEventListener('change', handleRestoreFile);
    }

    injectAuthModal();
    bindAuthEvents();
    await initAuth();

    if (isCurrentPage('home', 'analytics')) {
        initCharts();
    }

    if (isCurrentPage('home', 'transactions', 'analytics', 'settings')) {
        await loadTransactions();
    }

    if (isCurrentPage('home', 'analytics')) {
        updateCharts();
    }

    if (isCurrentPage('settings')) {
        await loadBudget();
    }
}

// ----------------- Supabase 认证与数据服务 -----------------
function getSupabaseClient() {
    if (supabaseClient) return supabaseClient;
    const config = window.SUPABASE_CONFIG;
    if (!config || !config.url || !config.anonKey) return null;
    if (config.url.includes('your-project-ref') || config.anonKey.includes('your-supabase-anon-key')) return null;
    if (!window.supabase || typeof window.supabase.createClient !== 'function') return null;
    supabaseClient = window.supabase.createClient(config.url, config.anonKey);
    return supabaseClient;
}

function isSupabaseConfigured() {
    return Boolean(getSupabaseClient());
}

async function initAuth() {
    const client = getSupabaseClient();
    if (!client) {
        updateAuthUI();
        return;
    }

    try {
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        currentUser = data.session ? data.session.user : null;
    } catch (e) {
        console.error('初始化登录状态失败', e);
        currentUser = null;
    }

    updateAuthUI();

    lastAuthUserId = currentUser ? currentUser.id : null;

    client.auth.onAuthStateChange(async (_event, session) => {
        const previousUserId = lastAuthUserId;
        currentUser = session ? session.user : null;
        const currentUserId = currentUser ? currentUser.id : null;
        lastAuthUserId = currentUserId;
        if (!currentUser) {
            transactionsCache = [];
            migrationPromptedUserId = null;
        }
        updateAuthUI();
        await refreshPageData();
        if (currentUser && previousUserId !== currentUserId) promptGuestDataMigration();
    });
}

async function refreshPageData() {
    if (isCurrentPage('home', 'transactions', 'analytics', 'settings')) {
        await loadTransactions();
    }
    if (isCurrentPage('settings')) {
        await loadBudget();
    }
    updateCharts();
    if (allTransactionsModal && !allTransactionsModal.classList.contains('hidden')) {
        renderAllTransactions();
    }
}

function bindAuthEvents() {
    if (authOpenBtn) authOpenBtn.addEventListener('click', openAuthModal);
    if (signOutBtn) signOutBtn.addEventListener('click', handleSignOut);

    const closeBtn = document.getElementById('closeAuthModalBtn');
    const signInBtn = document.getElementById('signInBtn');
    const signUpBtn = document.getElementById('signUpBtn');
    const importGuestDataBtn = document.getElementById('importGuestDataBtn');
    const modal = document.getElementById('authModal');

    if (closeBtn) closeBtn.addEventListener('click', closeAuthModal);
    if (modal) modal.addEventListener('click', e => { if (e.target === modal) closeAuthModal(); });
    if (signInBtn) signInBtn.addEventListener('click', handleSignIn);
    if (signUpBtn) signUpBtn.addEventListener('click', handleSignUp);
    if (importGuestDataBtn) importGuestDataBtn.addEventListener('click', migrateGuestDataToAccount);
}

function injectAuthModal() {
    if (document.getElementById('authModal')) return;
    const modal = document.createElement('div');
    modal.id = 'authModal';
    modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 hidden';
    modal.innerHTML = `
        <div class="bg-white rounded-xl p-6 max-w-md w-full mx-4 card-shadow animate-fadeIn">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-semibold text-gray-800">登录 / 注册</h3>
                <button id="closeAuthModalBtn" class="text-gray-500 hover:text-gray-700"><i class="fas fa-times"></i></button>
            </div>
            <div class="space-y-3">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
                    <input id="authEmailInput" type="email" class="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none input-focus" placeholder="you@example.com" autocomplete="email">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">密码</label>
                    <input id="authPasswordInput" type="password" class="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none input-focus" placeholder="至少 6 位" autocomplete="current-password">
                </div>
                <p id="authStatus" class="text-sm text-gray-500 min-h-[1.25rem]"></p>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button id="signInBtn" class="px-4 py-3 bg-primary text-white rounded-lg transition-custom hover:bg-primary/90">登录</button>
                    <button id="signUpBtn" class="px-4 py-3 border border-primary text-primary rounded-lg transition-custom hover:bg-primary hover:text-white">注册</button>
                </div>
                <div id="guestDataImportPanel" class="hidden border-t pt-4 mt-4">
                    <p class="text-sm text-gray-600 mb-3">检测到本地游客数据，可导入到当前账号。</p>
                    <button id="importGuestDataBtn" class="w-full px-4 py-2 bg-secondary text-white rounded-lg transition-custom hover:bg-secondary/90">导入游客数据</button>
                </div>
                <p class="text-xs text-gray-500">需要先配置 supabase-config.js。浏览器只使用 anon key，数据隔离由 Supabase RLS 保证。</p>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function updateAuthUI() {
    const email = currentUser && currentUser.email ? currentUser.email : '游客';
    if (currentUserDisplay) currentUserDisplay.textContent = email;
    if (authOpenBtn) authOpenBtn.classList.toggle('hidden', Boolean(currentUser));
    if (signOutBtn) signOutBtn.classList.toggle('hidden', !currentUser);
    const importPanel = document.getElementById('guestDataImportPanel');
    if (importPanel) importPanel.classList.toggle('hidden', !(currentUser && hasGuestData()));
}

function openAuthModal() {
    if (!isSupabaseConfigured()) {
        showToast('请先配置 supabase-config.js');
        return;
    }
    updateAuthUI();
    const modal = document.getElementById('authModal');
    if (modal) modal.classList.remove('hidden');
}

function closeAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) modal.classList.add('hidden');
}

function getAuthFormValues() {
    const email = (document.getElementById('authEmailInput')?.value || '').trim();
    const password = document.getElementById('authPasswordInput')?.value || '';
    return { email, password };
}

function setAuthStatus(message, isError = false) {
    const status = document.getElementById('authStatus');
    if (!status) return;
    status.textContent = message;
    status.classList.toggle('text-danger', isError);
    status.classList.toggle('text-gray-500', !isError);
}

async function handleSignUp() {
    const client = getSupabaseClient();
    if (!client) return showToast('请先配置 Supabase');
    const { email, password } = getAuthFormValues();
    if (!email || password.length < 6) {
        setAuthStatus('请输入邮箱和至少 6 位密码', true);
        return;
    }
    setAuthStatus('正在注册...');
    const { data, error } = await client.auth.signUp({ email, password });
    if (error) {
        setAuthStatus(error.message, true);
        return;
    }
    if (data.session) {
        closeAuthModal();
        showToast('注册并登录成功');
    } else {
        setAuthStatus('注册成功，请按 Supabase 设置检查邮箱确认后再登录');
    }
}

async function handleSignIn() {
    const client = getSupabaseClient();
    if (!client) return showToast('请先配置 Supabase');
    const { email, password } = getAuthFormValues();
    if (!email || !password) {
        setAuthStatus('请输入邮箱和密码', true);
        return;
    }
    setAuthStatus('正在登录...');
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
        setAuthStatus(error.message, true);
        return;
    }
    closeAuthModal();
    showToast('登录成功');
}

async function handleSignOut() {
    const client = getSupabaseClient();
    if (!client) return;
    const { error } = await client.auth.signOut();
    if (error) {
        console.error('退出登录失败', error);
        showToast('退出登录失败');
        return;
    }
    currentUser = null;
    transactionsCache = [];
    updateAuthUI();
    await refreshPageData();
    showToast('已退出登录');
}

function normalizeSupabaseTransaction(row) {
    const amountCents = Number(row.amount_cents) || 0;
    return {
        id: row.id,
        type: row.type,
        amount: centsToNumber(amountCents),
        amountCents,
        date: row.date,
        transactionAt: row.transaction_at || row.created_at,
        category: row.category || { id: 'other', name: '其他', icon: 'ellipsis-h', color: '#6B7280' },
        note: row.note || '',
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

function toSupabaseTransactionPayload(payload) {
    if (!currentUser) throw new Error('未登录');
    const amountCents = typeof payload.amountCents === 'number' ? payload.amountCents : parseAmountToCents(payload.amount);
    return {
        user_id: currentUser.id,
        type: payload.type,
        amount_cents: amountCents,
        date: payload.date,
        transaction_at: payload.transactionAt || toSecondISOString(),
        category: payload.category,
        note: payload.note || '',
        updated_at: toSecondISOString()
    };
}

async function loadUserTransactions() {
    const client = getSupabaseClient();
    if (!client || !currentUser) {
        transactionsCache = [];
        return [];
    }
    const { data, error } = await client
        .from('transactions')
        .select('*')
        .order('transaction_at', { ascending: false })
        .order('created_at', { ascending: false });
    if (error) throw error;
    transactionsCache = (data || []).map(normalizeSupabaseTransaction);
    return transactionsCache;
}

async function createUserTransaction(payload) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase 未配置');
    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('登录已过期，请重新登录');
    currentUser = user;
    await loadUserTransactions();
    if (isDuplicateTransaction(payload, transactionsCache)) {
        throw new Error('检测到相同交易，已阻止重复保存');
    }
    const { error } = await client.from('transactions').insert(toSupabaseTransactionPayload(payload));
    if (error) throw error;
}

async function updateUserTransaction(id, payload) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase 未配置');
    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('登录已过期，请重新登录');
    currentUser = user;
    await loadUserTransactions();
    if (isDuplicateTransaction(payload, transactionsCache, id)) {
        throw new Error('检测到相同交易，已阻止重复保存');
    }
    const { error } = await client
        .from('transactions')
        .update(toSupabaseTransactionPayload(payload))
        .eq('id', id);
    if (error) throw error;
}

async function deleteUserTransaction(id) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase 未配置');
    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('登录已过期，请重新登录');
    currentUser = user;
    const { error } = await client.from('transactions').delete().eq('id', id);
    if (error) throw error;
}

async function deleteTransactionById(id) {
    return deleteUserTransaction(id);
}

async function loadUserBudget() {
    const client = getSupabaseClient();
    if (!client || !currentUser) return 0;
    const { data, error } = await client
        .from('budgets')
        .select('amount_cents')
        .eq('user_id', currentUser.id)
        .maybeSingle();
    if (error) throw error;
    return data ? centsToNumber(Number(data.amount_cents) || 0) : 0;
}

async function saveUserBudget(amount) {
    const client = getSupabaseClient();
    if (!client || !currentUser) throw new Error('未登录');
    const { error } = await client.from('budgets').upsert({
        user_id: currentUser.id,
        amount_cents: parseAmountToCents(amount),
        updated_at: new Date().toISOString()
    });
    if (error) throw error;
}

function normalizeGuestTransactions() {
    const key = 'transactions_guest';
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    try {
        const arr = JSON.parse(raw);
        if (!Array.isArray(arr)) return [];
        return arr.map(t => {
            const amountCents = typeof t.amountCents === 'number' ? t.amountCents : parseAmountToCents(t.amount);
            return {
                ...t,
                amountCents,
                amount: centsToNumber(amountCents),
                transactionAt: t.transactionAt || t.transaction_at || t.createdAt || t.created_at,
                createdAt: t.createdAt || t.created_at
            };
        });
    } catch (e) {
        console.error('解析本地交易数据失败', e);
        return [];
    }
}

function hasGuestData() {
    return normalizeGuestTransactions().length > 0 || Boolean(localStorage.getItem('budget_guest'));
}

function promptGuestDataMigration() {
    if (!currentUser || !hasGuestData()) return;
    if (migrationPromptedUserId === currentUser.id) return;
    migrationPromptedUserId = currentUser.id;
    setTimeout(() => {
        if (window.confirm('检测到本地游客数据，是否导入到当前账号？导入后本地游客数据会保留。')) {
            migrateGuestDataToAccount();
        }
    }, 300);
}

async function migrateGuestDataToAccount() {
    if (!currentUser) return showToast('请先登录');
    const client = getSupabaseClient();
    if (!client) return showToast('请先配置 Supabase');
    try {
        const guestTransactions = normalizeGuestTransactions();
        if (guestTransactions.length > 0) {
            await loadUserTransactions();
            const rows = guestTransactions
                .filter(t => !isDuplicateTransaction(t, transactionsCache))
                .map(toSupabaseTransactionPayload);
            if (rows.length > 0) {
                const { error } = await client.from('transactions').insert(rows);
                if (error) throw error;
            }
        }
        const rawBudget = localStorage.getItem('budget_guest');
        if (rawBudget != null) {
            await saveUserBudget(Number(rawBudget) || 0);
        }
        await refreshPageData();
        closeAuthModal();
        showToast(`已导入 ${guestTransactions.length} 条游客交易`);
    } catch (e) {
        console.error('导入游客数据失败', e);
        showToast('导入游客数据失败');
    }
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
    const payload = { exportedAt: new Date().toISOString(), transactions: getTransactions(), budget: currentBudgetAmount || 0 };
    if (!currentUser) {
        const b = localStorage.getItem('budget_guest');
        payload.budget = b ? Number(b) : 0;
    } else if (!isCurrentPage('settings')) {
        payload.budget = await loadUserBudget();
    }
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
    if (currentUser) {
        const client = getSupabaseClient();
        const existingIds = transactionsCache.map(t => t.id);
        if (existingIds.length > 0) {
            const { error: deleteError } = await client.from('transactions').delete().in('id', existingIds);
            if (deleteError) throw deleteError;
        }
        if (transactions.length > 0) {
            const rows = transactions.map(t => toSupabaseTransactionPayload({
                type: t.type,
                amount: t.amount,
                amountCents: getAmountCents(t),
                date: t.date,
                category: t.category,
                note: t.note || ''
            }));
            const { error: insertError } = await client.from('transactions').insert(rows);
            if (insertError) throw insertError;
        }
        await saveUserBudget(budget);
        if (backupStatus) backupStatus.textContent = `恢复：覆盖账号数据 ${transactions.length} 条`;
    } else {
        localStorage.setItem('transactions_guest', JSON.stringify(transactions));
        localStorage.setItem('budget_guest', String(budget));
        if (backupStatus) backupStatus.textContent = `恢复：覆盖本地数据 ${transactions.length} 条`;
    }
}

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

// 保存交易
async function saveTransaction() {
    if (isSavingTransaction) return;
    isSavingTransaction = true;
    if (saveBtn) saveBtn.disabled = true;
    const amountInputValue = amountInput.value;
    const amountCents = parseAmountToCents(amountInputValue);
    const amount = centsToNumber(amountCents);
    const date = document.getElementById('dateInput').value;
    const note = document.getElementById('noteInput').value;
    const categories = currentType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
    const category = categories.find(c => c.id === selectedCategory);
    const existingTransaction = editingTransactionId ? getTransactions().find(t => t.id === editingTransactionId) : null;

    const payload = {
        type: currentType,
        amount: amount,
        date: date,
        category: category,
        note: note,
        amountCents: amountCents,
        transactionAt: existingTransaction ? getTransactionDateTime(existingTransaction) : toSecondISOString()
    };

    try {
        if (currentUser) {
            payload.amountCents = amountCents;
            if (editingTransactionId) {
                await updateUserTransaction(editingTransactionId, payload);
                editingTransactionId = null;
            } else {
                await createUserTransaction(payload);
            }
        } else {
            const key = 'transactions_guest';
            const raw = localStorage.getItem(key);
            const arr = raw ? JSON.parse(raw) : [];
            if (isDuplicateTransaction(payload, arr)) {
                throw new Error('检测到相同交易，已阻止重复保存');
            }
            arr.push({ id: Date.now().toString(), ...payload, createdAt: payload.transactionAt });
            localStorage.setItem(key, JSON.stringify(arr));
        }
    } catch (e) {
        console.error('保存交易失败', e);
        showToast(`保存交易失败：${e.message || '请检查 Supabase 表和 RLS 配置'}`);
        return;
    } finally {
        isSavingTransaction = false;
        updateSaveButtonState();
    }

    // 重置表单
    amountInput.value = '';
    const noteInput = document.getElementById('noteInput');
    if (noteInput) noteInput.value = '';
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
    if (currentUser) return transactionsCache;
    return normalizeGuestTransactions();
}

function renderEmptyTransactionList() {
    if (!transactionList) return;
    transactionList.innerHTML = `
        <div class="text-center py-10 text-gray-500">
            <i class="fas fa-file-invoice-dollar text-4xl mb-3"></i>
            <p>暂无交易记录</p>
        </div>
    `;
}

function renderRecentTransactions(transactions) {
    if (!transactionList) return;
    transactionList.innerHTML = '';
    if (transactions.length === 0) {
        renderEmptyTransactionList();
        return;
    }
    const recentTransactions = [...transactions]
        .map(r => ({
            id: r.id,
            type: r.type,
            amountCents: getAmountCents(r),
            amount: centsToNumber(getAmountCents(r)),
            date: r.date,
            category: r.category,
            note: r.note,
            transactionAt: getTransactionDateTime(r),
            createdAt: r.createdAt || r.created_at
        }))
        .sort((a, b) => getTransactionSortKey(b) - getTransactionSortKey(a))
        .slice(0, 10);

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
}

// 加载交易记录
async function loadTransactions() {
    try {
        if (currentUser) await loadUserTransactions();
    } catch (e) {
        console.error('加载交易记录失败', e);
        showToast('加载交易记录失败');
    }

    const transactions = getTransactions();
    if (transactionList) {
        renderRecentTransactions(transactions);
    }
    updateFinancialSummary();
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
    
    // 始终展示本地计算结果
    const totalBalanceEl = document.getElementById('totalBalance');
    const monthlyIncomeEl = document.getElementById('monthlyIncome');
    const monthlyExpenseEl = document.getElementById('monthlyExpense');
    if (totalBalanceEl) totalBalanceEl.textContent = `¥${centsToNumber(totalBalanceCents).toFixed(2)}`;
    if (monthlyIncomeEl) monthlyIncomeEl.textContent = `¥${centsToNumber(monthlyIncomeCents).toFixed(2)}`;
    if (monthlyExpenseEl) monthlyExpenseEl.textContent = `¥${centsToNumber(monthlyExpenseCents).toFixed(2)}`;
    
    // 计算本月变化
    const monthChange = centsToNumber(monthlyIncomeCents - monthlyExpenseCents);
    const monthChangeEl = document.getElementById('monthChange');
    if (monthChangeEl) monthChangeEl.textContent = `${monthChange >= 0 ? '+' : ''}¥${monthChange.toFixed(2)}`;
    
    // 计算同比变化
    const incomeChange = lastMonthIncome === 0 ? 0 : ((centsToNumber(monthlyIncomeCents) - lastMonthIncome) / lastMonthIncome) * 100;
    const expenseChange = lastMonthExpense === 0 ? 0 : ((centsToNumber(monthlyExpenseCents) - lastMonthExpense) / lastMonthExpense) * 100;
    
    const incomeChangeEl = document.getElementById('incomeChange');
    const expenseChangeEl = document.getElementById('expenseChange');
    if (incomeChangeEl) incomeChangeEl.textContent = (incomeChange >= 0 ? `+${incomeChange.toFixed(2)}%` : `${incomeChange.toFixed(2)}%`);
    if (expenseChangeEl) expenseChangeEl.textContent = (expenseChange >= 0 ? `+${expenseChange.toFixed(2)}%` : `${expenseChange.toFixed(2)}%`);

    currentMonthlyExpense = centsToNumber(monthlyExpenseCents);
    updateBudgetUI();
}

// 初始化图表
function initCharts() {
    const trendCanvas = document.getElementById('trendChart');
    if (trendCanvas) {
        const trendCtx = trendCanvas.getContext('2d');
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
    }

    const analyticsTrendCanvas = document.getElementById('analyticsTrendChart');
    if (analyticsTrendCanvas) {
        const analyticsTrendCtx = analyticsTrendCanvas.getContext('2d');
        analyticsTrendChart = new Chart(analyticsTrendCtx, {
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
    }

    const categoryCanvas = document.getElementById('categoryChart');
    if (categoryCanvas) {
        const categoryCtx = categoryCanvas.getContext('2d');
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
    }

    const incomeCategoryCanvas = document.getElementById('incomeCategoryChart');
    if (incomeCategoryCanvas) {
        const incomeCategoryCtx = incomeCategoryCanvas.getContext('2d');
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
    }

    const monthlyComparisonCanvas = document.getElementById('monthlyComparisonChart');
    if (monthlyComparisonCanvas) {
        const monthlyComparisonCtx = monthlyComparisonCanvas.getContext('2d');
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
    }

    const incomeExpenseRatioCanvas = document.getElementById('incomeExpenseRatioChart');
    if (incomeExpenseRatioCanvas) {
        const incomeExpenseRatioCtx = incomeExpenseRatioCanvas.getContext('2d');
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
    }

    updateCharts();
}

// 更新图表
function updateCharts() {
    if (isCurrentPage('analytics')) {
        updateAnalyticsTrendChart(analyticsTrendPeriod);
        updateCategoryChart(analyticsTrendPeriod);
        updateIncomeCategoryChart(analyticsTrendPeriod);
        updateMonthlyComparisonChart();
        updateIncomeExpenseRatioChart(analyticsTrendPeriod);
        return;
    }

    updateTrendChart(homeTrendPeriod);
    updateCategoryChart('month');
    updateIncomeCategoryChart('month');
    updateMonthlyComparisonChart();
    updateIncomeExpenseRatioChart('month');
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
        if (analyticsTrendChart) {
            analyticsTrendChart.data.labels = [];
            if (analyticsTrendChart.data.datasets && analyticsTrendChart.data.datasets[0]) analyticsTrendChart.data.datasets[0].data = [];
            if (analyticsTrendChart.data.datasets && analyticsTrendChart.data.datasets[1]) analyticsTrendChart.data.datasets[1].data = [];
            analyticsTrendChart.update();
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
    if (!trendChart) return;
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

function getAnalyticsRange(period) {
    const now = new Date();
    const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const endOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

    if (period === 'day') {
        const start = startOfDay(now);
        return { start, end: endOfDay(now), unit: 'hour' };
    }

    if (period === 'week') {
        const day = now.getDay();
        const diffToMonday = (day + 6) % 7;
        const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday);
        const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
        return { start: startOfDay(monday), end: endOfDay(sunday), unit: 'day' };
    }

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start: monthStart, end: monthEnd, unit: 'day' };
}

function buildAnalyticsSeries(transactions, period) {
    const now = new Date();
    const { start, end, unit } = getAnalyticsRange(period);
    const labels = [];
    const incomeData = [];
    const expenseData = [];

    if (period === 'day') {
        for (let hour = 0; hour < 24; hour++) {
            const hourLabel = `${String(hour).padStart(2, '0')}:00`;
            labels.push(hourLabel);
            const hourTransactions = transactions.filter(t => {
                const d = new Date(t.date + 'T00:00:00');
                return d >= start && d <= end && new Date(getTransactionDateTime(t) || t.date).getHours() === hour;
            });
            const hourIncomeCents = hourTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + getAmountCents(t), 0);
            const hourExpenseCents = hourTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + getAmountCents(t), 0);
            incomeData.push(centsToNumber(hourIncomeCents));
            expenseData.push(centsToNumber(hourExpenseCents));
        }
        return { labels, incomeData, expenseData, start, end };
    }

    const current = new Date(start);
    while (current <= end) {
        const label = period === 'week'
            ? `${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`
            : `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
        labels.push(label);
        const dayKey = formatDate(current);
        const dayTransactions = transactions.filter(t => t.date === dayKey);
        const dayIncomeCents = dayTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + getAmountCents(t), 0);
        const dayExpenseCents = dayTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + getAmountCents(t), 0);
        incomeData.push(centsToNumber(dayIncomeCents));
        expenseData.push(centsToNumber(dayExpenseCents));
        current.setDate(current.getDate() + 1);
    }

    return { labels, incomeData, expenseData, start, end };
}

function getTransactionsForPeriod(transactions, period) {
    const { start, end } = getAnalyticsRange(period);
    return transactions.filter(t => {
        const d = new Date(t.date);
        return d >= start && d <= end;
    });
}

function updateAnalyticsTrendChart(period) {
    if (!analyticsTrendChart) return;
    const transactions = getTransactions();
    const series = buildAnalyticsSeries(transactions, period);
    analyticsTrendChart.data.labels = series.labels;
    analyticsTrendChart.data.datasets[0].data = series.incomeData;
    analyticsTrendChart.data.datasets[1].data = series.expenseData;
    analyticsTrendChart.update();
}

// 更新分类图表
function updateCategoryChart(period = 'month') {
    if (!categoryChart) return;
    const transactions = getTransactions();
    const scopedTransactions = getTransactionsForPeriod(transactions, period);
    const monthlyExpenses = scopedTransactions.filter(t => t.type === 'expense');
    
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
    if (!categoryList) return;
    categoryList.innerHTML = '';
    
    if (categories.length === 0) {
        categoryList.innerHTML = `
            <div class="text-center py-4 text-gray-500 text-sm">
                所选周期暂无支出
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
function updateIncomeCategoryChart(period = 'month') {
    if (!incomeCategoryChart) return;
    const transactions = getTransactions();
    const scopedTransactions = getTransactionsForPeriod(transactions, period);
    const monthlyIncomes = scopedTransactions.filter(t => t.type === 'income');
    
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
    if (!incomeCategoryList) return;
    incomeCategoryList.innerHTML = '';
    
    if (categories.length === 0) {
        incomeCategoryList.innerHTML = `
            <div class="text-center py-4 text-gray-500 text-sm">
                所选周期暂无收入
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
    if (!monthlyComparisonChart) return;
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
function updateIncomeExpenseRatioChart(period = 'month') {
    if (!incomeExpenseRatioChart) return;
    const transactions = getTransactions();
    const monthlyTransactions = getTransactionsForPeriod(transactions, period);
    
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
            amount = await loadUserBudget();
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
        if (currentUser) {
            await saveUserBudget(normalized);
        } else {
            localStorage.setItem('budget_guest', String(normalized));
        }
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
    if (currentUser) {
        if (transactionsCache.length === 0) await loadUserTransactions();
        return { transactions: getTransactions(), source: 'supabase' };
    }
    return { transactions: normalizeGuestTransactions(), source: 'guest' };
}

function prepareExportRows(transactions) {
    return [...transactions]
        .sort((a, b) => getTransactionSortKey(b) - getTransactionSortKey(a))
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
    if (!modalContent || !deleteTransactionBtn || !editTransactionBtn || !transactionModal) return;
    
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
    if (transactionModal) transactionModal.classList.add('hidden');
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
    const dateInput = document.getElementById('dateInput');
    const noteInput = document.getElementById('noteInput');
    if (dateInput) dateInput.value = transaction.date;
    if (noteInput) noteInput.value = transaction.note || '';
    selectedCategory = transaction.category ? transaction.category.id : null;
    renderCategories();
    updateSaveButtonState();
    closeModal();
    const editorSection = document.querySelector('.lg\\:col-span-1');
    if (editorSection && typeof editorSection.scrollIntoView === 'function') {
        editorSection.scrollIntoView({ behavior: 'smooth' });
    }
    showToast('请修改交易信息并保存');
}

// 查看所有交易
function viewAllTransactions() {
    if (!allTransactionsModal) return;
    renderAllTransactions();
    allTransactionsModal.classList.remove('hidden');
}

function renderAllTransactions() {
    if (!allTransactionsList) return;
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
            transactionAt: getTransactionDateTime(t),
            createdAt: t.createdAt || t.created_at
        }))
        .sort((a, b) => getTransactionSortKey(b) - getTransactionSortKey(a));

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
    const dateInput = document.getElementById('dateInput');
    const noteInput = document.getElementById('noteInput');
    if (dateInput) dateInput.value = transaction.date;
    if (noteInput) noteInput.value = transaction.note || '';
    selectedCategory = transaction.category ? transaction.category.id : null;
    renderCategories();
    updateSaveButtonState();
    if (allTransactionsModal) allTransactionsModal.classList.add('hidden');
    const editorSection = document.querySelector('.lg\\:col-span-1');
    if (editorSection && typeof editorSection.scrollIntoView === 'function') {
        editorSection.scrollIntoView({ behavior: 'smooth' });
    }
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

// 点击模态框外部关闭（防止元素缺失导致报错）
if (transactionModal) {
    transactionModal.addEventListener('click', (e) => {
        if (e.target === transactionModal) {
            closeModal();
        }
    });
}

// 初始化应用：如果文档已就绪则直接执行，否则等待 DOMContentLoaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
