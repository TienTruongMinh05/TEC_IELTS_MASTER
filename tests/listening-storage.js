(function initializeListeningStorage(global) {
    const config = global.TEC_SUPABASE_CONFIG || {};
    const bucket = 'ielts-listening';

    function publicUrl(objectPath) {
        if (!config.url || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(config.url)) {
            throw new Error('Supabase Storage chưa được cấu hình.');
        }
        if (!/^tests\/L0[1-7]\/section-0[1-4]\.mp3$/.test(objectPath)) {
            throw new Error(`Đường dẫn audio không hợp lệ: ${objectPath}`);
        }

        const encodedPath = objectPath.split('/').map(encodeURIComponent).join('/');
        return `${config.url.replace(/\/$/, '')}/storage/v1/object/public/${bucket}/${encodedPath}`;
    }

    global.TEC_LISTENING_AUDIO = Object.freeze({ bucket, publicUrl });
})(window);
