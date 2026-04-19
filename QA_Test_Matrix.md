# QA Regression Checklist - ShineTicket Phase 2

Muc tieu cua file nay:

- Giai thich ro tung testcase dang co.
- Giup QA/Dev rerun nhanh sau moi lan sua smart contract.
- Lam tai lieu doi chieu bug: fail testcase nao thi nghiep vu nao bi anh huong.

Nguon testcase:

- test/ShineTicket.test.js
- Tong so testcase hien co: 12

## Cach dung sau moi lan sua smart contract

Quy trinh bat buoc:

1. Chay compile:
   - npx hardhat compile
2. Chay full regression:
   - npx hardhat test
3. Neu co fail, tim testcase theo ID trong bang ben duoi de xac dinh nghiep vu bi vo.
4. Sau khi fix, chay lai full regression cho den khi 12/12 pass.

Trang thai su dung cho QA Status:

- Not Run
- Pass
- Fail
- Blocked

## Bang mapping nhanh (Nghiep vu -> Testcase)

| ID          | Nhom           | Testcase                                                 | Muc tieu nghiep vu                              | QA Status | Ghi chu QA |
| ----------- | -------------- | -------------------------------------------------------- | ----------------------------------------------- | --------- | ---------- |
| STK-DEP-01  | Deployment     | stores USDT token address                                | Luu dung dia chi token thanh toan               | Not Run   |            |
| STK-ROLE-01 | Access Control | grants operator role                                     | Cap dung role OPERATOR_ROLE                     | Not Run   |            |
| STK-MINT-01 | EIP-712        | creates event state from valid admin signature           | Voucher hop le tao event + mint thanh cong      | Not Run   |            |
| STK-MINT-02 | EIP-712        | rejects replayed nonce                                   | Chan replay attack bang nonce                   | Not Run   |            |
| STK-BUY-01  | Purchase       | allows direct buyer purchase with USDT                   | Mua ve bang USDT + ghi revenue                  | Not Run   |            |
| STK-BUY-02  | Purchase       | allows admin relayer purchase for fiat flow              | Relayer flow mua ho fiat thanh cong             | Not Run   |            |
| STK-BUY-03  | Purchase       | blocks non-admin from relayer buy                        | User thuong khong duoc relayer buy              | Not Run   |            |
| STK-CIN-01  | Check-in V2    | operator can batch check-in before expiry                | Check-in truoc han thanh cong                   | Not Run   |            |
| STK-CIN-02  | Check-in V2    | rejects check-in after expiry and allows admin extension | Sau han bi chan, gia han xong check-in lai duoc | Not Run   |            |
| STK-ESC-01  | Escrow         | organizer claims net revenue after event end             | Organizer claim quyen loi sau expiry            | Not Run   |            |
| STK-WG-01   | Walled Garden  | blocks regular p2p transfer                              | Chan transfer P2P trai chinh sach               | Not Run   |            |
| STK-WG-02   | Walled Garden  | allows transfer through marketplace role                 | Cho phep transfer qua marketplace role          | Not Run   |            |

## Giai thich chi tiet tung testcase

### STK-DEP-01 - stores USDT token address

- Muc dich: Dam bao constructor luu dung dia chi usdtToken.
- Ham lien quan: constructor, usdtToken().
- Pass khi: usdtToken() == dia chi MockUSDT da deploy.
- Neu fail: Moi flow buy/claim co nguy co sai token thanh toan.

### STK-ROLE-01 - grants operator role

- Muc dich: Xac nhan role OPERATOR_ROLE duoc cap dung.
- Ham lien quan: grantRole(), hasRole().
- Pass khi: hasRole(OPERATOR_ROLE, operator) = true.
- Neu fail: Batch check-in se khong van hanh nhu thiet ke.

### STK-MINT-01 - creates event state from valid admin signature

- Muc dich: Verify luong EIP-712 hop le.
- Ham lien quan: mintEventTickets(), events(), ticketToEvent().
- Pass khi:
  - Event organizer luu dung.
  - expiryTime luu dung.
  - So luong ve mint dung.
  - tokenId duoc map dung sang eventId.
- Neu fail: Luong khoi tao event bang voucher bi vo.

### STK-MINT-02 - rejects replayed nonce

