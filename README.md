# TEC IELTS MASTER

Nền tảng luyện thi IELTS chạy trên GitHub Pages. Audio Listening được cung cấp công khai qua Supabase Storage; người học không cần đăng nhập.

## Chạy local

Không mở `index.html` trực tiếp bằng `file://`, vì trình duyệt sẽ chặn các lệnh `fetch`. Chạy HTTP server tại thư mục repo:

```powershell
python -m http.server 8000
```

Sau đó mở `http://127.0.0.1:8000/`.

## Cấu hình Supabase

### 1. Cấu hình frontend

Lấy Project URL và publishable key trong Supabase Dashboard, rồi cập nhật `supabase-config.js`:

```js
window.TEC_SUPABASE_CONFIG = Object.freeze({
    url: 'https://PROJECT_REF.supabase.co',
    publishableKey: 'sb_publishable_...'
});
```

Project URL và publishable key được thiết kế để dùng trong browser. Không đưa `service_role`, secret key hoặc database password vào source code.

### 2. Tạo public Storage bucket

Các migration trong repo tạo bucket `ielts-listening`, giới hạn 50 MB/file và chuyển bucket sang public:

```powershell
npx supabase@2.113.0 login
npx supabase@2.113.0 link --project-ref PROJECT_REF
npx supabase@2.113.0 db push
```

Public bucket cho phép mọi người nghe audio nếu có URL. Browser không có policy upload, update hoặc delete; audio chỉ được quản trị qua Dashboard hoặc công cụ server-side an toàn.

## Chuẩn bị audio Listening

Mỗi bài gồm đúng 4 object:

```text
ielts-listening/
  tests/L01/section-01.mp3
  tests/L01/section-02.mp3
  tests/L01/section-03.mp3
  tests/L01/section-04.mp3
```

L2–L7 dùng folder `L02`–`L07`. Tên object phải khớp `listening_manifest.json`.

### Chia file nguồn

Nếu file nguồn đã là MP3/M4A tương thích browser, ưu tiên stream-copy để không giảm chất lượng. Thay các mốc thời gian bằng ranh giới section thực tế:

```powershell
ffmpeg -i input.mp3 -ss 00:00:00 -to 00:10:00 -c copy section-01.mp3
```

Nếu section vẫn từ 50 MB trở lên hoặc codec không tương thích, encode thành MP3 128 kbps stereo:

```powershell
ffmpeg -i section-source.wav -c:a libmp3lame -b:a 128k -ac 2 section-01.mp3
```

Trước khi upload, kiểm tra từng file nhỏ hơn 50 MB. Upload với `Content-Type: audio/mpeg` và `Cache-Control: 86400`.

Không commit audio nguồn vào Git. Khi thay audio, dùng object path có version mới như `section-01-v2.mp3`, rồi cập nhật manifest để tránh browser dùng cache cũ.

## Bật một bài Listening

Một bài chỉ được bật khi đủ và kiểm tra được cả 4 section:

1. Upload 4 object đúng path.
2. Mở public URL của từng object để xác minh file phát và tua được.
3. Trong `listening_manifest.json`, đổi `available` của bài thành `true`.
4. Trong `task_list.json`, đổi `available` của cùng bài thành `true`.
5. Kiểm tra player tự chuyển Section 1 → 4.

Các bài có `available: false` hiển thị **Đang cập nhật audio** và không tạo link hỏng.

## Kiểm tra trước khi deploy

```powershell
node --check script.js
node --check tests/listening-player.js
node tests/validate-listening.mjs
Get-Content task_list.json -Raw | ConvertFrom-Json | Out-Null
Get-Content listening_manifest.json -Raw | ConvertFrom-Json | Out-Null
git diff --check
```

Ngoài kiểm tra tĩnh, cần xác minh thủ công:

- Trang chủ không yêu cầu đăng nhập.
- Public object URL trả audio và hỗ trợ byte-range/HTTP 206 để tua.
- Section 1–4 phát đúng thứ tự và tự chuyển section.
- Browser không thể upload, sửa hoặc xóa object bằng publishable key.

## Cấu trúc Listening

- `listening_manifest.json`: metadata và public object path.
- `tests/TEC_IELTS_Listening_Player.html`: giao diện player dùng chung.
- `tests/listening-player.js`: public URL, chuyển section và retry.
- `supabase/migrations/`: cấu hình bucket có thể tái tạo.
