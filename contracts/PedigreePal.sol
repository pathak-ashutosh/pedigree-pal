pragma solidity ^0.8.18;

contract PedigreePal {
    struct Dog {
        uint256 id;
        string breed;
        uint256 dateOfBirth;
        string sex;
        string[] ancestry;
    }

    mapping(uint256 => Dog) public dogs;
    uint256 public nextDogId;

    function registerDog(
        string memory _breed,
        uint256 _dateOfBirth,
        string memory _sex,
        string[] memory _ancestry
    ) public {
        Dog memory newDog = Dog({
            id: nextDogId,
            breed: _breed,
            dateOfBirth: _dateOfBirth,
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
            uint256 dateOfBirth,
            string memory sex,
            string[] memory ancestry
        )
    {
        Dog memory dog = dogs[_dogId];
        return (dog.id, dog.breed, dog.dateOfBirth, dog.sex, dog.ancestry);
    }
}

