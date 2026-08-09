const firebaseConfig = Object.freeze({
    apiKey: 'AIzaSyCf0kahngmflEKhf-GEENdAwMIGiAjl-Bg',
    authDomain: 'tec-ielts-master.firebaseapp.com',
    projectId: 'tec-ielts-master',
    storageBucket: 'tec-ielts-master.firebasestorage.app',
    messagingSenderId: '189299803974',
    appId: '1:189299803974:web:18e450f31050761bc60747'
});

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const googleProvider = new firebase.auth.GoogleAuthProvider();

const loginButton = document.getElementById('login-btn');
const logoutButton = document.getElementById('logout-btn');
const welcomeMessage = document.getElementById('welcome-msg');
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

function loadSkill(skillPrefix, buttonElement) {
    currentSkill = skillPrefix;
    document.querySelectorAll('.skill-btn').forEach(button => button.classList.remove('active'));
    if (buttonElement) buttonElement.classList.add('active');
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

        if (test.available === false) {
            const unavailableMessage = document.createElement('div');
            unavailableMessage.className = 'unavailable-msg';
            unavailableMessage.textContent = 'Đang cập nhật audio';
            card.appendChild(unavailableMessage);
        } else if (isLoggedIn) {
            const startButton = document.createElement('button');
            startButton.className = 'do-test-btn';
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

function showAuthError(prefix, error) {
    const detail = error?.message || 'Lỗi không xác định';
    welcomeMessage.textContent = `${prefix}: ${detail}`;
}

loginButton.addEventListener('click', async () => {
    loginButton.disabled = true;
    try {
        await auth.signInWithPopup(googleProvider);
    } catch (error) {
        showAuthError('Không thể đăng nhập', error);
    } finally {
        loginButton.disabled = false;
    }
});

logoutButton.addEventListener('click', async () => {
    logoutButton.disabled = true;
    try {
        await auth.signOut();
    } catch (error) {
        showAuthError('Không thể đăng xuất', error);
    } finally {
        logoutButton.disabled = false;
    }
});

auth.onAuthStateChanged(user => {
    isLoggedIn = Boolean(user);
    loginButton.style.display = user ? 'none' : 'inline-block';
    logoutButton.style.display = user ? 'inline-block' : 'none';

    welcomeMessage.replaceChildren();
    if (user) {
        welcomeMessage.append('Chào mừng ');
        const name = document.createElement('strong');
        name.textContent = user.displayName || user.email || 'học viên';
        welcomeMessage.append(name, ' quay trở lại!');
    } else {
        welcomeMessage.textContent = 'Vui lòng đăng nhập để xem và làm bài!';
    }

    if (testListData.length > 0) renderTests();
});

loadTestList();
