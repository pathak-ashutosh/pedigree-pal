require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const { API_URL, METAMASK_PRIVATE_KEY } = process.env;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28",
  networks: {
    ...(API_URL && METAMASK_PRIVATE_KEY ? {
      amoy: {
        url: API_URL,
        accounts: [`0x${METAMASK_PRIVATE_KEY}`]
      }
    } : {})
  }
};
