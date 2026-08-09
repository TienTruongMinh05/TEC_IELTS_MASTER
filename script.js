const testGrid = document.getElementById('test-grid');

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

        if (test.available === false) {
            const unavailableMessage = document.createElement('div');
            unavailableMessage.className = 'unavailable-msg';
            unavailableMessage.textContent = 'Đang cập nhật audio';
            card.appendChild(unavailableMessage);
        } else {
            const startButton = document.createElement('button');
            startButton.className = 'do-test-btn';
            startButton.textContent = 'Làm bài ngay';
            startButton.addEventListener('click', () => {
                window.location.href = test.url;
            });
            card.appendChild(startButton);
        }

        testGrid.appendChild(card);
    });
}

loadTestList();
