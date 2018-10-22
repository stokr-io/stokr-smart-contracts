pragma solidity 0.4.24;

/// @title Ownable
/// @dev Provide a simple access control with a single authority: the owner
contract Ownable {

    // Ethreum address of current owner
    address public owner;

    // @dev Log event on ownership transferred
    // @param previousOwner Ethereum address of previous owner
    // @param newOwner Ethereum address of new owner
    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );

    /// @dev Forbid call by anyone but owner
    modifier onlyOwner() {
        require(msg.sender == owner, "Restricted to owner");
        _;
    }

    /// @dev Deployer account becomes initial owner
    constructor() public {
        owner = msg.sender;
    }

    /// @dev Transfer ownership to a new Ethereum account
    /// @param _newOwner Ethereum address to transfer ownership to
    function transferOwnership(address _newOwner) public onlyOwner {
        require(_newOwner != address(0x0), "New owner is zero");

        owner = _newOwner;

        emit OwnershipTransferred(owner, _newOwner);
    }

}
