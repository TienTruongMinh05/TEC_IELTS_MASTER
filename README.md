# TEC IELTS MASTER

Nền tảng luyện thi IELTS chạy trên GitHub Pages. Google Login dùng Firebase Auth cũ; audio Listening được cung cấp công khai qua Supabase Storage.

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

## Firebase Google Login

Trang chủ giữ nguyên Firebase project `tec-ielts-master` và Google popup login từ phiên bản gốc. Firebase Auth chỉ khóa/mở nút làm bài trên giao diện; Supabase Storage không phụ thuộc Firebase token.

Khi deploy sang domain mới, chủ Firebase project phải thêm domain đó vào **Authentication → Settings → Authorized domains**. Nếu bạn không có quyền quản trị project Firebase cũ, login có thể chỉ hoạt động trên những domain đã được chủ project cho phép.

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

## Giao diện bài Listening

Mỗi bài Listening có trang HTML riêng với 40 câu hỏi, timer, chấm điểm và tải báo cáo. Audio không được nhúng vào HTML; trang dùng `tests/listening-storage.js` để tạo public URL từ object path trong Supabase.

Một bài chỉ được bật khi đủ và kiểm tra được cả 4 section:

1. Upload 4 object đúng path.
2. Mở public URL của từng object để xác minh file phát và tua được.
3. Trong `listening_manifest.json`, đổi `available` của bài thành `true`.
4. Trong `task_list.json`, đổi `available` của cùng bài thành `true`.
5. Kiểm tra player tự chuyển Section 1 → 4.

URL player cũ `tests/TEC_IELTS_Listening_Player.html?test=L1` đến `L7` vẫn được giữ để chuyển hướng sang trang bài thi tương ứng.

## Kiểm tra trước khi deploy

```powershell
node --check script.js
node --check tests/listening-storage.js
node tests/validate-listening.mjs
Get-Content task_list.json -Raw | ConvertFrom-Json | Out-Null
Get-Content listening_manifest.json -Raw | ConvertFrom-Json | Out-Null
git diff --check
```

Ngoài kiểm tra tĩnh, cần xác minh thủ công:

- Firebase Google popup đăng nhập và đăng xuất hoạt động trên domain đã được cho phép.
- Khi chưa đăng nhập, bài có sẵn hiển thị yêu cầu đăng nhập.
- Public object URL trả audio và hỗ trợ byte-range/HTTP 206 để tua.
- Mỗi trang L1–L7 hiển thị đủ 40 câu và tải đúng 4 recording tương ứng.
- Browser không thể upload, sửa hoặc xóa object bằng publishable key.

## Cấu trúc Listening

- `listening_manifest.json`: metadata và public object path.
- `tests/TEC_IELTS_Listening_Mock_Test_1.html` đến `_7.html`: giao diện và nội dung riêng của từng bài.
- `tests/listening-storage.js`: kiểm tra object path và tạo public Storage URL.
- `tests/TEC_IELTS_Listening_Player.html`: chuyển hướng tương thích cho URL cũ.
- `supabase/migrations/`: cấu hình bucket có thể tái tạo.
