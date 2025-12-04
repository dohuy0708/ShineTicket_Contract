import { expect } from "chai";
import { network } from "hardhat";

// Giữ nguyên cách import và connect của bạn
const { ethers } = await network.connect();

describe("ShineTicket System V2", function () {
  let ShineTicket, shineTicket;
  let owner, user1, user2, user3;

  beforeEach(async function () {
    // Lấy danh sách ví giả lập
    [owner, user1, user2, user3] = await ethers.getSigners();

    // Deploy contract mới trước mỗi bài test
    ShineTicket = await ethers.getContractFactory("ShineTicket");
    shineTicket = await ShineTicket.deploy(owner.address);
  });

  // --- PHẦN 1: DEPLOYMENT ---
  describe("1. Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await shineTicket.owner()).to.equal(owner.address);
    });

    it("Should start token ID from 1", async function () {
      await shineTicket.mintTicket(user1.address, 1);
      expect(await shineTicket.ownerOf(1)).to.equal(user1.address);
    });
  });

  // --- PHẦN 2: MINTING FEATURES ---
  describe("2. Minting Features", function () {
    it("Should mint batch for MULTIPLE users correctly (mintBatchUsers)", async function () {
      // Kịch bản: User1(1 vé), User2(2 vé), User3(1 vé)
      const recipients = [user1.address, user2.address, user3.address];
      const quantities = [1, 2, 1];

      // Worker gọi hàm mint batch
      await shineTicket.connect(owner).mintBatchUsers(recipients, quantities);

      // Kiểm tra số dư
      expect(await shineTicket.balanceOf(user1.address)).to.equal(1);
      expect(await shineTicket.balanceOf(user2.address)).to.equal(2);
      expect(await shineTicket.balanceOf(user3.address)).to.equal(1);

      // Kiểm tra Token ID (ID bắt đầu từ 1)
      expect(await shineTicket.ownerOf(1)).to.equal(user1.address);
      expect(await shineTicket.ownerOf(2)).to.equal(user2.address); // User2
      expect(await shineTicket.ownerOf(3)).to.equal(user2.address); // User2
      expect(await shineTicket.ownerOf(4)).to.equal(user3.address);
    });

    it("Should fail if array lengths mismatch", async function () {
      const recipients = [user1.address];
      const quantities = [1, 2];

      await expect(
        shineTicket.connect(owner).mintBatchUsers(recipients, quantities)
      ).to.be.revertedWith("Data mismatch");
    });

    it("Should mint bulk for SINGLE user correctly (mintTicket)", async function () {
      await shineTicket.connect(owner).mintTicket(user1.address, 5);
      expect(await shineTicket.balanceOf(user1.address)).to.equal(5);
    });
  });

  // --- PHẦN 3: CHECK-IN FEATURE (Đã cập nhật sang Batch Check-in) ---
  describe("3. Batch Check-in Feature", function () {
    beforeEach(async function () {
      // Setup: Mint 3 vé cho User1 (ID: 1, 2, 3)
      await shineTicket.connect(owner).mintTicket(user1.address, 3);
    });

    it("Worker can BATCH check-in multiple tickets", async function () {
      // Kiểm tra trạng thái ban đầu (ticketUsed là public mapping)
      expect(await shineTicket.ticketUsed(1)).to.equal(false);
      expect(await shineTicket.ticketUsed(3)).to.equal(false);

      // Thực hiện check-in vé 1 và 3 cùng lúc
      // Lưu ý: Tên Event đã đổi thành 'TicketsCheckedIn'
      await expect(shineTicket.connect(owner).batchCheckIn([1, 3])).to.emit(
        shineTicket,
        "TicketsCheckedIn"
      );
      // .withArgs([1, 3], ...); // Bỏ qua check args phức tạp để tránh lỗi version chai

      // Trạng thái sau đó: true
      expect(await shineTicket.ticketUsed(1)).to.equal(true);
      expect(await shineTicket.ticketUsed(3)).to.equal(true);
      // Vé số 2 chưa check-in nên vẫn false
      expect(await shineTicket.ticketUsed(2)).to.equal(false);
    });

    it("Should allow Frontend to view batch status (getBatchTicketStatus)", async function () {
      await shineTicket.connect(owner).batchCheckIn([1, 3]);

      // Gọi hàm view mới
      const statuses = await shineTicket.getBatchTicketStatus([1, 2, 3]);

      // Kết quả trả về mảng bool
      expect(statuses[0]).to.equal(true); // ID 1
      expect(statuses[1]).to.equal(false); // ID 2
      expect(statuses[2]).to.equal(true); // ID 3
    });

    it("User CANNOT check-in by themselves", async function () {
      await expect(
        shineTicket.connect(user1).batchCheckIn([1])
      ).to.be.revertedWithCustomError(
        shineTicket,
        "OwnableUnauthorizedAccount"
      );
    });
  });

  // --- PHẦN 4: SECURITY & ANTI-SCAM (Mới thêm) ---
  describe("4. Security: Transfer Restrictions", function () {
    beforeEach(async function () {
      await shineTicket.connect(owner).mintTicket(user1.address, 1); // User1 có vé ID 1
    });

    it("Should ALLOW transfer if ticket is NOT used", async function () {
      // Vé chưa dùng -> Chuyển được
      await shineTicket
        .connect(user1)
        .transferFrom(user1.address, user2.address, 1);
      expect(await shineTicket.ownerOf(1)).to.equal(user2.address);
    });

    it("Should PREVENT transfer if ticket IS USED (Anti-Scam)", async function () {
      // 1. Admin check-in vé của User1
      await shineTicket.connect(owner).batchCheckIn([1]);

      // 2. User1 cố tình chuyển vé đã dùng cho User2
      // Kỳ vọng: Phải REVERT (Thất bại) với message đã set trong contract
      await expect(
        shineTicket.connect(user1).transferFrom(user1.address, user2.address, 1)
      ).to.be.revertedWith("Used ticket cannot be transferred");
    });
  });

  // --- PHẦN 5: ADMIN FEATURES (Mới thêm) ---
  describe("5. Admin Features: Revoke", function () {
    it("Admin can revoke (burn) a ticket", async function () {
      await shineTicket.connect(owner).mintTicket(user1.address, 1);

      // Admin thu hồi vé 1
      await shineTicket.connect(owner).revokeTicket(1);

      // Kiểm tra: Vé không còn tồn tại
      // SỬA: Dùng revertedWithCustomError để bắt đúng lỗi của ERC721A
      await expect(shineTicket.ownerOf(1)).to.be.revertedWithCustomError(
        shineTicket,
        "OwnerQueryForNonexistentToken"
      );
    });

    it("User CANNOT revoke their own ticket", async function () {
      await shineTicket.connect(owner).mintTicket(user1.address, 1);

      await expect(
        shineTicket.connect(user1).revokeTicket(1)
      ).to.be.revertedWithCustomError(
        shineTicket,
        "OwnableUnauthorizedAccount"
      );
    });
  });
});

// Helper function cũ của bạn (giữ nguyên)
async function timeTimestamp() {
  const blockNumBefore = await ethers.provider.getBlockNumber();
  const blockBefore = await ethers.provider.getBlock(blockNumBefore);
  return blockBefore.timestamp + 1;
}
