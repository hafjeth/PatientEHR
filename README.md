# 🏥 Hệ Thống Hồ Sơ Y Tế Điện Tử Phi Tập Trung (Patient EHR)

Dự án **Patient EHR** là một ứng dụng phi tập trung (**DApp**) giúp bệnh nhân đăng ký, quản lý và cập nhật hồ sơ khám bệnh một cách an toàn thông qua **Smart Contract trên Blockchain** và hệ thống lưu trữ phân tán **IPFS (Pinata)**.

Dự án bao gồm 2 phần chính:

- **Smart Contract (Blockchain):** Viết bằng Solidity, chạy trên mạng cục bộ Hardhat.
- **Frontend (Giao diện Web):** HTML/CSS/JS kết hợp thư viện Viem để tương tác Web3.

---

# 🛠 Yêu cầu môi trường

Để chạy dự án, máy tính cần cài đặt sẵn:

1. **[Node.js](https://nodejs.org/)** (v18 hoặc v20)
2. **Ví MetaMask** (Extension trên trình duyệt)
3. **Git** (Dùng để clone mã nguồn)

---

# 🚀 Hướng dẫn cài đặt và khởi chạy

## Bước 1: Clone mã nguồn và cài đặt thư viện

Mở **Terminal / Command Prompt** và chạy lần lượt các lệnh sau:

```bash
# 1. Clone dự án về máy
git clone https://github.com/hafjeth/PatientEHR.git
cd PatientEHR

# 2. Cài đặt thư viện cho phần Smart Contract (thư mục gốc)
npm install

# 3. Cài đặt thư viện cho phần Frontend
cd frontend
npm install
cd ..
```

---

## Bước 2: Khởi động Blockchain cục bộ

Mở **Terminal số 1** (tại thư mục gốc `PatientEHR`) và chạy lệnh:

```bash
npx hardhat node
```

⚠️ **Lưu ý:**  
Lệnh này sẽ tạo ra **mạng Blockchain cục bộ kèm 20 ví test**.  
Không tắt Terminal này trong suốt quá trình chạy dự án.

---

## Bước 3: Deploy Smart Contract

Mở **Terminal số 2** (cũng tại thư mục gốc `PatientEHR`) và chạy lệnh triển khai:

```bash
npx hardhat run scripts/deploy.ts --network localhost
```

**Lưu ý:** Nếu thư mục `scripts` dùng file `.js`, hãy đổi thành:

```bash
npx hardhat run scripts/deploy.js --network localhost
```

Sau khi chạy xong, Terminal sẽ trả về một **Địa chỉ Contract** (dạng `0x...`).  
Hãy **copy địa chỉ này**.

---

## Bước 4: Kết nối Frontend với Blockchain

1. Mở file:

```
frontend/main.js
```

2. Tìm biến:

```javascript
const contractAddress = '...';
```

3. Dán **địa chỉ Contract** bạn vừa copy ở **Bước 3** vào.

---

### Đồng bộ file ABI

1. Mở file:

```
artifacts/contracts/PatientRegistry.sol/PatientRegistry.json
```

2. **Copy toàn bộ nội dung**

3. Dán **đè vào file**:

```
frontend/PatientRegistry.json
```

---

## Bước 5: Khởi chạy Giao diện Web

Tại **Terminal số 2**, di chuyển vào thư mục `frontend` và bật server:

```bash
cd frontend
npm run dev
```

Sau đó truy cập đường link (ví dụ):

```
http://localhost:5173
```

trên trình duyệt để sử dụng ứng dụng.

---

# 🦊 Hướng dẫn cấu hình ví MetaMask test

Mở tiện ích **MetaMask** → Chọn danh sách mạng → **Add Network** → **Add a network manually**

Điền thông số sau:

```
Tên mạng: Hardhat Localhost
URL RPC mới: http://127.0.0.1:8545/
Chain ID: 31337
Ký hiệu tiền tệ: ETH
```

Sau đó:

1. Chuyển sang mạng vừa tạo
2. Chọn **Import Account**
3. Copy một **Private Key bất kỳ từ Terminal Hardhat Node**
4. Dán vào MetaMask

Bạn sẽ nhận **10.000 ETH test**.

---

# ⚠️ Xử lý lỗi thường gặp (Troubleshooting)

## Lỗi kẹt giao dịch (Nonce quá cao)

**Nguyên nhân**

Tắt bật lại **Hardhat Node** làm reset dữ liệu, nhưng MetaMask vẫn nhớ lịch sử giao dịch cũ.

**Cách khắc phục**

MetaMask → **Settings** → **Advanced** → **Clear activity tab data**

---

## Lỗi "Ví chưa đăng ký" khi login

**Nguyên nhân**

Contract vừa được **deploy lại hoàn toàn mới**, nên dữ liệu trống.

**Khắc phục**

Truy cập trang **Register** để đăng ký lại tài khoản từ đầu.

---

## Lỗi không lấy được dữ liệu / Revert

**Khắc phục**

Đảm bảo bạn đã làm đúng **Bước 4 (Copy ABI mới nhất)**.

Nếu code **Smart Contract thay đổi**, hãy chạy lại:

```bash
npx hardhat compile
```

sau đó **copy lại ABI mới sang frontend**.
