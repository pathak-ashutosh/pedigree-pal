const path = require("path");

async function main() {
  if (network.name === "hardhat") {
    console.warn(
      "You are trying to deploy a contract to the Hardhat Network, which" +
        "gets automatically created and destroyed every time. Use the Hardhat" +
        " option '--network localhost'"
    );
  }

  const [deployer] = await ethers.getSigners();
  console.log(
    "Deploying the contracts with the account:",
    await deployer.getAddress()
  );

  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  const Token = await ethers.getContractFactory("PedigreePal");
  const token = await Token.deploy();
  await token.waitForDeployment();

  const tokenAddress = await token.getAddress();
  console.log("Token address:", tokenAddress);

  saveFrontendFiles(token, tokenAddress);
}

function saveFrontendFiles(token, tokenAddress) {
  const fs = require("fs");
  const contractsDir = path.join(__dirname, "..", "frontend", "src", "contracts");

  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir);
  }

  fs.writeFileSync(
    path.join(contractsDir, "contract-address.json"),
    JSON.stringify({ Token: tokenAddress }, undefined, 2)
  );

  const TokenArtifact = artifacts.readArtifactSync("PedigreePal");

  fs.writeFileSync(
    path.join(contractsDir, "PedigreePal.json"),
    JSON.stringify(TokenArtifact, null, 2)
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