- Muc dich: Bao ve replay attack.
- Ham lien quan: mintEventTickets(), usedNonces.
- Pass khi: Goi lan 2 cung voucher bi revert voi "Voucher has already been used".
- Neu fail: Co the mint lap vo han tu 1 chu ky cu.

### STK-BUY-01 - allows direct buyer purchase with USDT

- Muc dich: Xac thuc mua truc tiep bang USDT.
- Ham lien quan: buyTicket(), eventRevenue, usdtToken.transferFrom().
- Pass khi:
  - Buyer nhan dung so ve.
  - Event revenue tang dung.
  - So du USDT cua contract tang dung.
- Neu fail: Revenue hoac mint co the sai trong flow crypto.

### STK-BUY-02 - allows admin relayer purchase for fiat flow

- Muc dich: Xac thuc relayer fiat flow (mua ho).
- Ham lien quan: relayerBuyTicket().
- Pass khi:
  - Buyer duoc cap ve.
  - Revenue event duoc cong.
- Neu fail: Luong VND->USDT doi soat tren chain bi gay.

### STK-BUY-03 - blocks non-admin from relayer buy

- Muc dich: Bao mat role cho luong mua ho.
- Ham lien quan: relayerBuyTicket() + onlyRole(DEFAULT_ADMIN_ROLE).
- Pass khi: Tai khoan khong phai admin goi bi revert AccessControlUnauthorizedAccount.
- Neu fail: Bat ky user nao cung co the gia mao relayer flow.

### STK-CIN-01 - operator can batch check-in before expiry

- Muc dich: Dam bao check-in hop le truoc han.
- Ham lien quan: batchCheckIn(), ticketUsed.
- Pass khi: ticketUsed cua cac ve duoc danh dau true.
- Neu fail: Cong tac soat ve bi gian doan.

### STK-CIN-02 - rejects check-in after expiry and allows admin extension

- Muc dich: Verify module Check-in V2 day du.
- Ham lien quan: batchCheckIn(), extendEventExpiry().
- Pass khi:
  - Qua han thi check-in bi revert "Event ticket expired".
  - Sau khi admin extend expiry thi check-in thanh cong.
- Neu fail: Rule bao mat sau su kien bi vo.

### STK-ESC-01 - organizer claims net revenue after event end

- Muc dich: Dam bao co che escrow pull-payment.
- Ham lien quan: claimFunds(), fundsClaimed, eventRevenue.
- Pass khi:
  - Organizer nhan them USDT.
  - fundsClaimed(eventId) = true.
- Neu fail: Quyet toan doanh thu su kien khong an toan/chinh xac.

### STK-WG-01 - blocks regular p2p transfer

- Muc dich: Bao ve walled garden, chan P2P trai phep.
- Ham lien quan: \_beforeTokenTransfers().
- Pass khi: transfer p2p thuong bi revert "Transfer locked: Only Official Marketplace allowed".
- Neu fail: Mo cua cho cho den/scalping ngoai he thong.

### STK-WG-02 - allows transfer through marketplace role

- Muc dich: Van cho phep transfer hop le qua marketplace duoc cap quyen.
- Ham lien quan: \_beforeTokenTransfers(), MARKETPLACE_ROLE.
- Pass khi: Transfer qua account co MARKETPLACE_ROLE thanh cong.
- Neu fail: Marketplace chinh thong khong the van hanh.

## Regression gate de merge code

Dieu kien dat:

1. Compile pass.
2. Hardhat test pass 12/12.
3. Khong co testcase Priority Cao nao o trang thai Fail/Blocked.

## Deployment smoke checklist

Tham chieu script: scripts/deploy.js

Deployment checks:

- [ ] USDT_TOKEN_ADDRESS da set khi deploy non-local.
- [ ] Deploy contract thanh cong, log ra dung dia chi ShineTicket.
- [ ] Grant role mac dinh thanh cong cho OPERATOR_ROLE.
- [ ] Grant role mac dinh thanh cong cho ORGANIZER_ROLE.
- [ ] Grant role mac dinh thanh cong cho MARKETPLACE_ROLE.

Post-deploy smoke checks:

- [ ] usdtToken() tra ve dung dia chi.
- [ ] hasRole() dung voi cac dia chi role da cau hinh.
