# HabitGrid

HabitGrid là web theo dõi thói quen cá nhân theo ngày và theo tháng. Dữ liệu được lưu trên Supabase nên có thể đồng bộ giữa máy tính và điện thoại sau khi deploy.

## Chức năng

- Tạo và chỉnh sửa thói quen.
- Chọn các ngày lặp lại trong tuần.
- Đánh dấu hoàn thành trực tiếp trên lịch tháng.
- Tự cập nhật ngày hiện tại.
- Theo dõi tỷ lệ hoàn thành và chuỗi ngày.
- Tạo phần thưởng kèm ảnh riêng.
- Đăng nhập bằng email; dữ liệu của mỗi tài khoản được tách biệt bằng Row Level Security.

## Công nghệ

- Next.js và TypeScript
- Tailwind CSS
- Supabase Auth, PostgreSQL và Storage
- Vercel để triển khai website

## Chạy trên máy

Yêu cầu Node.js 20 trở lên.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000).

Điền thông tin Supabase trong `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Không commit `.env.local` hoặc `service_role key` lên GitHub.

## Kiểm tra bản production

```bash
npm run build
```

Khi deploy trên Vercel, thêm hai biến môi trường ở trên vào phần **Project Settings → Environment Variables**.

## Trạng thái

Đây là dự án cá nhân đang được phát triển. Phiên bản hiện tại đã hỗ trợ luồng chính: đăng nhập, quản lý thói quen, ghi nhận tiến độ và lưu ảnh phần thưởng.
