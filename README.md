# 🏥 Hệ Thống Hồ Sơ Y Tế Điện Tử Phi Tập Trung (Patient EHR)

Dự án **Patient EHR** là một ứng dụng phi tập trung (**DApp**) giúp bệnh nhân đăng ký và quản lý hồ sơ khám bệnh một cách an toàn thông qua **Smart Contract trên Blockchain** và hệ thống lưu trữ phân tán **IPFS (Pinata)**.

File hồ sơ y tế được **mã hóa AES-GCM 256-bit** trước khi upload lên IPFS. Mật khẩu được xác thực trực tiếp trên blockchain — không lưu bất kỳ thông tin nhạy cảm nào trên máy người dùng.

---

# 🛠 Yêu cầu môi trường

- **Node.js:** Phiên bản 18 hoặc 20 hoặc latest 22 đều được
- **Ví MetaMask:** Đã cài đặt trên trình duyệt
- **Git:** Để tải mã nguồn
- **Tài khoản Pinata:** Đăng ký miễn phí tại [pinata.cloud](https://pinata.cloud) để lấy JWT

---

# 🚀 Các bước cài đặt và khởi chạy

## Bước 1: Clone và cài đặt thư viện

Mở **Terminal** và thực hiện:

```bash
git clone https://github.com/hafjeth/PatientEHR.git
cd PatientEHR

npm install        # Cài đặt cho Smart Contract

cd frontend
npm install        # Cài đặt cho Giao diện
cd ..
```

---

## Bước 2: Cấu hình biến môi trường

Trong thư mục `frontend/`, tạo file `.env` 

```bash
cp frontend/.env.example frontend/.env
```

Sau đó mở `frontend/.env` và điền thông tin thật:

```
VITE_PINATA_JWT=your_pinata_jwt_here
VITE_CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3 #có thể khác thì đổi ở đây sau khi chạy bước 4
```

**Lấy Pinata JWT:**
1. Đăng nhập tại [app.pinata.cloud](https://app.pinata.cloud)
2. Vào **API Keys** → **New Key** → chọn **Admin** → **Generate**
3. Copy toàn bộ chuỗi **JWT** dán vào `VITE_PINATA_JWT`

---

## Bước 3: Khởi động Blockchain cục bộ

Mở **Terminal số 1** tại thư mục gốc và chạy:

```bash
npx hardhat node
```

**Lưu ý:**
- Giữ Terminal này chạy xuyên suốt.
- Copy một **Private Key** (ví dụ *Account #0*) để import vào MetaMask ở bước sau.

---

## Bước 4: Deploy Smart Contract

Mở **Terminal số 2** tại thư mục gốc và chạy:

```bash
npx hardhat compile
npx hardhat ignition deploy ./ignition/modules/PatientRegistry.js --network localhost
```

Sau khi chạy xong, **copy địa chỉ Contract (`0x...`)** hiển thị trên Terminal.

Cập nhật địa chỉ vừa copy vào `frontend/.env`:

```
VITE_CONTRACT_ADDRESS=0x_dia_chi_moi_cua_ban
```

---

## Bước 5: Đồng bộ ABI

Sau mỗi lần compile lại contract, chạy lệnh sau để cập nhật ABI cho frontend:

```bash
cp artifacts/contracts/PatientRegistry.sol/PatientRegistry.json frontend/PatientRegistry.json
```

---

## Bước 6: Chạy Giao diện Web

Tại **Terminal số 2**, di chuyển vào thư mục `frontend` và chạy:

```bash
cd frontend
npm run dev
```

Sau đó truy cập:

```
http://localhost:5173
```

---

# 🦊 Cấu hình MetaMask

## Thêm mạng Hardhat

Vào MetaMask → **Add Network** → điền:

```
Tên mạng:          Hardhat Local
RPC URL:           http://127.0.0.1:8545/
Chain ID:          31337
Ký hiệu tiền tệ:  ETH
```

## Import tài khoản test

Dán **Private Key** đã copy ở Bước 3 vào MetaMask:

```
MetaMask → Import Account → Paste Private Key
```

Tài khoản sẽ có sẵn **10.000 ETH test** để thực hiện giao dịch.

## Reset Account (nếu gặp lỗi giao dịch)

Nếu MetaMask báo lỗi nonce hoặc transaction pending mãi:

```
MetaMask → Settings → Advanced → Clear activity tab data
```

---

# 🔐 Tính năng bảo mật

| Tính năng | Mô tả |
|---|---|
| Mã hóa file | AES-GCM 256-bit — file mã hóa phía client trước khi upload IPFS |
| Xác thực mật khẩu | Hash SHA-256 lưu và xác thực trực tiếp trên blockchain |
| Biến môi trường | JWT và địa chỉ contract lưu trong `.env`, không commit lên git |
| Phân quyền bác sĩ | Bệnh nhân tự cấp/thu hồi quyền xem hồ sơ qua smart contract |

---

# 📂 Cấu trúc dự án

```
PATIENTEHR/
├── contracts/
│   └── PatientRegistry.sol       # Smart contract chính
├── frontend/
│   ├── index.html                # Giao diện SPA
│   ├── main.js                   # Logic frontend
│   ├── style.css                 # CSS styling
│   ├── PatientRegistry.json      # ABI contract (đồng bộ từ artifacts/)
│   ├── .env                      # Biến môi trường (KHÔNG commit)
│   └── .env.example              # Mẫu biến môi trường
├── ignition/
│   └── modules/
│       └── PatientRegistry.js    # Script deploy
├── hardhat.config.ts             # Cấu hình Hardhat
└── README.md
```