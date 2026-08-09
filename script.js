const config = window.TEC_SUPABASE_CONFIG || {};
const hasSupabaseConfig = Boolean(
    config.url &&
    config.publishableKey &&
    !config.url.includes('YOUR_PROJECT_REF') &&
    !config.publishableKey.includes('YOUR_SUPABASE_PUBLISHABLE_KEY')
);

const supabaseClient = hasSupabaseConfig
    ? window.supabase.createClient(config.url, config.publishableKey)
    : null;

const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const welcomeMsg = document.getElementById('welcome-msg');
const testGrid = document.getElementById('test-grid');

let isLoggedIn = false;
let testListData = [];
let currentSkill = 'R';

async function loadTestList() {
    try {
        const response = await fetch('task_list.json');
        if (!response.ok) {
            throw new Error(`Không thể tải danh sách đề (${response.status})`);
        }
        testListData = await response.json();
        renderTests();
    } catch (error) {
        testGrid.replaceChildren(createMessage('Lỗi tải dữ liệu đề thi!', 'error'));
        console.error(error);
    }
}

function loadSkill(skillPrefix, btnElement) {
    currentSkill = skillPrefix;

    document.querySelectorAll('.skill-btn').forEach(btn => btn.classList.remove('active'));
    if (btnElement) btnElement.classList.add('active');

    renderTests();
}

function createMessage(text, type = '') {
    const message = document.createElement('p');
    message.textContent = text;
    if (type === 'error') message.style.color = '#ff4757';
    if (type === 'muted') message.style.color = '#64748b';
    return message;
}

function renderTests() {
    testGrid.replaceChildren();

    const filteredTests = testListData.filter(test => test.id.startsWith(currentSkill));

    if (filteredTests.length === 0) {
        testGrid.appendChild(createMessage('Hiện chưa có bài thi cho kỹ năng này.', 'muted'));
        return;
    }

    filteredTests.forEach(test => {
        const card = document.createElement('div');
        card.className = 'test-card';

        const details = document.createElement('div');
        const title = document.createElement('h3');
        const subtitle = document.createElement('p');
        title.textContent = test.title;
        subtitle.textContent = test.subtitle;
        details.append(title, subtitle);
        card.appendChild(details);

        if (isLoggedIn) {
            const startButton = document.createElement('button');
            startButton.className = 'do-test-btn';
            startButton.style.display = 'block';
            startButton.textContent = 'Làm bài ngay';
            startButton.addEventListener('click', () => {
                window.location.href = test.url;
            });
            card.appendChild(startButton);
        } else {
            const lockMessage = document.createElement('div');
            lockMessage.className = 'lock-msg';
            lockMessage.textContent = 'Đăng nhập để làm bài';
            card.appendChild(lockMessage);
        }

        testGrid.appendChild(card);
    });
}

function displayNameFor(user) {
    return user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'học viên';
}

function applySession(session) {
    const user = session?.user || null;
    isLoggedIn = Boolean(user);
    loginBtn.style.display = user ? 'none' : 'inline-block';
    logoutBtn.style.display = user ? 'inline-block' : 'none';

    welcomeMsg.replaceChildren();
    if (user) {
        welcomeMsg.append('Chào mừng ');
        const name = document.createElement('strong');
        name.textContent = displayNameFor(user);
        welcomeMsg.append(name, ' quay trở lại!');
    } else {
        welcomeMsg.textContent = 'Vui lòng đăng nhập để xem và làm bài!';
    }

    if (testListData.length > 0) renderTests();
}

async function signInWithGoogle() {
    if (!supabaseClient) return;
    loginBtn.disabled = true;
    const redirectTo = new URL('./', window.location.href).href;
    const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo }
    });
    if (error) {
        loginBtn.disabled = false;
        welcomeMsg.textContent = `Không thể đăng nhập: ${error.message}`;
    }
}

async function signOut() {
    if (!supabaseClient) return;
    logoutBtn.disabled = true;
    const { error } = await supabaseClient.auth.signOut();
    logoutBtn.disabled = false;
    if (error) welcomeMsg.textContent = `Không thể đăng xuất: ${error.message}`;
}

async function initializeAuth() {
    if (!supabaseClient) {
        loginBtn.disabled = true;
        welcomeMsg.textContent = 'Supabase chưa được cấu hình. Vui lòng xem README để hoàn tất thiết lập.';
        return;
    }

    const { data, error } = await supabaseClient.auth.getSession();
    if (error) {
        welcomeMsg.textContent = `Không thể đọc phiên đăng nhập: ${error.message}`;
    } else {
        applySession(data.session);
    }

    supabaseClient.auth.onAuthStateChange((_event, session) => {
        applySession(session);
    });
}

loginBtn.addEventListener('click', signInWithGoogle);
logoutBtn.addEventListener('click', signOut);

loadTestList();
initializeAuth();
