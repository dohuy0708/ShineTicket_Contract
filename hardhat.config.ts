import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import * as dotenv from "dotenv";
dotenv.config();

export default {
  plugins: [hardhatToolboxMochaEthersPlugin],
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      production: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  networks: {
    hardhat: { type: "edr-simulated", allowUnlimitedContractSize: true },
    amoy: {
      type: "http",
      url: process.env.RPC_URL || "https://rpc-amoy.polygon.technology",
      chainId: 80002,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: {
      polygonAmoy: "2M373VBQCAUPAFNYZZQ1X8637YHG28P26H",
      polygonMumbai: "2M373VBQCAUPAFNYZZQ1X8637YHG28P26H",
      polygon: "2M373VBQCAUPAFNYZZQ1X8637YHG28P26H",
      polygonscan: "2M373VBQCAUPAFNYZZQ1X8637YHG28P26H",
      polygonScan: "2M373VBQCAUPAFNYZZQ1X8637YHG28P26H",
      amoy: "2M373VBQCAUPAFNYZZQ1X8637YHG28P26H"
    },
    customChains: [
      {
        network: "polygonAmoy",
        chainId: 80002,
        urls: {
          apiURL: "https://api-amoy.polygonscan.com/api",
          browserURL: "https://amoy.polygonscan.com/"
        }
      }
    ]
  }
};
