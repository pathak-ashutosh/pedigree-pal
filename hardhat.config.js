require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const { API_URL, METAMASK_PRIVATE_KEY } = process.env;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.18",
  networks: {
    mumbai: {
      url: API_URL,
      accounts: [`0x${METAMASK_PRIVATE_KEY}`]
    }
  }
};
