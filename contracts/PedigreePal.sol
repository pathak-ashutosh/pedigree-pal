// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.18;

contract PedigreePal {
    struct Dog {
        uint256 id;
        string breed;
        uint256 day;
        uint256 month;
        uint256 year;
        string sex;
        string[] ancestry;
    }

    mapping(uint256 => Dog) public dogs;
    uint256 public nextDogId;

    function registerDog(
        string memory _breed,
        uint256 _day,
        uint256 _month,
        uint256 _year,
        string memory _sex,
        string[] memory _ancestry
    ) public {
        Dog memory newDog = Dog({
            id: nextDogId,
            breed: _breed,
            day: _day,
            month: _month,
            year: _year,
            sex: _sex,
            ancestry: _ancestry
        });

        dogs[nextDogId] = newDog;
        nextDogId++;
    }

    function getDog(uint256 _dogId)
        public
        view
        returns (
            uint256 id,
            string memory breed,
            uint256 day,
            uint256 month,
            uint256 year,
            string memory sex,
            string[] memory ancestry
        )
    {
        Dog memory dog = dogs[_dogId];
        return (dog.id, dog.breed, dog.day, dog.month, dog.year, dog.sex, dog.ancestry);
    }
}

