const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Contract", function () {
  it("Deployment should register a new dog", async function () {
    const [owner] = await ethers.getSigners();

    const Contract = await ethers.getContractFactory("PedigreePal");

    const hardhatToken = await Contract.deploy();

    await hardhatToken.deployed();

    const dogDetails = await hardhatToken.registerDog(hardhatToken.name, hardhatToken.breed, hardhatToken.sex, hardhatToken.age, hardhatToken.mother, hardhatToken.father);
    expect(await hardhatToken.retreiveDog()).to.equal(dogDetails);
  });
});