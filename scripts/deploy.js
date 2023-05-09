
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const PedigreePal = await ethers.getContractFactory("PedigreePal");
  const pedigreePal = await PedigreePal.deploy();
  await pedigreePal.deployed();

  console.log("PedigreePal contract deployed to:", pedigreePal.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
