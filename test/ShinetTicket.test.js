import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();
describe("ShineTicket System", function () {
  let ShineTicket, shineTicket;
  let owner, worker, user1, user2, user3;

  beforeEach(async function () {
    // Lấy danh sách ví giả lập
    [owner, user1, user2, user3] = await ethers.getSigners();

    // Deploy contract mới trước mỗi bài test
    ShineTicket = await ethers.getContractFactory("ShineTicket");
    shineTicket = await ShineTicket.deploy(owner.address);
  });

  describe("1. Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await shineTicket.owner()).to.equal(owner.address);
    });

    it("Should start token ID from 1", async function () {
      // Mint thử 1 vé để xem ID bắt đầu là bao nhiêu
      await shineTicket.mintTicket(user1.address, 1);
      expect(await shineTicket.ownerOf(1)).to.equal(user1.address);
    });
  });

  describe("2. Minting Features", function () {
    // TEST QUAN TRỌNG NHẤT: MINT BATCH CHO NHIỀU NGƯỜI
    it("Should mint batch for MULTIPLE users correctly (mintBatchUsers)", async function () {
      // Kịch bản:
      // User1 mua 1 vé
      // User2 mua 2 vé
      // User3 mua 1 vé
      const recipients = [user1.address, user2.address, user3.address];
      const quantities = [1, 2, 1];

      // Worker gọi hàm mint batch
      await shineTicket.connect(owner).mintBatchUsers(recipients, quantities);

      // Kiểm tra số lượng vé trong ví từng người
      expect(await shineTicket.balanceOf(user1.address)).to.equal(1);
      expect(await shineTicket.balanceOf(user2.address)).to.equal(2);
      expect(await shineTicket.balanceOf(user3.address)).to.equal(1);

      // Kiểm tra Token ID được phân phối đúng thứ tự (ERC721A)
      // ID 1 -> User1
      expect(await shineTicket.ownerOf(1)).to.equal(user1.address);
      // ID 2 -> User2
      expect(await shineTicket.ownerOf(2)).to.equal(user2.address);
      // ID 3 -> User2 (Vé thứ 2 của User2)
      expect(await shineTicket.ownerOf(3)).to.equal(user2.address);
      // ID 4 -> User3
      expect(await shineTicket.ownerOf(4)).to.equal(user3.address);
    });

    it("Should fail if array lengths mismatch", async function () {
      const recipients = [user1.address];
      const quantities = [1, 2]; // Sai dữ liệu

      await expect(
        shineTicket.connect(owner).mintBatchUsers(recipients, quantities)
      ).to.be.revertedWith("Data mismatch");
    });

    // Test tính năng backup (Mint tay cho 1 người)
    it("Should mint bulk for SINGLE user correctly (mintTicket)", async function () {
      await shineTicket.connect(owner).mintTicket(user1.address, 5);
      expect(await shineTicket.balanceOf(user1.address)).to.equal(5);
    });
  });

  describe("3. Check-in Feature", function () {
    beforeEach(async function () {
      // Setup: Mint trước 1 vé cho User1 (Token ID sẽ là 1)
      await shineTicket.connect(owner).mintTicket(user1.address, 1);
    });

    it("Worker can check-in a valid ticket", async function () {
      // Trạng thái ban đầu: false
      expect(await shineTicket.isTicketUsed(1)).to.equal(false);

      // Thực hiện check-in
      await expect(shineTicket.connect(owner).checkIn(1))
        .to.emit(shineTicket, "TicketUsed")
        .withArgs(1, owner.address, await timeTimestamp());

      // Trạng thái sau đó: true
      expect(await shineTicket.isTicketUsed(1)).to.equal(true);
    });

    it("Cannot check-in the same ticket twice", async function () {
      await shineTicket.connect(owner).checkIn(1);

      // Lần 2 phải lỗi
      await expect(shineTicket.connect(owner).checkIn(1)).to.be.revertedWith(
        "Ticket already used"
      );
    });

    it("Cannot check-in non-existent ticket", async function () {
      await expect(shineTicket.connect(owner).checkIn(999)).to.be.revertedWith(
        "Ticket does not exist"
      );
    });

    it("User CANNOT check-in by themselves", async function () {
      await expect(
        shineTicket.connect(user1).checkIn(1)
      ).to.be.revertedWithCustomError(
        shineTicket,
        "OwnableUnauthorizedAccount"
      );
    });
  });
});

// Helper function để lấy timestamp block hiện tại (cho việc check event)
async function timeTimestamp() {
  const blockNumBefore = await ethers.provider.getBlockNumber();
  const blockBefore = await ethers.provider.getBlock(blockNumBefore);
  return blockBefore.timestamp + 1; // +1 vì block tiếp theo sẽ tăng time
}
