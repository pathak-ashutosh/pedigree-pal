const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("PedigreePal", function () {
  async function deployFixture() {
    const [owner, addr1, addr2] = await ethers.getSigners();
    const PedigreePal = await ethers.getContractFactory("PedigreePal");
    const contract = await PedigreePal.deploy();
    await contract.waitForDeployment();
    return { contract, owner, addr1, addr2 };
  }

  // ─── Deployment ────────────────────────────────────────────────────────────

  describe("Deployment", function () {
    it("sets owner to deployer", async function () {
      const { contract, owner } = await loadFixture(deployFixture);
      expect(await contract.owner()).to.equal(owner.address);
    });

    it("initializes dogId to 0", async function () {
      const { contract } = await loadFixture(deployFixture);
      expect(await contract.dogId()).to.equal(0n);
    });

    it("dogs mapping is empty on deploy", async function () {
      const { contract } = await loadFixture(deployFixture);
      const dog = await contract.retrieveDog(0);
      expect(dog.name).to.equal("");
      expect(dog.age).to.equal(0n);
    });
  });

  // ─── registerDog ───────────────────────────────────────────────────────────

  describe("registerDog", function () {
    it("stores dog with all correct fields", async function () {
      const { contract, owner } = await loadFixture(deployFixture);
      await contract.registerDog("Rex", "Labrador", "M", 3, 0, 0);
      const dog = await contract.retrieveDog(0);
      expect(dog.id).to.equal(0n);
      expect(dog.name).to.equal("Rex");
      expect(dog.breed).to.equal("Labrador");
      expect(dog.sex).to.equal("M");
      expect(dog.age).to.equal(3n);
      expect(dog.mother).to.equal(0n);
      expect(dog.father).to.equal(0n);
      expect(dog.owner).to.equal(owner.address);
    });

    it("increments dogId after each registration", async function () {
      const { contract } = await loadFixture(deployFixture);
      expect(await contract.dogId()).to.equal(0n);
      await contract.registerDog("Rex", "Labrador", "M", 3, 0, 0);
      expect(await contract.dogId()).to.equal(1n);
      await contract.registerDog("Bella", "Poodle", "F", 2, 0, 0);
      expect(await contract.dogId()).to.equal(2n);
    });

    it("emits Register event with correct args", async function () {
      const { contract } = await loadFixture(deployFixture);
      await expect(contract.registerDog("Rex", "Labrador", "M", 3, 0, 0))
        .to.emit(contract, "Register")
        .withArgs("Rex", "Labrador", "M", 3n, 0n, 0n);
    });

    it("allows any address to register", async function () {
      const { contract, addr1 } = await loadFixture(deployFixture);
      await contract.connect(addr1).registerDog("Buddy", "Beagle", "M", 1, 0, 0);
      const dog = await contract.retrieveDog(0);
      expect(dog.owner).to.equal(addr1.address);
    });

    it("assigns sequential IDs starting from 0", async function () {
      const { contract } = await loadFixture(deployFixture);
      await contract.registerDog("Dog0", "Breed", "M", 1, 0, 0);
      await contract.registerDog("Dog1", "Breed", "F", 2, 0, 0);
      expect((await contract.retrieveDog(0)).id).to.equal(0n);
      expect((await contract.retrieveDog(1)).id).to.equal(1n);
    });

    it("registers dog with parent IDs referencing existing dogs", async function () {
      const { contract } = await loadFixture(deployFixture);
      await contract.registerDog("Luna", "Labrador", "F", 4, 0, 0); // ID 0
      await contract.registerDog("Max", "Labrador", "M", 5, 0, 0);  // ID 1
      await contract.registerDog("Puppy", "Labrador", "M", 0, 0, 1);
      const puppy = await contract.retrieveDog(2);
      expect(puppy.mother).to.equal(0n);
      expect(puppy.father).to.equal(1n);
    });

    it("stores special characters in name", async function () {
      const { contract } = await loadFixture(deployFixture);
      await contract.registerDog("O'Brien's Rex", "Mixed", "M", 2, 0, 0);
      const dog = await contract.retrieveDog(0);
      expect(dog.name).to.equal("O'Brien's Rex");
    });

    it("registers dog with age 0", async function () {
      const { contract } = await loadFixture(deployFixture);
      await contract.registerDog("Newborn", "Poodle", "F", 0, 0, 0);
      const dog = await contract.retrieveDog(0);
      expect(dog.age).to.equal(0n);
    });
  });

  // ─── retrieveDog ───────────────────────────────────────────────────────────

  describe("retrieveDog", function () {
    it("returns correct dog by ID", async function () {
      const { contract } = await loadFixture(deployFixture);
      await contract.registerDog("Rex", "Labrador", "M", 3, 0, 0);
      await contract.registerDog("Bella", "Poodle", "F", 5, 0, 0);
      const bella = await contract.retrieveDog(1);
      expect(bella.name).to.equal("Bella");
      expect(bella.breed).to.equal("Poodle");
      expect(bella.sex).to.equal("F");
    });

    it("returns default zero struct for unregistered ID", async function () {
      const { contract } = await loadFixture(deployFixture);
      const dog = await contract.retrieveDog(99);
      expect(dog.name).to.equal("");
      expect(dog.age).to.equal(0n);
      expect(dog.owner).to.equal(ethers.ZeroAddress);
    });

    it("is a view function (no state change)", async function () {
      const { contract } = await loadFixture(deployFixture);
      await contract.registerDog("Rex", "Lab", "M", 3, 0, 0);
      const idBefore = await contract.dogId();
      await contract.retrieveDog(0);
      expect(await contract.dogId()).to.equal(idBefore);
    });
  });

  // ─── Integration ───────────────────────────────────────────────────────────

  describe("Integration", function () {
    it("multiple accounts register dogs independently with correct owners", async function () {
      const { contract, owner, addr1, addr2 } = await loadFixture(deployFixture);
      await contract.connect(owner).registerDog("A", "Poodle", "M", 1, 0, 0);
      await contract.connect(addr1).registerDog("B", "Beagle", "F", 2, 0, 0);
      await contract.connect(addr2).registerDog("C", "Husky", "M", 3, 0, 0);
      expect((await contract.retrieveDog(0)).owner).to.equal(owner.address);
      expect((await contract.retrieveDog(1)).owner).to.equal(addr1.address);
      expect((await contract.retrieveDog(2)).owner).to.equal(addr2.address);
    });

    it("three-generation lineage chain", async function () {
      const { contract } = await loadFixture(deployFixture);
      await contract.registerDog("Grandma", "Lab", "F", 8, 0, 0); // 0
      await contract.registerDog("Grandpa", "Lab", "M", 9, 0, 0); // 1
      await contract.registerDog("Mom", "Lab", "F", 4, 0, 1);     // 2 — parents: 0, 1
      await contract.registerDog("Dad", "Lab", "M", 5, 0, 0);     // 3
      await contract.registerDog("Puppy", "Lab", "M", 0, 2, 3);   // 4

      const puppy = await contract.retrieveDog(4);
      expect(puppy.mother).to.equal(2n);
      expect(puppy.father).to.equal(3n);
      const mom = await contract.retrieveDog(Number(puppy.mother));
      expect(mom.father).to.equal(1n); // grandpa
    });

    it("large batch: 10 dogs registered sequentially", async function () {
      const { contract } = await loadFixture(deployFixture);
      for (let i = 0; i < 10; i++) {
        await contract.registerDog(`Dog${i}`, "Breed", i % 2 === 0 ? "M" : "F", i, 0, 0);
      }
      expect(await contract.dogId()).to.equal(10n);
      const dog9 = await contract.retrieveDog(9);
      expect(dog9.name).to.equal("Dog9");
      expect(dog9.id).to.equal(9n);
    });
  });
});
