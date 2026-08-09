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

function setStatus(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.classList.toggle('error', isError);
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

function publicUrlFor(index, cacheBust = false) {
    const section = selectedTest.sections[index];
    const { data } = supabaseClient.storage.from(manifest.bucket).getPublicUrl(section.objectPath);
    if (!data?.publicUrl) throw new Error(`Không tạo được URL cho ${section.label}.`);

    if (!cacheBust) return data.publicUrl;
    const refreshedUrl = new URL(data.publicUrl);
    refreshedUrl.searchParams.set('retry', Date.now().toString());
    return refreshedUrl.href;
}

async function loadSection(index, autoplay, options = {}) {
    if (index < 0 || index >= selectedTest.sections.length) return;

    currentSectionIndex = index;
    retryUsedForSection = Boolean(options.isRetry);
    requestedResumeTime = options.resumeTime || 0;
    continueButton.style.display = 'none';
    audioPlayer.dataset.autoplay = autoplay ? 'true' : 'false';
    updateSectionUI(index);
    setStatus(`Đang tải ${selectedTest.sections[index].label}...`);

    try {
        audioPlayer.src = publicUrlFor(index, Boolean(options.cacheBust));
        audioPlayer.load();
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
        setStatus('Không thể phát audio. Kiểm tra file đã được upload đúng đường dẫn trong manifest.', true);
        return;
    }

    const resumeTime = Number.isFinite(audioPlayer.currentTime) ? audioPlayer.currentTime : 0;
    setStatus('Kết nối audio bị gián đoạn. Đang thử tải lại...');
    await loadSection(currentSectionIndex, true, {
        cacheBust: true,
        isRetry: true,
        resumeTime
    });
}

async function initialize() {
    try {
        if (!supabaseClient) {
            throw new Error('Supabase chưa được cấu hình. Vui lòng xem README.');
        }

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
