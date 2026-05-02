import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

describe("ShineTicket Phase 2", function () {
  let shineTicket;
  let mockUSDT;
  let owner;
  let organizer;
  let operator;
  let buyer;
  let outsider;
  let marketplace;

  let OPERATOR_ROLE;
  let MARKETPLACE_ROLE;

  async function latestTimestamp() {
    const block = await ethers.provider.getBlock("latest");
    return block.timestamp;
  }

  async function increaseTo(timestamp) {
    await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);
    await ethers.provider.send("evm_mine", []);
  }

  async function signVoucher(voucher) {
    const chain = await ethers.provider.getNetwork();
    const domain = {
      name: "ShineTicket",
      version: "1",
      chainId: chain.chainId,
      verifyingContract: await shineTicket.getAddress(),
    };

    const types = {
      MintVoucher: [
        { name: "eventId", type: "uint256" },
        { name: "quantity", type: "uint256" },
        { name: "commissionRateBps", type: "uint256" },
        { name: "relayerGasPerTicket", type: "uint256" },
        { name: "checkinGasPerTicket", type: "uint256" },
        { name: "expiryTime", type: "uint64" },
        { name: "nonce", type: "uint256" },
      ],
    };

    return owner.signTypedData(domain, types, voucher);
  }

  async function bootstrapEvent(
    eventId = 1,
    quantity = 10,
    price = ethers.parseUnits("10", 18),
  ) {
    const expiry = (await latestTimestamp()) + 86400;
    const voucher = {
      eventId,
      quantity,
      commissionRateBps: 300,
      relayerGasPerTicket: ethers.parseUnits("0.02", 18),
      checkinGasPerTicket: ethers.parseUnits("0.01", 18),
      expiryTime: expiry,
      nonce: eventId * 1000,
    };
    const signature = await signVoucher(voucher);

    await shineTicket.connect(organizer).mintEventTickets(voucher, signature);
    await shineTicket.connect(organizer).setEventPrice(eventId, price);

    return { expiry, voucher };
  }

  beforeEach(async function () {
    [owner, organizer, operator, buyer, outsider, marketplace] =
      await ethers.getSigners();

    OPERATOR_ROLE = ethers.id("OPERATOR_ROLE");
    MARKETPLACE_ROLE = ethers.id("MARKETPLACE_ROLE");

    const MockUSDT = await ethers.getContractFactory("MockUSDT");
    mockUSDT = await MockUSDT.deploy();

    const ShineTicket = await ethers.getContractFactory("ShineTicket");
    shineTicket = await ShineTicket.deploy(
      owner.address,
      await mockUSDT.getAddress(),
    );

    await shineTicket.grantRole(OPERATOR_ROLE, operator.address);
    await shineTicket.grantRole(MARKETPLACE_ROLE, marketplace.address);

    await mockUSDT.mint(buyer.address, ethers.parseUnits("10000", 18));
    await mockUSDT.mint(owner.address, ethers.parseUnits("10000", 18));
  });

  describe("Deployment and roles", function () {
    it("stores USDT token address", async function () {
      expect(await shineTicket.usdtToken()).to.equal(
        await mockUSDT.getAddress(),
      );
    });

    it("grants operator role", async function () {
      expect(
        await shineTicket.hasRole(OPERATOR_ROLE, operator.address),
      ).to.equal(true);
    });
  });

  describe("EIP-712 voucher mint", function () {
    it("creates event state from valid admin signature", async function () {
      const expiry = (await latestTimestamp()) + 3600;
      const voucher = {
        eventId: 1,
        quantity: 3,
        commissionRateBps: 250,
        relayerGasPerTicket: ethers.parseUnits("0.02", 18),
        checkinGasPerTicket: ethers.parseUnits("0.01", 18),
        expiryTime: expiry,
        nonce: 1,
      };
      const signature = await signVoucher(voucher);

      await shineTicket.connect(organizer).mintEventTickets(voucher, signature);

      const evt = await shineTicket.events(1);
      expect(evt.organizer).to.equal(organizer.address);
      expect(evt.expiryTime).to.equal(expiry);
      expect(await shineTicket.balanceOf(organizer.address)).to.equal(3);
      expect(await shineTicket.ticketToEvent(1)).to.equal(1);
    });

    it("rejects replayed nonce", async function () {
      const expiry = (await latestTimestamp()) + 3600;
      const voucher = {
        eventId: 1,
        quantity: 1,
        commissionRateBps: 300,
        relayerGasPerTicket: ethers.parseUnits("0.02", 18),
        checkinGasPerTicket: ethers.parseUnits("0.01", 18),
        expiryTime: expiry,
        nonce: 99,
      };
      const signature = await signVoucher(voucher);

      await shineTicket.connect(organizer).mintEventTickets(voucher, signature);
      await expect(
        shineTicket.connect(organizer).mintEventTickets(voucher, signature),
      ).to.be.revertedWith("Voucher has already been used");
    });
  });

  describe("Purchase flows", function () {
    it("allows direct buyer purchase with USDT", async function () {
      await bootstrapEvent(1, 5, ethers.parseUnits("20", 18));

      const total = ethers.parseUnits("40", 18);
      await mockUSDT
        .connect(buyer)
        .approve(await shineTicket.getAddress(), total);

      await shineTicket.connect(buyer).buyTicket(1, 2);

      expect(await shineTicket.balanceOf(buyer.address)).to.equal(2);
      expect(await shineTicket.eventRevenue(1)).to.equal(total);
      expect(await mockUSDT.balanceOf(await shineTicket.getAddress())).to.equal(
        total,
      );
    });

    it("allows admin relayer purchase for fiat flow", async function () {
      await bootstrapEvent(1, 5, ethers.parseUnits("15", 18));

      const total = ethers.parseUnits("45", 18);
      await mockUSDT
        .connect(owner)
        .approve(await shineTicket.getAddress(), total);

      await shineTicket.connect(owner).relayerBuyTicket(1, 3, buyer.address);

      expect(await shineTicket.balanceOf(buyer.address)).to.equal(3);
      expect(await shineTicket.eventRevenue(1)).to.equal(total);
    });

    it("blocks non-admin from relayer buy", async function () {
      await bootstrapEvent(1, 5, ethers.parseUnits("15", 18));

      await expect(
        shineTicket.connect(outsider).relayerBuyTicket(1, 1, buyer.address),
      ).to.be.revertedWithCustomError(
        shineTicket,
        "AccessControlUnauthorizedAccount",
      );
    });
  });

  describe("Check-in V2", function () {
    it("operator can batch check-in before expiry", async function () {
      await bootstrapEvent(1, 2, ethers.parseUnits("10", 18));

      await shineTicket.connect(operator).batchCheckIn([1, 2]);

      expect(await shineTicket.ticketUsed(1)).to.equal(true);
      expect(await shineTicket.ticketUsed(2)).to.equal(true);
    });

    it("rejects check-in after expiry and allows admin extension", async function () {
      const { expiry } = await bootstrapEvent(
        1,
        2,
        ethers.parseUnits("10", 18),
      );

      await increaseTo(expiry + 5);
      await expect(
        shineTicket.connect(operator).batchCheckIn([1]),
      ).to.be.revertedWith("Event ticket expired");

      await shineTicket.connect(owner).extendEventExpiry(1, expiry + 7200);
      await shineTicket.connect(operator).batchCheckIn([1]);
      expect(await shineTicket.ticketUsed(1)).to.equal(true);
    });
  });

  describe("Escrow claim", function () {
    it("organizer claims net revenue after event end", async function () {
      const { expiry } = await bootstrapEvent(
        1,
        5,
        ethers.parseUnits("50", 18),
      );

      const total = ethers.parseUnits("200", 18);
      await mockUSDT
        .connect(owner)
        .approve(await shineTicket.getAddress(), total);
      await shineTicket.connect(owner).relayerBuyTicket(1, 4, buyer.address);

      await increaseTo(expiry + 1);

      const organizerBefore = await mockUSDT.balanceOf(organizer.address);
      await shineTicket.connect(organizer).claimFunds(1);

      const organizerAfter = await mockUSDT.balanceOf(organizer.address);
      expect(organizerAfter).to.be.gt(organizerBefore);
      expect(await shineTicket.fundsClaimed(1)).to.equal(true);
    });
  });

  describe("Walled garden transfer", function () {
    it("blocks regular p2p transfer", async function () {
      await bootstrapEvent(1, 1, ethers.parseUnits("10", 18));

      await expect(
        shineTicket
          .connect(organizer)
          .transferFrom(organizer.address, outsider.address, 1),
      ).to.be.revertedWith(
        "Transfer locked: Only Official Marketplace allowed",
      );
    });

    it("allows transfer through marketplace role", async function () {
      await bootstrapEvent(1, 1, ethers.parseUnits("10", 18));

      await shineTicket
        .connect(organizer)
        .transferFrom(organizer.address, marketplace.address, 1);

      expect(await shineTicket.ownerOf(1)).to.equal(marketplace.address);
    });
  });
});
