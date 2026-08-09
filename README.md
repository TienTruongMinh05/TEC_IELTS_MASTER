# TEC IELTS MASTER

Nền tảng luyện thi IELTS chạy trên GitHub Pages. Google Login và audio Listening riêng tư được cung cấp qua Supabase.

## Chạy local

Không mở `index.html` trực tiếp bằng `file://`, vì trình duyệt sẽ chặn các lệnh `fetch`. Chạy một HTTP server tại thư mục repo:

```powershell
python -m http.server 8000
```

Sau đó mở `http://127.0.0.1:8000/`.

## Cấu hình Supabase

### 1. Tạo project và Google OAuth

Tạo một Supabase project riêng cho ứng dụng ở region Singapore. Trong Supabase Dashboard:

1. Mở **Authentication → URL Configuration**.
2. Đặt Site URL thành `https://tientruongminh05.github.io/TEC_IELTS_MASTER/`.
3. Thêm redirect URL `http://127.0.0.1:8000/` và `http://localhost:8000/`.
4. Mở **Authentication → Providers → Google** và bật Google provider.
5. Trong Google Auth Platform, thêm callback URL do Supabase cung cấp vào **Authorized redirect URIs**.
6. Chỉ cấp các scope `openid`, `userinfo.email` và `userinfo.profile`.

Google Client Secret chỉ được nhập trong Supabase Dashboard hoặc biến môi trường local. Không commit secret này.

### 2. Cấu hình frontend

Lấy Project URL và publishable key trong Supabase Dashboard, rồi cập nhật `supabase-config.js`:

```js
window.TEC_SUPABASE_CONFIG = Object.freeze({
    url: 'https://PROJECT_REF.supabase.co',
    publishableKey: 'sb_publishable_...'
});
```

Project URL và publishable key được thiết kế để dùng ở browser. Không dùng legacy `service_role` hoặc secret key trong file này.

### 3. Tạo private Storage bucket và RLS

Repo có migration tạo private bucket `ielts-listening`, giới hạn 50 MB/file và chỉ cho role `authenticated` đọc audio.

```powershell
npx supabase@2.113.0 login
npx supabase@2.113.0 link --project-ref PROJECT_REF
npx supabase@2.113.0 db push
```

Browser không có policy upload/update/delete. Audio chỉ được upload bởi quản trị viên trong Dashboard hoặc công cụ server-side.

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
2. Đăng nhập trên web và xác minh từng section phát/tua được.
3. Trong `listening_manifest.json`, đổi `available` của bài thành `true`.
4. Trong `task_list.json`, đổi `available` của cùng bài thành `true`.
5. Kiểm tra player tự chuyển Section 1 → 4.

Các bài có `available: false` hiển thị **Đang cập nhật audio** và không tạo link hỏng.

## Kiểm tra trước khi deploy

```powershell
node --check script.js
node --check tests/listening-player.js
Get-Content task_list.json -Raw | ConvertFrom-Json | Out-Null
Get-Content listening_manifest.json -Raw | ConvertFrom-Json | Out-Null
git diff --check
```

Ngoài kiểm tra tĩnh, cần xác minh thủ công:

- User chưa đăng nhập không lấy được signed URL.
- Direct private object URL trả 401/403.
- Signed URL trả byte-range/HTTP 206 và cho phép seek.
- URL hết hạn được cấp lại mà không phát lại từ đầu.
- Logout dừng audio và quay về trạng thái yêu cầu đăng nhập.

## Cấu trúc Listening

- `listening_manifest.json`: metadata và private object path, không chứa signed URL.
- `tests/TEC_IELTS_Listening_Player.html`: giao diện player dùng chung.
- `tests/listening-player.js`: auth guard, signed URL, chuyển section và retry.
- `supabase/migrations/`: cấu hình bucket và Storage RLS có thể tái tạo.
