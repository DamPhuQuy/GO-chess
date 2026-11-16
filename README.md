# Cờ Vây — đấu với máy

Ứng dụng cờ vây client/server dùng NestJS/TypeScript và React. Backend quản lý luật, trạng thái ván và cẩm nang; frontend dùng React cùng Wouter để điều hướng giữa trang chơi và `/docs`. Có thể chọn bàn 9×9 hoặc 19×19.

## Chạy bản phát triển tại chỗ

Cần Node.js 24 trở lên. Khi phát triển, chạy backend và frontend trong hai terminal:

```sh
cd backend
npm ci
npm run start:dev
```

```sh
cd frontend
npm ci
npm run dev
```

Mở <http://127.0.0.1:5173>. Vite chuyển tiếp `/api` và yêu cầu JSON tới `/docs` về NestJS ở `127.0.0.1:8080`. Có thể đổi địa chỉ backend bằng biến môi trường `BACKEND_ORIGIN`.

## Chạy bằng Docker Compose

Cần Docker Engine và Docker Compose. Từ thư mục gốc, build rồi khởi động hai container:

```sh
docker compose up --build
```

Mở <http://localhost:8088>. Nginx phục vụ React và chuyển tiếp API tới NestJS; Compose đợi backend khỏe trước khi khởi động frontend. Có thể đổi cổng web bằng cách đặt `FRONTEND_PORT` (ví dụ `FRONTEND_PORT=3000 docker compose up --build`). Dừng stack bằng `docker compose down`.

Các ván cờ vẫn nằm trong bộ nhớ backend nên sẽ mất khi container backend khởi động lại.

## Cách chơi trong MVP

- Người chơi cầm Đen và đi trước; máy cầm Trắng.
- Backend kiểm tra lượt đi, giao điểm, bắt quân, tự sát và ko đơn giản.
- Bỏ lượt hoặc đầu hàng đều được hỗ trợ; hai lượt bỏ liên tiếp kết thúc ván.
- Tính điểm diện tích từ quân còn trên bàn và vùng trống chỉ giáp một màu; Trắng được cộng 7,5 điểm komi.
- Máy dùng heuristic cơ bản để chọn nước hợp lệ. Đây không phải engine cờ vây chuyên nghiệp.
- Ván cờ lưu trong bộ nhớ và mất khi server khởi động lại. MVP chưa có màn hình đánh dấu nhóm chết để phân xử cuối ván.

## API chính

- `GET /api/health`: kiểm tra server.
- `POST /api/games` với `{"boardSize":9}` hoặc `{"boardSize":19}`: tạo ván.
- `GET /api/games/{id}`: lấy trạng thái ván.
- `POST /api/games/{id}/actions`: gửi `{"type":"move","x":2,"y":3}`, `{"type":"pass"}` hoặc `{"type":"resign"}`. Với nước đi hợp lệ, server tự thực hiện lượt của máy trước khi trả trạng thái mới.
- `GET /docs` với `Accept: application/json`: lấy nội dung cẩm nang luật chơi. Yêu cầu điều hướng HTML tới cùng đường dẫn sẽ nhận SPA entry page.
