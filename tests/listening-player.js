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

const SIGNED_URL_TTL_SECONDS = 7200;
const VALID_TEST_ID = /^L[1-7]$/;

const audioPlayer = document.getElementById('audio-player');
const continueButton = document.getElementById('continue-btn');
const sectionButtons = document.getElementById('section-buttons');
const sectionLabel = document.getElementById('section-label');
const sectionProgress = document.getElementById('section-progress');
const statusMessage = document.getElementById('status');
const testTitle = document.getElementById('test-title');

let manifest = null;
let selectedTest = null;
let currentSectionIndex = -1;
let retryUsedForSection = false;
let requestedResumeTime = 0;
const signedUrlCache = new Map();

function setStatus(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.classList.toggle('error', isError);
}

function stopAudio() {
    audioPlayer.pause();
    audioPlayer.removeAttribute('src');
    audioPlayer.load();
}

function returnToLogin(message) {
    stopAudio();
    sessionStorage.setItem('tec_auth_message', message);
    window.location.replace('../index.html');
}

async function requireSession() {
    if (!supabaseClient) {
        throw new Error('Supabase chưa được cấu hình. Vui lòng xem README.');
    }

    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    if (!data.session) {
        returnToLogin('Vui lòng đăng nhập để nghe bài Listening.');
        return null;
    }
    return data.session;
}

async function loadManifest() {
    const response = await fetch('../listening_manifest.json');
    if (!response.ok) throw new Error(`Không thể tải Listening manifest (${response.status}).`);
    const data = await response.json();
    if (!data.bucket || !Array.isArray(data.tests)) {
        throw new Error('Listening manifest không hợp lệ.');
    }
    return data;
}

function requestedTestId() {
    const id = new URLSearchParams(window.location.search).get('test') || '';
    return VALID_TEST_ID.test(id) ? id : null;
}

function renderSectionButtons() {
    sectionButtons.replaceChildren();
    selectedTest.sections.forEach((section, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'section-button';
        button.textContent = section.label;
        button.addEventListener('click', () => loadSection(index, false));
        sectionButtons.appendChild(button);
    });
}

function updateSectionUI(index) {
    const section = selectedTest.sections[index];
    sectionLabel.textContent = section.label;
    sectionProgress.textContent = `${index + 1} / ${selectedTest.sections.length}`;
    [...sectionButtons.children].forEach((button, buttonIndex) => {
        button.classList.toggle('active', buttonIndex === index);
    });
}

async function signedUrlFor(index, forceRefresh = false) {
    if (!forceRefresh && signedUrlCache.has(index)) return signedUrlCache.get(index);

    const section = selectedTest.sections[index];
    const { data, error } = await supabaseClient.storage
        .from(manifest.bucket)
        .createSignedUrl(section.objectPath, SIGNED_URL_TTL_SECONDS);

    if (error) throw error;
    if (!data?.signedUrl) throw new Error(`Không tạo được URL cho ${section.label}.`);
    signedUrlCache.set(index, data.signedUrl);
    return data.signedUrl;
}

async function loadSection(index, autoplay, options = {}) {
    if (index < 0 || index >= selectedTest.sections.length) return;

    const resumeTime = options.resumeTime || 0;
    currentSectionIndex = index;
    retryUsedForSection = Boolean(options.isRetry);
    requestedResumeTime = resumeTime;
    continueButton.style.display = 'none';
    audioPlayer.dataset.autoplay = autoplay ? 'true' : 'false';
    updateSectionUI(index);
    setStatus(`Đang tạo đường dẫn bảo mật cho ${selectedTest.sections[index].label}...`);

    try {
        const signedUrl = await signedUrlFor(index, Boolean(options.forceRefresh));
        audioPlayer.src = signedUrl;
        audioPlayer.load();
        if (index + 1 < selectedTest.sections.length) {
            signedUrlFor(index + 1).catch(() => {});
        }
    } catch (error) {
        setStatus(`Không thể tải audio: ${error.message}`, true);
    }
}

async function playLoadedAudio() {
    if (requestedResumeTime > 0 && Number.isFinite(audioPlayer.duration)) {
        audioPlayer.currentTime = Math.min(requestedResumeTime, Math.max(0, audioPlayer.duration - 0.25));
    }
    requestedResumeTime = 0;
    setStatus(`${selectedTest.sections[currentSectionIndex].label} đã sẵn sàng.`);

    if (audioPlayer.dataset.autoplay === 'true') {
        try {
            await audioPlayer.play();
        } catch (_error) {
            continueButton.style.display = 'block';
            setStatus('Trình duyệt đã chặn tự phát. Bấm nút bên dưới để tiếp tục.');
        }
    }
}

async function recoverFromAudioError() {
    if (currentSectionIndex < 0 || retryUsedForSection) {
        setStatus('Không thể phát audio. Vui lòng tải lại trang hoặc báo cho giáo viên.', true);
        return;
    }

    const resumeTime = Number.isFinite(audioPlayer.currentTime) ? audioPlayer.currentTime : 0;
    signedUrlCache.delete(currentSectionIndex);
    const session = await requireSession();
    if (!session) return;
    setStatus('Đường dẫn audio đã hết hạn hoặc bị gián đoạn. Đang kết nối lại...');
    await loadSection(currentSectionIndex, true, {
        forceRefresh: true,
        isRetry: true,
        resumeTime
    });
}

async function initialize() {
    try {
        const session = await requireSession();
        if (!session) return;

        manifest = await loadManifest();
        const testId = requestedTestId();
        if (!testId) throw new Error('Mã bài Listening không hợp lệ.');

        selectedTest = manifest.tests.find(test => test.id === testId);
        if (!selectedTest) throw new Error(`Không tìm thấy ${testId} trong manifest.`);
        if (!selectedTest.available) {
            throw new Error(`${selectedTest.title} chưa có đủ 4 section audio.`);
        }
        if (!Array.isArray(selectedTest.sections) || selectedTest.sections.length !== 4) {
            throw new Error(`${selectedTest.title} phải có đúng 4 section.`);
        }

        testTitle.textContent = selectedTest.title;
        renderSectionButtons();
        await loadSection(0, false);

        supabaseClient.auth.onAuthStateChange(event => {
            if (event === 'SIGNED_OUT') returnToLogin('Phiên đăng nhập đã kết thúc.');
        });
    } catch (error) {
        audioPlayer.hidden = true;
        setStatus(error.message, true);
    }
}

audioPlayer.addEventListener('loadedmetadata', playLoadedAudio);
audioPlayer.addEventListener('error', recoverFromAudioError);
audioPlayer.addEventListener('ended', () => {
    if (currentSectionIndex + 1 < selectedTest.sections.length) {
        loadSection(currentSectionIndex + 1, true);
    } else {
        setStatus('Bạn đã nghe xong toàn bộ 4 section.');
    }
});

continueButton.addEventListener('click', async () => {
    continueButton.style.display = 'none';
    try {
        await audioPlayer.play();
    } catch (error) {
        setStatus(`Không thể tiếp tục phát: ${error.message}`, true);
    }
});

initialize();
