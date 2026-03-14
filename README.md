# 🏥 Hệ Thống Hồ Sơ Y Tế Điện Tử Phi Tập Trung (Patient EHR)

Dự án **Patient EHR** là một ứng dụng phi tập trung (**DApp**) giúp bệnh nhân đăng ký và quản lý hồ sơ khám bệnh một cách an toàn thông qua **Smart Contract trên Blockchain** và hệ thống lưu trữ phân tán **IPFS (Pinata)**.

---

# 🛠 Yêu cầu môi trường

- **Node.js:** Phiên bản 18 hoặc 20  
- **Ví MetaMask:** Đã cài đặt trên trình duyệt  
- **Git:** Để tải mã nguồn  

---

# 🚀 Các bước cài đặt và khởi chạy

## Bước 1: Clone và cài đặt thư viện

Mở **Terminal** và thực hiện:

```bash
git clone https://github.com/hafjeth/PatientEHR.git
cd PatientEHR

npm install   # Cài đặt cho Smart Contract

cd frontend
npm install   # Cài đặt cho Giao diện
cd ..
```

---

## Bước 2: Khởi động Blockchain cục bộ

Mở **Terminal số 1** tại thư mục gốc và chạy:

```bash
npx hardhat node
```

**Lưu ý:**  
Hãy giữ Terminal này chạy xuyên suốt.  
Copy một đoạn **Private Key** (ví dụ *Account #0*) để import vào MetaMask sau này.

---

## Bước 3: Deploy Smart Contract

Mở **Terminal số 2** tại thư mục gốc và chạy:

```bash
npx hardhat ignition deploy ./ignition/modules/PatientRegistry.js --network localhost
```

Sau khi chạy xong, **copy địa chỉ Contract (`0x...`)** hiển thị trên Terminal.

---

## Bước 4: Cấu hình mã nguồn

Mở file:

```
frontend/main.js
```

Cập nhật hai thông tin sau:

### 1. Contract Address

Dán địa chỉ vừa copy ở **Bước 3** vào:

```javascript
const contractAddress = '...';
```

---

### 2. Pinata JWT

Truy cập **Pinata**, tạo **API Key (Admin)** và dán mã JWT vào:

```javascript
const PINATA_JWT = '...';
```

Mục đích: Cho phép **upload file hồ sơ y tế lên IPFS**.

---

### 3. Đồng bộ ABI

1. Mở file:

```
artifacts/contracts/PatientRegistry.sol/PatientRegistry.json
```

2. **Copy toàn bộ nội dung**

3. **Dán đè vào file:**

```
frontend/PatientRegistry.json
```

---

## Bước 5: Chạy Giao diện Web

Tại **Terminal số 2**, di chuyển vào thư mục `frontend` và chạy:

```bash
npm run dev
```

Sau đó truy cập:

```
http://localhost:5173
```

để bắt đầu sử dụng ứng dụng.

---

# 🦊 Cấu hình MetaMask

## Thêm mạng mới

Điền các thông số sau:

```
Tên mạng: Hardhat
RPC URL: http://127.0.0.1:8545/
Chain ID: 31337
Ký hiệu tiền tệ: ETH
```

---

## Import Account

Dán **Private Key** bạn đã copy ở **Bước 2** vào MetaMask để nhận:

```
10.000 ETH test
```

---

## Reset Account

Nếu gặp lỗi giao dịch:

```
MetaMask → Settings → Advanced → Clear activity tab data
```

Điều này sẽ **reset nonce giao dịch** và giúp MetaMask đồng bộ lại với Hardhat.
