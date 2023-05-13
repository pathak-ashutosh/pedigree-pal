// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

contract PedigreePal {
    // 0xc5a0be0Ac448684c10956C31Bb4795Be9a5CeD29 - deployed contract address

    address public owner;

    mapping (uint => Dog) public dogs;
    uint public dogId;
    
    struct Dog {
        uint id;
        string name;
        uint age;
        string breed;
        string sex;
        uint mother;
        uint father;
        address owner;
    }

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(owner == msg.sender, "You are not the owner");
        _;
    }

    function registerDog(string memory _name, string calldata _breed, string calldata _sex, uint _age, uint _mother, uint _father) public {
        dogs[dogId] = Dog(dogId, _name, _age, _breed, _sex, _mother, _father, owner);
        dogId++;
    }

    function retreiveDog(uint _id) public view returns (Dog memory) {
        return dogs[_id];
    }
}